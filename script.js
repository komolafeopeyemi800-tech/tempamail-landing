/* ============================================
   Tempamail.org — UI Interactions
   ============================================ */

(function () {
  'use strict';

  var REDIRECT_URL = 'https://tempbmail.com';
  var DOMAINS = ['tempamail.org', 'tmpmail.net', 'quicktemp.email'];

  function randomString(len) {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var str = '';
    for (var i = 0; i < len; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
  }

  function generateEmail() {
    var user = randomString(10);
    var domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
    return user + '@' + domain;
  }

  function maskEmail(email) {
    var parts = email.split('@');
    var user = parts[0];
    var domain = parts[1];
    var visibleCount = 3;
    var visible = user.substring(0, visibleCount);
    var hidden = user.substring(visibleCount);

    return '<span class="email-visible">' + visible + '</span>' +
           '<span class="email-hidden">' + hidden + '</span>' +
           '<span class="email-visible">@' + domain + '</span>';
  }

  // ---- Show a partially masked email in the widget ----
  var emailEl = document.getElementById('emailAddress');
  var currentEmail = generateEmail();
  if (emailEl) {
    emailEl.innerHTML = maskEmail(currentEmail);
  }

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

  // ---- Inbox refresh timer (visual only) ----
  var timerEl = document.getElementById('refreshTimer');
  var countdown = 15;

  if (timerEl) {
    setInterval(function () {
      countdown--;
      if (countdown <= 0) {
        countdown = 15;
        currentEmail = generateEmail();
        if (emailEl) emailEl.innerHTML = maskEmail(currentEmail);
      }
      timerEl.textContent = countdown;
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
