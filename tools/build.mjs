// Static page generator for Tempamail.org
//   node tools/build.mjs
// Reads tools/content/*.html (page bodies) and writes public/**/index.html,
// public/sitemap.xml and public/robots.txt. Output is committed, so Cloudflare
// needs no build step.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const SITE = 'https://tempamail.org';
const UPDATED = '2026-11-08';

const body = (f) => readFileSync(join(ROOT, 'tools', 'content', f), 'utf8');

const ARTICLES = [
  {
    path: 'articles/what-is-a-temporary-email-address/',
    file: 'article-what-is.html',
    title: 'What Is a Temporary Email Address and How Does It Work?',
    short: 'What Is a Temporary Email Address and How Does It Work?',
    desc: 'A plain-English explanation of disposable email: how the address is created, how messages arrive, how long they last and what the limits are.',
    blurb: 'How a throwaway address is created, how mail reaches it, and why it disappears — explained without jargon.',
    read: '6 min read',
    art: 'a',
  },
  {
    path: 'articles/protect-your-inbox-from-spam/',
    file: 'article-spam.html',
    title: '9 Practical Ways to Cut Spam and Protect Your Real Inbox',
    short: '9 Practical Ways to Cut Spam and Protect Your Real Inbox',
    desc: 'Simple habits that reduce spam and phishing: separate addresses, safer sign-ups, breach checks, and when a disposable email is the right tool.',
    blurb: 'Separate addresses, smarter sign-ups, breach checks and other habits that keep your main inbox clean.',
    read: '7 min read',
    art: 'b',
  },
  {
    path: 'articles/when-to-use-a-disposable-email/',
    file: 'article-when.html',
    title: 'When to Use a Disposable Email — and When Not To',
    short: 'When to Use a Disposable Email — and When Not To',
    desc: 'A realistic guide to the good and bad uses of temporary email: free downloads and one-off sign-ups are fine, banking and account recovery are not.',
    blurb: 'Good uses, bad uses, and the one rule that matters: never rely on a throwaway address for anything you need later.',
    read: '6 min read',
    art: 'c',
  },
];

const PAGES = [
  { path: '', file: 'home.html', home: true,
    title: 'Tempamail.org — Free Temporary Email Address (Disposable Inbox)',
    desc: 'Get a free temporary email address instantly. No sign-up, no password. Receive verification codes and messages in a disposable inbox that deletes itself after 24 hours.' },
  { path: 'articles/', file: 'articles-index.html',
    title: 'Articles — Email Privacy & Disposable Email Guides | Tempamail.org',
    desc: 'Guides on email privacy, spam protection and using disposable email addresses responsibly.' },
  ...ARTICLES.map((a) => ({ ...a, article: true })),
  { path: 'about/', file: 'about.html', title: 'About Tempamail.org', desc: 'What Tempamail.org is, how it works, how long mail is kept and how the free service is funded.' },
  { path: 'contact/', file: 'contact.html', title: 'Contact Us | Tempamail.org', desc: 'How to contact Tempamail.org for support, privacy requests, press or abuse reports.' },
  { path: 'privacy/', file: 'privacy.html', title: 'Privacy Policy | Tempamail.org', desc: 'What data Tempamail.org collects, how long it is kept, how advertising cookies work and your rights.', legal: true },
  { path: 'terms/', file: 'terms.html', title: 'Terms of Service | Tempamail.org', desc: 'The rules for using Tempamail.org, including acceptable use, retention and disclaimers.', legal: true },
  { path: 'abuse/', file: 'abuse.html', title: 'Report Abuse & DMCA | Tempamail.org', desc: 'How to report spam, fraud, illegal content or copyright complaints involving Tempamail.org addresses.', legal: true },
];

