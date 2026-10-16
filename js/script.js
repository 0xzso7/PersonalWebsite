(function () {
  'use strict';

  /* ---------- Hero height ----------
     The hero fills the screen below the top bar; the bar wraps on phones, so measure it. */
  var bar = document.getElementById('bar');
  var setBar = function () { if (bar) document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px'); };
  setBar();
  window.addEventListener('resize', setBar);

  /* ---------- Phone menu ---------- */
  var menuBtn = document.getElementById('menu-btn');
  if (bar && menuBtn) {
    var setMenu = function (open) {
      bar.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    menuBtn.addEventListener('click', function (e) { e.stopPropagation(); setMenu(!bar.classList.contains('is-open')); });
    bar.querySelectorAll('.bar-links a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('click', function (e) { if (!bar.contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* ---------- Footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Noise field behind the intro ----------
     Draws repeated 0xzso7 on two canvases inside #noise:
       base: every character, painted once (and again only on resize or theme change);
       fx:   only the characters that are currently glowing or glitching.
     The fx layer is redrawn in a requestAnimationFrame loop that runs only while something is
     changing, so the page does no work at all while idle. Colours come from CSS (--noise-*). */
  (function noiseField() {
    var host = document.getElementById('noise');
    if (!host || !document.createElement('canvas').getContext) return;
    var hero = host.parentElement;
    var textBox = hero.querySelector('.intro-text');
    var TEXT = host.getAttribute('data-text') || '0xzso7';
    var RATE = parseFloat(host.getAttribute('data-glitch-rate')) || 14; // glitches per second at desktop size
    var FADE = 2000;                                                    // trail fade, ms
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    var base = document.createElement('canvas');
    var fx = document.createElement('canvas');
    host.appendChild(base);
    host.appendChild(fx);
    var bctx = base.getContext('2d');
    var fctx = fx.getContext('2d');

    // Grid state (typed arrays: one entry per character cell).
    var cols = 0, rows = 0, stepX = 0, lineH = 0, fontPx = 13, w = 0, h = 0;
    var chr, tier, fade, lit, gEnd, gKind;
    var trail = [];        // cells that are glowing
    var glitches = [];     // cells that are glitching
    var theme = {};
    var current = -1;      // cell under the pointer
    var lastX = null, lastY = null;
    var visible = true, raf = 0, glitchTimer = 0;
    var sprite = document.createElement('canvas');   // soft glow, pre-drawn once (cheaper than shadowBlur)
    var dirty = null;                                // area of the fx layer drawn last frame

    function readTheme() {
      var cs = getComputedStyle(host);
      theme.rgb = cs.getPropertyValue('--noise-rgb').trim();
      theme.alpha = cs.getPropertyValue('--noise-alpha').split(',').map(parseFloat);
      theme.hover = cs.getPropertyValue('--noise-hover').trim();
      theme.glow = cs.getPropertyValue('--noise-glow').trim();
    }

    // Deterministic 0..1 value per cell, so a rebuild keeps the same pattern.
    function hash(i, salt) {
      var x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
      return x - Math.floor(x);
    }
    function smooth(e0, e1, x) {
      var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    }

    function build() {
      w = hero.clientWidth; h = hero.clientHeight;
      if (!w || !h) return;
      readTheme();
      var small = w <= 640;
      fontPx = small ? 10 : 13;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      [base, fx].forEach(function (c) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); });
      [bctx, fctx].forEach(function (c) {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);   // resizing a canvas resets its state, so set it again
        c.font = fontPx + 'px "JetBrains Mono", ui-monospace, Menlo, monospace';
        c.textBaseline = 'middle';
      });
      stepX = bctx.measureText('0').width + fontPx * 0.04;
      var r = Math.round(fontPx * 0.9), sctx = sprite.getContext('2d');
      sprite.width = sprite.height = r * 2 * dpr;
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var g = sctx.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, theme.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.fillStyle = g; sctx.fillRect(0, 0, r * 2, r * 2);
      sprite.r = r;
      lineH = fontPx * 1.6;
      cols = Math.ceil(w / stepX); rows = Math.ceil(h / lineH);
      var n = cols * rows;
      chr = new Uint8Array(n); tier = new Uint8Array(n); fade = new Float32Array(n);
      lit = new Float32Array(n); gEnd = new Float64Array(n); gKind = new Uint8Array(n);
      trail = []; glitches = []; current = -1;

      // Thin the texture behind the name and lines with a soft oval (no edges, so it never reads
      // as a box or a shadow): about a fifth of the strength at the centre, full strength outside.
      var hb = hero.getBoundingClientRect(), tb = textBox ? textBox.getBoundingClientRect() : null;
      var ocx = tb ? (tb.left + tb.right) / 2 - hb.left : 0, ocy = tb ? (tb.top + tb.bottom) / 2 - hb.top : 0;
      var orx = tb ? tb.width / 2 + 220 : 1, ory = tb ? tb.height / 2 + 150 : 1;

      for (var y = 0; y < rows; y++) {
        var shift = (y * 4) % TEXT.length;
        var cy = y * lineH + lineH / 2;
        var fy = smooth(0, h * 0.18, cy) * (1 - smooth(h * 0.78, h, cy));
        for (var x = 0; x < cols; x++) {
          var i = y * cols + x, cx = x * stepX + stepX / 2;
          var fx_ = smooth(0, w * 0.08, cx) * (1 - smooth(w * 0.92, w, cx));
          var od = tb ? Math.hypot((cx - ocx) / orx, (cy - ocy) / ory) : 2;
          // On phones the text fills the width, so fade the texture harder behind it and overall.
          var clear = small ? (0.1 + 0.9 * smooth(0.55, 1.35, od)) * 0.45 : 0.22 + 0.78 * smooth(0.45, 1.25, od);
          chr[i] = (x + shift) % TEXT.length;
          tier[i] = Math.floor(hash(i, 1) * 4);
          fade[i] = fx_ * fy * clear;
        }
      }
      drawBase();
      fctx.clearRect(0, 0, w, h);
      dirty = null;
    }

    function cellX(i) { return (i % cols) * stepX; }
    function cellY(i) { return Math.floor(i / cols) * lineH + lineH / 2; }
    function baseAlpha(i) { return theme.alpha[tier[i]] * fade[i]; }

    function drawCellBase(i) {
      var a = baseAlpha(i);
      bctx.clearRect(cellX(i), cellY(i) - lineH / 2, stepX, lineH);
      if (a < 0.008) return;
      bctx.globalAlpha = a;
      bctx.fillText(TEXT.charAt(chr[i]), cellX(i), cellY(i));
    }
    function drawBase() {
      bctx.clearRect(0, 0, w, h);
      bctx.fillStyle = 'rgb(' + theme.rgb + ')';
      for (var i = 0; i < chr.length; i++) {
        var a = baseAlpha(i);
        if (a < 0.008) continue;
        bctx.globalAlpha = a;
        bctx.fillText(TEXT.charAt(chr[i]), cellX(i), cellY(i));
      }
      bctx.globalAlpha = 1;
    }

    /* ---- Cursor trail ---- */
    function light(px, py) {
      var x = Math.floor(px / stepX), y = Math.floor(py / lineH);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return -1;
      var i = y * cols + x;
      if (!lit[i]) trail.push(i);
      lit[i] = performance.now();   // time it was last lit
      return i;
    }
    function onMove(e) {
      if (!cols) return;
      var r = hero.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      // Fill in the cells between two pointer events so fast sweeps leave a continuous trail.
      if (lastX !== null) {
        var dx = x - lastX, dy = y - lastY, n = Math.ceil(Math.hypot(dx, dy) / (stepX * 0.8));
        for (var k = 1; k < n; k++) light(lastX + dx * k / n, lastY + dy * k / n);
      }
      current = light(x, y);
      lastX = x; lastY = y;
      kick();
    }
    function onLeave() { current = -1; lastX = lastY = null; kick(); }

    /* ---- Glitches ---- */
    function scheduleGlitch() {
      clearTimeout(glitchTimer);
      if (calm || !visible || document.hidden || !cols) return;
      var perSecond = RATE * (chr.length / 4000);
      glitchTimer = setTimeout(function () {
        for (var tries = 0; tries < 6; tries++) {
          var i = Math.floor(Math.random() * chr.length);
          if (fade[i] < 0.2 || gEnd[i]) continue;
          gEnd[i] = performance.now() + 80 + Math.random() * 90;   // 80–170ms
          gKind[i] = Math.floor(Math.random() * 4);                // shift, flicker, flash, swap
          glitches.push(i);
          bctx.clearRect(cellX(i), cellY(i) - lineH / 2, stepX, lineH);   // the fx layer draws it meanwhile
          kick();
          break;
        }
        scheduleGlitch();
      }, (1000 / Math.max(perSecond, 0.5)) * (0.4 + Math.random() * 1.2));
    }

    /* ---- Frame loop: only runs while something is glowing or glitching ---- */
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = 0;
      if (dirty) fctx.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1]);
      dirty = null;
      var busy = false, i, k, pad = sprite.r || 18;
      function mark(x, y) {
        if (!dirty) dirty = [x - pad, y - pad, x + stepX + pad, y + pad];
        else {
          if (x - pad < dirty[0]) dirty[0] = x - pad;
          if (y - pad < dirty[1]) dirty[1] = y - pad;
          if (x + stepX + pad > dirty[2]) dirty[2] = x + stepX + pad;
          if (y + pad > dirty[3]) dirty[3] = y + pad;
        }
      }

      // Trail: bright under the cursor, then dim, then dark over FADE ms.
      for (k = trail.length - 1; k >= 0; k--) {
        i = trail[k];
        if (i === current) lit[i] = now;
        var age = now - lit[i];
        var t = calm ? (i === current ? 0 : 1) : age / FADE;
        if (t >= 1) { lit[i] = 0; trail.splice(k, 1); continue; }
        var glow = Math.pow(1 - t, 2.2) * Math.max(fade[i], 0.3);
        var gx = cellX(i), gy = cellY(i);
        if (glow > 0.35) {   // only the brightest part of the trail gets a halo, so it never smears into a band
          fctx.globalAlpha = (glow - 0.35) * 1.2;
          fctx.drawImage(sprite, gx + stepX / 2 - pad, gy - pad, pad * 2, pad * 2);
        }
        fctx.globalAlpha = Math.max(glow, baseAlpha(i));
        fctx.fillStyle = theme.hover;
        fctx.fillText(TEXT.charAt(chr[i]), gx, gy);
        mark(gx, gy);
        if (i !== current || trail.length > 1) busy = true;
      }

      // Glitches: drawn on the fx layer, then the base cell is restored.
      for (k = glitches.length - 1; k >= 0; k--) {
        i = glitches[k];
        if (now >= gEnd[i]) { gEnd[i] = 0; glitches.splice(k, 1); drawCellBase(i); continue; }
        busy = true;
        if (lit[i]) continue;   // the trail is already drawing this cell
        var a = baseAlpha(i), x = cellX(i), y = cellY(i), ch = TEXT.charAt(chr[i]);
        mark(x, y);
        fctx.fillStyle = 'rgb(' + theme.rgb + ')';
        if (gKind[i] === 0) { fctx.globalAlpha = Math.min(1, a * 2.4); fctx.fillText(ch, x + 1.5, y); }
        else if (gKind[i] === 1) { if ((now / 40 | 0) % 2) { fctx.globalAlpha = a; fctx.fillText(ch, x, y); } }
        else if (gKind[i] === 2) { fctx.globalAlpha = Math.min(1, a * 4); fctx.fillText(ch, x, y); }
        else { fctx.globalAlpha = Math.min(1, a * 2); fctx.fillText(TEXT.charAt((chr[i] + 3) % TEXT.length), x, y); }
      }
      fctx.globalAlpha = 1;
      if (busy) kick();
    }

    /* ---- Lifecycle ---- */
    function start() {
      build();
      hero.addEventListener('pointermove', onMove, { passive: true });
      hero.addEventListener('pointerleave', onLeave, { passive: true });
      scheduleGlitch();
    }
    if (document.fonts && document.fonts.load) {
      document.fonts.load('13px "JetBrains Mono"').then(start, start);
    } else {
      start();
    }

    var resizeTimer = 0, lastW = 0, lastH = 0;
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        if (hero.clientWidth === lastW && hero.clientHeight === lastH) return;
        lastW = hero.clientWidth; lastH = hero.clientHeight;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { build(); scheduleGlitch(); }, 150);
      }).observe(hero);
    }
    if (window.matchMedia) {
      var dark = matchMedia('(prefers-color-scheme: dark)');
      var onTheme = function () { build(); };
      if (dark.addEventListener) dark.addEventListener('change', onTheme); else if (dark.addListener) dark.addListener(onTheme);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        scheduleGlitch();
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', scheduleGlitch);
  })();

  /* ---------- Portrait slot ----------
     Shows the ZM monogram until Assets/images/portrait.jpg exists. The image can fail before this
     deferred script runs, so check its state as well as listening for the event. */
  var portrait = document.getElementById('portrait');
  if (portrait) {
    var img = portrait.querySelector('img');
    var empty = function () { portrait.classList.add('is-empty'); };
    if (!img || (img.complete && img.naturalWidth === 0)) empty();
    else img.addEventListener('error', empty);
  }

  /* ---------- Reveal on scroll ---------- */
  var items = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });
})();
