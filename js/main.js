/* Allenhouse Admissions 2027-28 — page behaviour (no dependencies) */
(function () {
  'use strict';

  /*
   * FORM DESTINATION
   * submit.php (next to index.html) validates the enquiry and appends it to
   * data/enquiries.csv. Change this only if the handler lives somewhere else.
   */
  var FORM_ENDPOINT = 'submit.php';

  var DESKTOP_NAV = window.matchMedia('(min-width: 1100px)');

  /* ---------- Mobile navigation ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('main-nav');

  function setMenu(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(!nav.classList.contains('is-open'));
    });

    // Close the panel after choosing a link (important for the #enquire anchor).
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && !DESKTOP_NAV.matches) setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenu(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (nav.classList.contains('is-open') && !e.target.closest('.site-header')) setMenu(false);
    });

    // Reset state when crossing into desktop layout.
    var onChange = function () {
      setMenu(false);
      document.querySelectorAll('.nav-item.is-open').forEach(function (item) {
        item.classList.remove('is-open');
        var b = item.querySelector('.submenu-toggle');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
    };
    if (DESKTOP_NAV.addEventListener) DESKTOP_NAV.addEventListener('change', onChange);
    else if (DESKTOP_NAV.addListener) DESKTOP_NAV.addListener(onChange);
  }

  document.querySelectorAll('.submenu-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (DESKTOP_NAV.matches) return; // desktop opens on hover/focus; a click-toggle would stick open
      var item = btn.closest('.nav-item');
      var open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Footer newsletter (same endpoint as allenhousejhansi.com) ---------- */
  // shortcut: the endpoint sends no CORS headers, so this only works when the page is served from allenhousejhansi.com.
  var NEWSLETTER_ENDPOINT = 'https://allenhousejhansi.com/proxy/newsletter-proxy.php';
  var newsForm = document.getElementById('news-form');
  if (newsForm) {
    var newsEmail = document.getElementById('news-email');
    var newsMsg = document.getElementById('news-msg');
    var newsBtn = newsForm.querySelector('.news-btn');
    newsForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (newsBtn.disabled) return;
      var email = newsEmail.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newsMsg.textContent = 'Please enter a valid email address.';
        newsEmail.focus();
        return;
      }
      var name = email.split('@')[0].replace(/[._-]+/g, ' ').trim().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      newsBtn.disabled = true;
      newsBtn.textContent = 'Subscribing...';
      newsMsg.textContent = '';
      fetch(NEWSLETTER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: email, name: name || 'Newsletter Subscriber', subscription_source: 'website_footer' })
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (!res.ok || data.success === false || data.status === 'error') throw new Error(data.message || res.status);
            newsMsg.textContent = data.already_subscribed ? 'You are already subscribed.' : 'Thank you for subscribing!';
            newsForm.reset();
          });
        })
        .catch(function (e) {
          if (window.console) console.error('[Allenhouse newsletter] failed:', e);
          newsMsg.textContent = 'Sorry, we could not subscribe you just now. Please try again later.';
        })
        .then(function () {
          newsBtn.disabled = false;
          newsBtn.textContent = 'Subscribe';
        });
    });
  }

  /* ---------- Enquiry form ---------- */
  var form = document.getElementById('enquiry-form');
  if (!form) return;

  var formView = document.getElementById('form-view');
  var thanksView = document.getElementById('thanks-view');
  var sendError = document.getElementById('send-error');
  var submitBtn = form.querySelector('.submit-btn');
  var phone = document.getElementById('whatsapp');

  var FIELDS = ['firstName', 'lastName', 'grade', 'whatsapp', 'email', 'consent'];

  // Keep the WhatsApp field digits-only while typing or pasting.
  phone.addEventListener('input', function () {
    var digits = phone.value.replace(/\D/g, '');
    // Accept "+91 98765 43210" or "091..." typed or pasted: drop the country/trunk prefix.
    if (digits.length > 10 && digits.indexOf('91') === 0) digits = digits.slice(2);
    else if (digits.length > 10 && digits.charAt(0) === '0') digits = digits.slice(1);
    digits = digits.slice(0, 10);
    if (phone.value !== digits) phone.value = digits;
  });

  function readValues() {
    var fd = new FormData(form);
    return {
      firstName: String(fd.get('firstName') || '').trim(),
      lastName: String(fd.get('lastName') || '').trim(),
      grade: String(fd.get('grade') || ''),
      whatsapp: String(fd.get('whatsapp') || '').replace(/\D/g, ''),
      email: String(fd.get('email') || '').trim(),
      consent: fd.get('consent') === 'yes',
      website: String(fd.get('website') || '').trim()
    };
  }

  function validate(v) {
    var err = {};
    if (!v.firstName) err.firstName = 'Please enter the first name.';
    if (!v.lastName) err.lastName = 'Please enter the last name.';
    if (!v.grade) err.grade = 'Please select a class.';
    if (!/^[6-9]\d{9}$/.test(v.whatsapp)) err.whatsapp = 'Please enter a valid 10-digit WhatsApp number.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) err.email = 'Please enter a valid email address.';
    if (!v.consent) err.consent = 'Please tick the box to agree before submitting.';
    return err;
  }

  function showErrors(err) {
    FIELDS.forEach(function (k) {
      var input = document.getElementById(k);
      var msg = document.getElementById(k + '-error');
      if (msg) msg.textContent = err[k] || '';
      if (input) {
        if (err[k]) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    });
    var first = FIELDS.filter(function (k) { return err[k]; })[0];
    if (first) document.getElementById(first).focus();
  }

  // Clear a field's error as soon as the visitor fixes it.
  FIELDS.forEach(function (k) {
    var input = document.getElementById(k);
    if (!input) return;
    input.addEventListener(input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input', function () {
      if (input.getAttribute('aria-invalid') !== 'true') return;
      var err = validate(readValues());
      if (!err[k]) {
        input.removeAttribute('aria-invalid');
        document.getElementById(k + '-error').textContent = '';
      }
    });
  });

  function setSending(on) {
    submitBtn.disabled = on;
    submitBtn.textContent = on ? 'Sending...' : 'Submit';
  }

  function showThanks(v) {
    document.getElementById('thanks-name').textContent = v.firstName;
    document.getElementById('thanks-grade').textContent = v.grade;
    formView.hidden = true;
    thanksView.hidden = false;
    thanksView.focus({ preventScroll: true });
    var card = thanksView.closest('.form-card');
    var top = card.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (submitBtn.disabled) return;

    var v = readValues();
    sendError.hidden = true;

    // Honeypot: bots fill the hidden field. Pretend it worked and send nothing.
    if (v.website) { showThanks(v); return; }

    var err = validate(v);
    showErrors(err);
    if (Object.keys(err).length) return;

    var payload = {
      first_name: v.firstName,
      last_name: v.lastName,
      class: v.grade,
      whatsapp: '+91' + v.whatsapp,
      email: v.email,
      consent: true,
      session: '2027-28',
      source: 'admissions-landing-page',
      page_url: window.location.href,
      website: v.website
    };

    setSending(true);
    fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.text().then(function (t) {
          var data = {};
          try { data = t ? JSON.parse(t) : {}; } catch (e) { data = {}; }
          if ((res.status === 404 || res.status === 405) && window.console) {
            console.warn('[Allenhouse enquiry] ' + FORM_ENDPOINT + ' returned ' + res.status +
              '. PHP is not running for this page. Open it through Apache, for example http://localhost/APSJ/, not Live Server or file://.');
          }
          if (!res.ok || data.success !== true) throw new Error(data.message || ('Request failed (' + res.status + ')'));
          return data;
        });
      })
      .then(function () {
        setSending(false);
        showThanks(v);
      })
      .catch(function (e) {
        if (window.console) console.error('[Allenhouse enquiry] submit failed:', e);
        setSending(false);
        sendError.hidden = false;
      });
  });

  document.getElementById('reset-btn').addEventListener('click', function () {
    form.reset();
    showErrors({});
    sendError.hidden = true;
    thanksView.hidden = true;
    formView.hidden = false;
    document.getElementById('firstName').focus();
  });
})();
