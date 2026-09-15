(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Theme ---------- */
  var toggle = $('#theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    });
  }

  /* ---------- Nav: sticky state + scroll progress ---------- */
  var nav = $('#nav');
  var bar = $('#progress');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    if (nav) nav.classList.toggle('stuck', y > 12);
    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var menuBtn = $('#menu-btn');
  var menu = $('#mobile-menu');

  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1000) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
    });
  }

  /* ---------- Active section in nav ---------- */
  var navLinks = $$('.nav-links a');
  var sections = $$('main section[id]');
  if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        navLinks.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Project sheet ---------- */
  var sheet = $('#project-sheet');
  if (sheet) {
    var sTitle = $('#sheet-title');
    var sStack = $('#sheet-stack');
    var sBody  = $('#sheet-body');
    var sRepo  = $('#sheet-repo');

    $$('.card').forEach(function (card) {
      card.addEventListener('click', function () {
        sTitle.textContent = card.dataset.title || '';
        sStack.textContent = card.dataset.stack || '';
        sBody.textContent  = card.dataset.body || '';

        var repo = card.dataset.repo;
        if (repo) { sRepo.setAttribute('href', repo); sRepo.hidden = false; }
        else { sRepo.removeAttribute('href'); sRepo.hidden = true; }

        if (typeof sheet.showModal === 'function') sheet.showModal();
        else sheet.setAttribute('open', '');
      });
    });

    var closeSheet = function () { sheet.close(); };
    var sheetClose = $('#sheet-close');
    if (sheetClose) sheetClose.addEventListener('click', closeSheet);

    // Click on the backdrop (outside the dialog box) closes it.
    sheet.addEventListener('click', function (e) {
      var r = sheet.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right &&
                   e.clientY >= r.top  && e.clientY <= r.bottom;
      if (!inside) closeSheet();
    });
  }

  /* ---------- Command palette ---------- */
  var palette = $('#palette');
  if (palette && typeof palette.showModal === 'function') {
    var q     = $('#palette-q');
    var list  = $('#palette-list');
    var index = 0;

    var items = [
      { label: 'Home',                 hint: 'top',     href: '#top' },
      { label: 'About',                hint: '01',      href: '#about' },
      { label: 'How I work',           hint: '02',      href: '#process' },
      { label: 'Experience',           hint: '03',      href: '#experience' },
      { label: 'Work',                 hint: '04',      href: '#work' },
      { label: 'Toolkit',              hint: '05',      href: '#toolkit' },
      { label: 'Background',           hint: '06',      href: '#background' },
      { label: 'Contact',              hint: '07',      href: '#contact' },
      { label: 'Email me',             hint: 'mail',    href: 'mailto:magistradozach@gmail.com', ext: true },
      { label: 'GitHub',               hint: 'ext',     href: 'https://github.com/0xzso7', ext: true },
      { label: 'LinkedIn',             hint: 'ext',     href: 'https://www.linkedin.com/in/zsmagistrado/', ext: true },
      { label: 'Toggle light / dark',  hint: 'theme',   action: 'theme' }
    ];

    function render(filter) {
      var needle = (filter || '').trim().toLowerCase();
      var hits = items.filter(function (it) {
        return !needle || it.label.toLowerCase().indexOf(needle) !== -1;
      });
      index = 0;
      list.innerHTML = '';

      if (!hits.length) {
        var empty = document.createElement('li');
        empty.className = 'palette-empty';
        empty.textContent = 'Nothing matches that.';
        list.appendChild(empty);
        return;
      }

      hits.forEach(function (it, i) {
        var li = document.createElement('li');
        var b  = document.createElement('button');
        b.type = 'button';
        b.className = i === 0 ? 'on' : '';
        b.innerHTML = '<span></span><em></em>';
        b.firstChild.textContent = it.label;
        b.lastChild.textContent = it.hint;
        b.addEventListener('click', function () { run(it); });
        b.addEventListener('mousemove', function () { mark(i); });
        li.appendChild(b);
        list.appendChild(li);
      });
    }

    function buttons() { return $$('button', list); }

    function mark(i) {
      var bs = buttons();
      if (!bs.length) return;
      index = (i + bs.length) % bs.length;
      bs.forEach(function (b, n) { b.classList.toggle('on', n === index); });
      bs[index].scrollIntoView({ block: 'nearest' });
    }

    function run(it) {
      palette.close();
      if (it.action === 'theme') { toggle && toggle.click(); return; }
      if (it.ext) { window.open(it.href, it.href.indexOf('mailto:') === 0 ? '_self' : '_blank', 'noopener'); return; }
      var target = document.querySelector(it.href === '#top' ? 'body' : it.href);
      if (target) {
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', it.href);
      }
    }

    function openPalette() {
      render('');
      palette.showModal();
      q.value = '';
      q.focus();
    }

    var opener = $('#palette-open');
    if (opener) opener.addEventListener('click', openPalette);

    q.addEventListener('input', function () { render(q.value); });

    palette.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mark(index + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(index - 1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var bs = buttons();
        if (bs[index]) bs[index].click();
      }
    });

    palette.addEventListener('click', function (e) {
      if (e.target === palette) palette.close();
    });

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (palette.open) palette.close(); else openPalette();
      }
    });
  } else {
    // No <dialog> support, so the hint button would do nothing. Hide it.
    var hint = $('#palette-open');
    if (hint) hint.style.display = 'none';
  }

  /* ---------- Metric links open the entry that explains them ---------- */
  function openHighlight(hash) {
    if (!hash || hash.length < 2) return;
    var target = document.getElementById(hash.slice(1));
    if (!target || target.tagName !== 'DETAILS') return;
    target.open = true;
    target.classList.add('flash');
    setTimeout(function () { target.classList.remove('flash'); }, 1600);
  }

  $$('.metric').forEach(function (link) {
    link.addEventListener('click', function () {
      openHighlight(link.getAttribute('href'));
    });
  });
  window.addEventListener('hashchange', function () { openHighlight(location.hash); });
  openHighlight(location.hash);

  /* ---------- Pause the hero light once it scrolls away ---------- */
  /* The ray layers are the most expensive thing on the page. Once the hero is
     off screen there is nothing to look at, so stop compositing them entirely. */
  var heroEl = $('.hero');
  if (heroEl && 'IntersectionObserver' in window && typeof heroEl.getAnimations === 'function') {
    var lit = $$('.ray').concat($$('.hero-glow'));
    new IntersectionObserver(function (entries) {
      var visible = entries[0].isIntersecting;
      lit.forEach(function (el) {
        el.getAnimations().forEach(function (a) {
          if (visible) { a.play(); } else { a.pause(); }
        });
      });
    }, { threshold: 0 }).observe(heroEl);
  }

  /* ---------- Projects carousel ---------- */
  var track = $('#work-track');
  if (track) {
    var prev = $('#work-prev');
    var next = $('#work-next');

    function step() {
      var card = track.querySelector('.card');
      if (!card) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card.getBoundingClientRect().width + gap;
    }

    function syncButtons() {
      var max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    }

    function scrollBy(dir) {
      track.scrollBy({ left: dir * step(), behavior: reduced ? 'auto' : 'smooth' });
      // Sync straight away rather than waiting on the scroll event, which does not
      // always land before the button is next painted.
      syncButtons();
      setTimeout(syncButtons, 420);
    }

    prev.addEventListener('click', function () { scrollBy(-1); });
    next.addEventListener('click', function () { scrollBy(1); });

    // Arrow keys work when the track itself has focus.
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollBy(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); scrollBy(-1); }
    });

    var scrollTick = false;
    track.addEventListener('scroll', function () {
      if (scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(function () { syncButtons(); scrollTick = false; });
    }, { passive: true });

    window.addEventListener('resize', syncButtons);
    syncButtons();

    // Tabbing to a card that is scrolled out of view should bring it into view.
    $$('.card', track).forEach(function (card) {
      card.addEventListener('focus', function () {
        card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      });
    });
  }

  /* ---------- Contact form ---------- */
  var form = $('#contact-form');
  if (form) {
    var status  = $('#form-status');
    var sendBtn = $('#form-submit');
    var done    = $('#form-done');
    var again   = $('#form-again');
    var EMAIL   = 'magistradozach@gmail.com';

    // Take over validation so the messages match the rest of the page.
    // Left to the browser when JS is unavailable.
    form.noValidate = true;

    var checks = [
      { id: 'f-name',  wrap: 'wrap-name',  err: 'err-name',
        test: function (v) { return v.trim().length > 0; },
        msg: 'Please enter your name.' },
      { id: 'f-email', wrap: 'wrap-email', err: 'err-email',
        test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
        msg: 'Please enter a valid email address so I can reply.' },
      { id: 'f-msg',   wrap: 'wrap-msg',   err: 'err-msg',
        test: function (v) { return v.trim().length > 0; },
        msg: 'Please write a message.' }
    ];

    function setFieldError(c, message) {
      var wrap = document.getElementById(c.wrap);
      var slot = document.getElementById(c.err);
      var input = document.getElementById(c.id);
      wrap.classList.toggle('invalid', !!message);
      slot.textContent = message || '';
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    function validate(focusFirst) {
      var firstBad = null;
      checks.forEach(function (c) {
        var input = document.getElementById(c.id);
        var bad = !c.test(input.value);
        setFieldError(c, bad ? c.msg : '');
        if (bad && !firstBad) firstBad = input;
      });
      if (firstBad && focusFirst) firstBad.focus();
      return !firstBad;
    }

    // Clear a field's error as soon as it becomes valid again.
    checks.forEach(function (c) {
      var input = document.getElementById(c.id);
      input.addEventListener('input', function () {
        if (c.test(input.value)) setFieldError(c, '');
      });
      input.addEventListener('blur', function () {
        if (input.value.trim()) setFieldError(c, c.test(input.value) ? '' : c.msg);
      });
    });

    function say(message, isError) {
      status.innerHTML = message;
      status.classList.toggle('is-error', !!isError);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      say('', false);

      if (!validate(true)) {
        say('Please fix the fields above and try again.', true);
        return;
      }

      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.hidden = true;
        done.hidden = false;
        done.querySelector('h3').focus && done.querySelector('h3').focus();
      }).catch(function () {
        say('That did not send. You can email me directly at ' +
            '<a href="mailto:' + EMAIL + '">' + EMAIL + '</a>.', true);
      }).then(function () {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send message';
      });
    });

    if (again) {
      again.addEventListener('click', function () {
        form.reset();
        checks.forEach(function (c) { setFieldError(c, ''); });
        say('', false);
        done.hidden = true;
        form.hidden = false;
        document.getElementById('f-name').focus();
      });
    }
  }

  /* ---------- Textarea autogrow ---------- */
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t && t.tagName === 'TEXTAREA') {
      t.style.height = 'auto';
      t.style.height = t.scrollHeight + 'px';
    }
  });

  /* ---------- Footer year ---------- */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
