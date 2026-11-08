/* Tempamail.org — inbox + UI behaviour */
(function () {
  'use strict';

  // Must match DOMAINS in worker/wrangler.toml
  var DOMAINS = ['tempamail.org'];
  var POLL_SECONDS = 10;
  var STORAGE_KEY = 'tempamail.address';

  // ---- Mobile nav + FAQ (all pages) ----
  var navToggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var ans = btn.nextElementSibling;
      var wasOpen = ans.classList.contains('open');
      document.querySelectorAll('.faq-a.open').forEach(function (a) {
        a.classList.remove('open');
        a.previousElementSibling.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) { ans.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  // ---- Inbox (home page only) ----
  var emailEl = document.getElementById('emailAddress');
  if (!emailEl) return;

  var inboxEmpty = document.getElementById('inboxEmpty');
  var msgList = document.getElementById('msgList');
  var msgView = document.getElementById('msgView');
  var msgFrame = document.getElementById('msgFrame');
  var timerEl = document.getElementById('refreshTimer');
  var countdown = POLL_SECONDS;
  var openMessageId = null;
  var currentEmail;

  function randomString(len) {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var bytes = new Uint8Array(len);
    window.crypto.getRandomValues(bytes);
    var s = '';
    for (var i = 0; i < len; i++) s += chars.charAt(bytes[i] % chars.length);
    return s;
  }
  function generateEmail() {
    return randomString(10) + '@' + DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  }
  function loadEmail() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v && DOMAINS.indexOf(v.split('@')[1]) !== -1) return v;
    } catch (e) { /* storage blocked */ }
    return null;
  }
  function saveEmail(v) { try { localStorage.setItem(STORAGE_KEY, v); } catch (e) { /* ignore */ } }

  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      if (r.status === 429) { countdown = 60; throw new Error('rate limited'); }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  function timeAgo(ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderInbox(messages) {
    msgList.textContent = '';
    messages.forEach(function (m) {
      var li = el('li');
      var btn = el('button', 'msg-item');
      btn.type = 'button';
      btn.appendChild(el('span', 'msg-from', m.from_name || m.from_addr || 'Unknown sender'));
      var subj = el('span', 'msg-subj', m.subject || '(no subject)');
      subj.appendChild(el('small', null, timeAgo(m.received_at) + (m.preview ? ' — ' + m.preview.replace(/\s+/g, ' ') : '')));
      btn.appendChild(subj);
      btn.appendChild(el('span', 'msg-view-btn', 'View'));
      btn.addEventListener('click', function () { openMessage(m.id); });
      li.appendChild(btn);
      msgList.appendChild(li);
    });
    var has = messages.length > 0;
    msgList.hidden = !has || !!openMessageId;
    inboxEmpty.hidden = has || !!openMessageId;
  }

  function openMessage(id) {
    api('/api/message?address=' + encodeURIComponent(currentEmail) + '&id=' + encodeURIComponent(id))
      .then(function (m) {
        openMessageId = id;
        document.getElementById('msgSubject').textContent = m.subject || '(no subject)';
        document.getElementById('msgMeta').textContent =
          'From ' + (m.from_name ? m.from_name + ' <' + m.from_addr + '>' : m.from_addr) +
          ' · ' + new Date(m.received_at).toLocaleString();
        // Sandboxed iframe (no scripts) + CSP that blocks remote images/trackers.
        var csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">';
        var body = m.html ? m.html : '<pre style="white-space:pre-wrap;font-family:inherit">' + escapeHtml(m.text || '') + '</pre>';
        msgFrame.srcdoc = '<!doctype html><html><head><meta charset="utf-8">' + csp +
          '<style>body{font-family:sans-serif;font-size:14px;margin:12px;word-wrap:break-word}</style></head><body>' + body + '</body></html>';
        msgList.hidden = true;
        inboxEmpty.hidden = true;
        msgView.hidden = false;
      })
      .catch(function () { /* keep list visible */ });
  }

  function closeMessage() {
    openMessageId = null;
    msgView.hidden = true;
    msgFrame.srcdoc = '';
    refreshInbox();
  }

  function refreshInbox() {
    countdown = POLL_SECONDS;
    if (timerEl) timerEl.textContent = countdown;
    if (openMessageId) return Promise.resolve(null); // don't disturb a message being read
    return api('/api/inbox?address=' + encodeURIComponent(currentEmail))
      .then(function (d) { renderInbox(d.messages || []); return d.messages || []; })
      .catch(function (e) { return e; }); // offline / rate limited: keep what is shown
  }

  function setEmail(v) {
    currentEmail = v;
    saveEmail(v);
    emailEl.textContent = v;
    openMessageId = null;
    msgView.hidden = true;
    renderInbox([]);
    refreshInbox();
  }

  currentEmail = loadEmail() || generateEmail();
  saveEmail(currentEmail);
  emailEl.textContent = currentEmail;

  // Copy buttons
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }
  document.querySelectorAll('.js-copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copyText(currentEmail).then(function () {
        toast('Copied ' + currentEmail);
        var label = btn.querySelector('.copy-label');
        if (label) {
          var old = label.textContent;
          label.textContent = 'Copied!';
          setTimeout(function () { label.textContent = old; }, 1500);
        }
      }, function () { toast('Press Ctrl+C to copy the address'); });
    });
  });

  var refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.addEventListener('click', function () {
    refreshBtn.classList.add('is-spinning');
    var started = Date.now();
    refreshInbox().then(function (res) {
      var wait = Math.max(0, 600 - (Date.now() - started)); // keep the spinner visible
      setTimeout(function () {
        refreshBtn.classList.remove('is-spinning');
        if (res instanceof Error) toast('Could not refresh. Try again in a moment.');
        else if (res && res.length) toast(res.length + (res.length === 1 ? ' message' : ' messages') + ' in your inbox');
        else toast('Inbox refreshed. No new messages yet.');
      }, wait);
    });
  });

  document.getElementById('newBtn').addEventListener('click', function () {
    setEmail(generateEmail());
    toast('New address: ' + currentEmail);
  });
  document.getElementById('msgBack').addEventListener('click', closeMessage);
  document.getElementById('deleteBtn').addEventListener('click', function () {
    api('/api/inbox?address=' + encodeURIComponent(currentEmail), { method: 'DELETE' })
      .then(function () { openMessageId = null; msgView.hidden = true; msgFrame.srcdoc = ''; renderInbox([]); toast('All messages deleted'); })
      .catch(function () { toast('Could not delete. Try again in a moment.'); });
  });

  // Auto-refresh, paused while the tab is hidden (saves requests).
  setInterval(function () {
    if (document.hidden) return;
    countdown--;
    if (countdown <= 0) refreshInbox();
    else if (timerEl) timerEl.textContent = countdown;
  }, 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshInbox(); });

  refreshInbox();
})();
