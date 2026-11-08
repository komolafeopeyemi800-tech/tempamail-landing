import PostalMime from 'postal-mime';

const MAX_RAW_BYTES = 2 * 1024 * 1024; // reject anything bigger than 2 MB
const MAX_TEXT_CHARS = 100_000;
const MAX_HTML_CHARS = 300_000;
const MAX_PER_ADDRESS = 50;

const ADDRESS_RE = /^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9.-]+\.[a-z]{2,}$/;

function allowedDomains(env) {
  return String(env.DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

// Role/system mailboxes. These can never be read through the public inbox API and
// never accept mail through the Worker, so nobody can read abuse@/contact@ by
// typing the address into the API. (Real mail to these is forwarded by dedicated
// Email Routing rules, which take priority over the catch-all.)
const RESERVED_LOCAL_PARTS = new Set([
  'abuse', 'admin', 'administrator', 'contact', 'hostmaster', 'info', 'legal',
  'mailer-daemon', 'noreply', 'no-reply', 'postmaster', 'privacy', 'root',
  'security', 'support', 'webmaster', 'dmca', 'billing', 'help', 'hello', 'sales',
]);

function normalizeAddress(raw, env) {
  const addr = String(raw || '').trim().toLowerCase();
  if (!ADDRESS_RE.test(addr)) return null;
  const [local, domain] = addr.split('@');
  if (RESERVED_LOCAL_PARTS.has(local)) return null;
  return allowedDomains(env).includes(domain) ? addr : null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export default {
  // ---------- Incoming mail (Cloudflare Email Routing) ----------
  async email(message, env) {
    const to = normalizeAddress(message.to, env);
    if (!to) {
      message.setReject('Unknown recipient');
      return;
    }
    if (message.rawSize > MAX_RAW_BYTES) {
      message.setReject('Message too large');
      return;
    }

    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO messages (id, address, from_addr, from_name, subject, text, html, received_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
      .bind(
        id,
        to,
        (parsed.from && parsed.from.address) || message.from || '',
        (parsed.from && parsed.from.name) || '',
        (parsed.subject || '(no subject)').slice(0, 300),
        (parsed.text || '').slice(0, MAX_TEXT_CHARS),
        (parsed.html || '').slice(0, MAX_HTML_CHARS),
        Date.now()
      )
      .run();

    // Keep only the newest MAX_PER_ADDRESS messages per address.
    await env.DB.prepare(
      `DELETE FROM messages WHERE address = ?1 AND id NOT IN (
         SELECT id FROM messages WHERE address = ?1 ORDER BY received_at DESC LIMIT ?2
       )`
    )
      .bind(to, MAX_PER_ADDRESS)
      .run();
  },

  // ---------- Inbox API ----------
  async fetch(request, env) {
    const url = new URL(request.url);

    // Per-IP rate limit (60 requests / minute). The page polls ~6 times a minute.
    if (env.API_LIMITER) {
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const { success } = await env.API_LIMITER.limit({ key: ip });
      if (!success) {
        return new Response(JSON.stringify({ error: 'rate limited, slow down' }), {
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '60', 'cache-control': 'no-store' },
        });
      }
    }

    const address = normalizeAddress(url.searchParams.get('address'), env);
    // Anything older than this is expired: hidden immediately, purged by the hourly cron.
    const cutoff = Date.now() - (Number(env.RETENTION_HOURS) || 24) * 60 * 60 * 1000;

    if (url.pathname === '/api/inbox' && request.method === 'GET') {
      if (!address) return json({ error: 'invalid address' }, 400);
      const { results } = await env.DB.prepare(
        `SELECT id, from_addr, from_name, subject, received_at,
                substr(text, 1, 140) AS preview
           FROM messages WHERE address = ?1 AND received_at >= ?3
          ORDER BY received_at DESC LIMIT ?2`
      )
        .bind(address, MAX_PER_ADDRESS, cutoff)
        .all();
      return json({ address, messages: results });
    }

    if (url.pathname === '/api/message' && request.method === 'GET') {
      const id = url.searchParams.get('id') || '';
      if (!address || !id) return json({ error: 'invalid request' }, 400);
      const row = await env.DB.prepare(
        `SELECT id, from_addr, from_name, subject, text, html, received_at
           FROM messages WHERE address = ?1 AND id = ?2 AND received_at >= ?3`
      )
        .bind(address, id, cutoff)
        .first();
      return row ? json(row) : json({ error: 'not found' }, 404);
    }

    if (url.pathname === '/api/inbox' && request.method === 'DELETE') {
      if (!address) return json({ error: 'invalid address' }, 400);
      await env.DB.prepare('DELETE FROM messages WHERE address = ?1').bind(address).run();
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  },

  // ---------- Hourly cleanup ----------
  async scheduled(event, env) {
    const hours = Number(env.RETENTION_HOURS) || 24;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    await env.DB.prepare('DELETE FROM messages WHERE received_at < ?1').bind(cutoff).run();
  },
};
