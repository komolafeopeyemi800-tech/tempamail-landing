/* ============================================
   Tempamail.org — UI Interactions
   ============================================ */

(function () {
  'use strict';

  // Must match DOMAINS in worker/wrangler.toml
  var DOMAINS = ['tempamail.org'];
  var POLL_SECONDS = 10;
  var STORAGE_KEY = 'tempamail.address';

  function randomString(len) {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var bytes = new Uint8Array(len);
    window.crypto.getRandomValues(bytes);
    var str = '';
    for (var i = 0; i < len; i++) {
      str += chars.charAt(bytes[i] % chars.length);
    }
    return str;
  }

  function generateEmail() {
    var domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
    return randomString(10) + '@' + domain;
  }

  function loadEmail() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && DOMAINS.indexOf(saved.split('@')[1]) !== -1) return saved;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function saveEmail(email) {
    try { localStorage.setItem(STORAGE_KEY, email); } catch (e) { /* ignore */ }
  }

  // ---- Address widget ----
  var emailEl = document.getElementById('emailAddress');
  var currentEmail = loadEmail() || generateEmail();
  saveEmail(currentEmail);
  if (emailEl) emailEl.textContent = currentEmail;

  // ---- Live inbox ----
  var inboxBody = document.getElementById('inboxBody');
  var inboxEmpty = document.getElementById('inboxEmpty');
  var msgList = document.getElementById('msgList');
  var msgView = document.getElementById('msgView');
  var msgFrame = document.getElementById('msgFrame');
  var timerEl = document.getElementById('refreshTimer');
  var countdown = POLL_SECONDS;
  var openMessageId = null;

  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function timeAgo(ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderInbox(messages) {
    if (!msgList) return;
    msgList.textContent = '';
    messages.forEach(function (m) {
      var li = el('li');
      var btn = el('button', 'msg-item');
      btn.type = 'button';
      var row = el('div', 'msg-row');
      row.appendChild(el('span', 'msg-from', m.from_name || m.from_addr || 'Unknown sender'));
      row.appendChild(el('span', 'msg-time', timeAgo(m.received_at)));
      btn.appendChild(row);
      btn.appendChild(el('div', 'msg-subj', m.subject || '(no subject)'));
      if (m.preview) btn.appendChild(el('div', 'msg-preview', m.preview.replace(/\s+/g, ' ')));
      btn.addEventListener('click', function () { openMessage(m.id); });
      li.appendChild(btn);
      msgList.appendChild(li);
    });
    var has = messages.length > 0;
    msgList.hidden = !has || !!openMessageId;
    inboxEmpty.hidden = has || !!openMessageId;
    inboxBody.setAttribute('data-has-mail', has ? 'true' : 'false');
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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
          '<style>body{font-family:sans-serif;font-size:14px;margin:12px;word-wrap:break-word}</style></head><body>' +
          body + '</body></html>';
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
      .then(function (data) { renderInbox(data.messages || []); })
      .catch(function () { /* offline or API not deployed: leave inbox as is */ });
  }

  function setEmail(email) {
    currentEmail = email;
    saveEmail(email);
    if (emailEl) emailEl.textContent = email;
    openMessageId = null;
    if (msgView) msgView.hidden = true;
    renderInbox([]);
    refreshInbox();
  }

  var copyBtn = document.getElementById('copyBtn');
  var copyLabel = document.getElementById('copyLabel');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var done = function () {
        copyLabel.textContent = 'Copied!';
        setTimeout(function () { copyLabel.textContent = 'Copy'; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentEmail).then(done, function () {});
      }
    });
  }

  var newBtn = document.getElementById('newBtn');
  if (newBtn) newBtn.addEventListener('click', function () { setEmail(generateEmail()); });

  var deleteBtn = document.getElementById('deleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function () {
      api('/api/inbox?address=' + encodeURIComponent(currentEmail), { method: 'DELETE' })
        .then(function () { closeMessage(); renderInbox([]); })
        .catch(function () {});
    });
  }

  var refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', refreshInbox);

  var msgBack = document.getElementById('msgBack');
  if (msgBack) msgBack.addEventListener('click', closeMessage);

  if (inboxBody) refreshInbox();

  // ---- Mobile nav toggle ----
  var navToggle = document.getElementById('navToggle');
  var navMenu = document.getElementById('navMenu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      var expanded = navToggle.classList.toggle('active');
      navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', expanded);
    });

    navMenu.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.classList.remove('active');
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ---- Active nav link on scroll ----
  var sections = document.querySelectorAll('section[id], header[id]');
  var navLinks = document.querySelectorAll('.nav-link');

  function setActiveLink() {
    var current = '';
    sections.forEach(function (section) {
      var top = section.offsetTop - 100;
      if (window.scrollY >= top) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(function (link) {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', setActiveLink, { passive: true });

  // ---- Auto-refresh countdown ----
  if (timerEl) {
    setInterval(function () {
      countdown--;
      if (countdown <= 0) {
        refreshInbox();
      } else {
        timerEl.textContent = countdown;
      }
    }, 1000);
  }

  // ---- FAQ accordion ----
  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var answer = this.nextElementSibling;
      var isOpen = answer.classList.contains('open');

      document.querySelectorAll('.faq-answer.open').forEach(function (a) {
        a.classList.remove('open');
        a.previousElementSibling.setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        answer.classList.add('open');
        this.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // ---- Scroll-in animations ----
  var fadeEls = document.querySelectorAll(
    '.feature-card, .step-card, .inbox-card, .cta-section, .faq-item'
  );

  fadeEls.forEach(function (el) { el.classList.add('fade-in'); });

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  fadeEls.forEach(function (el) { observer.observe(el); });

  var largeFadeEls = document.querySelectorAll(
    '.content-col-text, .content-col-image, .content-block'
  );

  largeFadeEls.forEach(function (el) { el.classList.add('fade-in'); });

  var largeObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          largeObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05 }
  );

  largeFadeEls.forEach(function (el) { largeObserver.observe(el); });

  // ---- Navbar shadow on scroll ----
  var navbar = document.getElementById('navbar');
  window.addEventListener('scroll', function () {
    if (window.scrollY > 10) {
      navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.2)';
    } else {
      navbar.style.boxShadow = '0 2px 10px rgba(0,0,0,0.15)';
    }
  }, { passive: true });

})();