const NAV = [
  ['/', 'Home'], ['/articles/', 'Articles'], ['/about/', 'About'], ['/contact/', 'Contact'], ['/privacy/', 'Privacy'],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const MAIL_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13 2 4"/></svg>';

function header(page) {
  const links = NAV.map(([href, label]) => {
    const cur = href === '/' ? page.home : ('/' + page.path).startsWith(href) && !page.home;
    return `<li><a href="${href}"${cur ? ' aria-current="page"' : ''}>${label}</a></li>`;
  }).join('');
  return `<header class="topbar"><div class="wrap">
  <a class="brand" href="/" aria-label="Tempamail.org home"><span class="brand-mark">${MAIL_ICON}</span><span>Temp<b>amail</b></span></a>
  <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button>
  <ul class="nav" id="nav">${links}</ul>
</div></header>`;
}

function footer() {
  return `<footer class="footer"><div class="wrap">
  <ul class="footer-links">
    <li><a href="/privacy/">Privacy</a></li><li><a href="/terms/">Terms</a></li><li><a href="/about/">About</a></li>
    <li><a href="/articles/">Articles</a></li><li><a href="/contact/">Contact</a></li><li><a href="/abuse/">Report abuse</a></li>
  </ul>
  <p>Tempamail.org provides free, receive-only temporary email addresses. Messages are deleted automatically after 24 hours. Do not use temporary addresses for banking, account recovery or anything you may need later.</p>
  <p>&copy; 2026 Tempamail.org. All rights reserved.</p>
</div></footer>`;
}

function jsonLd(page) {
  const url = `${SITE}/${page.path}`;
  if (page.home) {
    return `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'Tempamail.org', url: SITE + '/',
      description: page.desc,
    })}</script>`;
  }
  if (page.article) {
    return `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Article', headline: page.title, description: page.desc,
      datePublished: UPDATED, dateModified: UPDATED, mainEntityOfPage: url,
      author: { '@type': 'Organization', name: 'Tempamail.org' },
      publisher: { '@type': 'Organization', name: 'Tempamail.org', url: SITE + '/' },
    })}</script>`;
  }
  return '';
}

function wrap(page, inner) {
  const url = `${SITE}/${page.path}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.desc)}">
  <link rel="canonical" href="${url}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="google-site-verification" content="oBZ8DbXvNsUekyocOZbECuA-1737lQjK3mz6JDi4x0A">
  <meta property="og:type" content="${page.article ? 'article' : 'website'}">
  <meta property="og:site_name" content="Tempamail.org">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(page.desc)}">
  <meta property="og:url" content="${url}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230f9d8a'/%3E%3Cpath d='M7 10h18v12H7zM7 10l9 7 9-7' fill='none' stroke='white' stroke-width='2' stroke-linejoin='round'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  ${jsonLd(page)}
</head>
<body>
${header(page)}
${inner}
${footer()}
<script src="/script.js" defer></script>
</body>
</html>
`;
}

const ART_SVG = {
  a: '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>',
  b: '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  c: '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

function cards(list) {
  return `<div class="cards">${list.map((a) => `
  <a class="card" href="/${a.path}">
    <div><h3>${esc(a.short)}</h3><p>${esc(a.blurb)}</p><div class="meta">${a.read}</div></div>
    <div class="card-art ${a.art === 'b' ? 'card-art--b' : a.art === 'c' ? 'card-art--c' : ''}" aria-hidden="true">${ART_SVG[a.art]}</div>
  </a>`).join('')}</div>`;
}

function render(page) {
  let content = body(page.file).replaceAll('{{UPDATED}}', 'November 8, 2026');
  content = content.replace('{{ARTICLE_CARDS}}', cards(ARTICLES));

  let inner;
  if (page.home) {
    inner = content;
  } else {
    const crumbs = page.article
      ? `<div class="crumbs"><a href="/">Home</a> / <a href="/articles/">Articles</a></div>`
      : `<div class="crumbs"><a href="/">Home</a></div>`;
    const h1 = page.article ? page.title : page.title.split(' | ')[0].replace(/ — .*/, '');
    const extra = page.article
      ? `<div class="try-box"><div><strong>Need a throwaway address right now?</strong><span>Free, no sign-up. Messages are deleted after 24 hours.</span></div><a class="btn" href="/">Get a temp email</a></div>`
      : '';
    inner = `<div class="page-head"><div class="wrap wrap--narrow">${crumbs}<h1>${esc(h1)}</h1><p>${esc(page.desc)}</p></div></div>
<main class="wrap wrap--narrow"><article class="page-body prose">
${content}
${extra}
</article></main>`;
  }
  return wrap(page, inner);
}

for (const page of PAGES) {
  const out = join(PUBLIC, page.path, 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, render(page));
  console.log('wrote', out.replace(ROOT, ''));
}

// sitemap + robots
const urls = PAGES.map((p) => `  <url><loc>${SITE}/${p.path}</loc><lastmod>${UPDATED}</lastmod></url>`).join('\n');
writeFileSync(join(PUBLIC, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
writeFileSync(join(PUBLIC, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log('wrote sitemap.xml, robots.txt');
