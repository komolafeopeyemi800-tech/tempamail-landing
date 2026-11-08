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
    if (openMessageId) return; // don't disturb a message being read
    api('/api/inbox?address=' + encodeURIComponent(currentEmail))
      .then(function (d) { renderInbox(d.messages || []); })
      .catch(function () { /* offline / rate limited: keep what is shown */ });
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

  // Copy buttons (round icon + pill)
  document.querySelectorAll('.js-copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!(navigator.clipboard && navigator.clipboard.writeText)) return;
      navigator.clipboard.writeText(currentEmail).then(function () {
        var label = document.getElementById('copyLabel');
        if (label) { label.textContent = 'Copied!'; setTimeout(function () { label.textContent = 'Copy'; }, 1500); }
      }, function () {});
    });
  });

  document.getElementById('newBtn').addEventListener('click', function () { setEmail(generateEmail()); });
  document.getElementById('refreshBtn').addEventListener('click', refreshInbox);
  document.getElementById('msgBack').addEventListener('click', closeMessage);
  document.getElementById('deleteBtn').addEventListener('click', function () {
    api('/api/inbox?address=' + encodeURIComponent(currentEmail), { method: 'DELETE' })
      .then(function () { closeMessage(); renderInbox([]); })
      .catch(function () {});
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
