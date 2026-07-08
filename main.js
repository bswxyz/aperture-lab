/* ============================================================
   Aperture Lab — interactions
   Progressive enhancement: page is fully readable without this file.
   ============================================================ */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = () => typeof window.gsap !== 'undefined';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- hero intro + reveals ---------- */
  const hero = document.querySelector('.hero');
  requestAnimationFrame(() => hero && hero.classList.add('loaded'));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---------- before / after compare ---------- */
  const stage = document.getElementById('compare');
  const raw = stage && stage.querySelector('.compare-raw');
  const handle = document.getElementById('handle');
  if (stage && raw && handle) {
    let pos = 50, dragging = false, idled = false;
    const set = (p) => {
      pos = clamp(p, 0, 100);
      raw.style.clipPath = `inset(0 ${100 - pos}% 0 0)`;
      handle.style.left = pos + '%';
      handle.setAttribute('aria-valuenow', Math.round(pos));
    };
    const fromEvent = (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      set((x / r.width) * 100);
    };
    const down = (e) => { dragging = true; idled = true; stage.setPointerCapture?.(e.pointerId ?? 1); fromEvent(e); };
    const move = (e) => { if (dragging) { fromEvent(e); e.preventDefault(); } };
    const up = () => { dragging = false; };
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    handle.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 3;
      if (e.key === 'ArrowLeft') { set(pos - step); e.preventDefault(); idled = true; }
      if (e.key === 'ArrowRight') { set(pos + step); e.preventDefault(); idled = true; }
      if (e.key === 'Home') { set(0); idled = true; }
      if (e.key === 'End') { set(100); idled = true; }
    });
    set(50);
    // gentle auto-demo drift until first interaction (skipped when reduced-motion)
    if (!reduce) {
      let t = 0; const drift = () => {
        if (idled) return;
        t += 0.012; set(50 + Math.sin(t) * 34);
        requestAnimationFrame(drift);
      };
      setTimeout(() => { if (!idled) requestAnimationFrame(drift); }, 1400);
    }
  }

  /* ---------- develop panel ---------- */
  const ADJ = [
    { key: 'exposure', name: 'Exposure', min: -100, max: 100, val: 0, unit: 'ev' },
    { key: 'contrast', name: 'Contrast', min: -100, max: 100, val: 0 },
    { key: 'shadows', name: 'Shadows', min: -100, max: 100, val: 0 },
    { key: 'saturation', name: 'Saturation', min: -100, max: 100, val: 0 },
    { key: 'warmth', name: 'Temperature', min: -100, max: 100, val: 0, unit: 'K' },
    { key: 'grain', name: 'Grain', min: 0, max: 100, val: 12 },
  ];
  const state = Object.fromEntries(ADJ.map(a => [a.key, a.val]));
  const panelImg = document.getElementById('panelImg');
  const slidersEl = document.getElementById('sliders');
  const presetPill = document.getElementById('presetPill');
  const grainEl = document.querySelector('.grain');

  const fmt = (a, v) => {
    if (a.unit === 'ev') return (v > 0 ? '+' : '') + (v / 100 * 2).toFixed(2);
    if (a.unit === 'K') return (v > 0 ? '+' : '') + Math.round(v * 40) + 'K';
    return (v > 0 ? '+' : '') + v;
  };
  const computeFilter = (s) => {
    const bright = 1 + s.exposure / 220 + Math.max(0, s.shadows) / 520;
    const contrast = 1 + s.contrast / 200 - Math.max(0, s.shadows) / 720;
    const sat = 1 + s.saturation / 150;
    const sepia = Math.max(0, s.warmth) / 240;
    const hue = -s.warmth / 11;
    return `brightness(${bright.toFixed(3)}) contrast(${clamp(contrast, .3, 2).toFixed(3)}) saturate(${clamp(sat, 0, 3).toFixed(3)}) sepia(${sepia.toFixed(3)}) hue-rotate(${hue.toFixed(1)}deg)`;
  };
  const apply = () => {
    if (panelImg) panelImg.style.filter = computeFilter(state);
    if (grainEl) grainEl.style.opacity = (0.02 + state.grain / 100 * 0.09).toFixed(3);
    const graded = Math.abs(state.exposure) + Math.abs(state.contrast) + Math.abs(state.saturation) + Math.abs(state.warmth) > 24;
    if (presetPill) presetPill.textContent = graded ? 'Developed · custom' : 'RAW · unprocessed';
    drawHisto();
  };

  const els = {};
  if (slidersEl) {
    slidersEl.innerHTML = '';
    for (const a of ADJ) {
      const row = document.createElement('div');
      row.className = 'slider';
      row.innerHTML = `<div class="slider-top"><label class="slider-name" for="s-${a.key}">${a.name}</label>
        <span class="slider-val" id="v-${a.key}">${fmt(a, a.val)}</span></div>
        <input id="s-${a.key}" type="range" min="${a.min}" max="${a.max}" value="${a.val}" aria-label="${a.name}">`;
      slidersEl.appendChild(row);
      const input = row.querySelector('input');
      const valEl = row.querySelector('.slider-val');
      els[a.key] = { input, valEl, meta: a };
      input.addEventListener('input', () => { state[a.key] = +input.value; valEl.textContent = fmt(a, state[a.key]); apply(); });
    }
  }
  const setState = (target, animate) => {
    const keys = Object.keys(target);
    if (animate && hasGSAP() && !reduce) {
      const proxy = { ...state };
      window.gsap.to(proxy, {
        duration: 0.9, ease: 'power3.out', ...target,
        onUpdate() {
          for (const k of keys) {
            state[k] = proxy[k];
            if (els[k]) { els[k].input.value = Math.round(state[k]); els[k].valEl.textContent = fmt(els[k].meta, Math.round(state[k])); }
          }
          apply();
        }
      });
    } else {
      for (const k of keys) { state[k] = target[k]; if (els[k]) { els[k].input.value = target[k]; els[k].valEl.textContent = fmt(els[k].meta, target[k]); } }
      apply();
    }
  };
  document.getElementById('autoBtn')?.addEventListener('click', () =>
    setState({ exposure: 10, contrast: 24, shadows: 16, saturation: 15, warmth: 22, grain: 42 }, true));
  document.getElementById('resetBtn')?.addEventListener('click', () =>
    setState({ exposure: 0, contrast: 0, shadows: 0, saturation: 0, warmth: 0, grain: 12 }, true));

  // press-and-hold to peek the flat/original
  const peek = document.getElementById('peek');
  if (peek && panelImg) {
    let saved = null;
    const show = () => { saved = panelImg.style.filter; panelImg.style.filter = 'saturate(.55) contrast(.82) brightness(1.08) sepia(.06) hue-rotate(-8deg)'; };
    const hide = () => { if (saved !== null) { panelImg.style.filter = saved; saved = null; } };
    peek.addEventListener('pointerdown', show); peek.addEventListener('pointerup', hide);
    peek.addEventListener('pointerleave', hide); peek.addEventListener('blur', hide);
    peek.tabIndex = 0;
    peek.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); show(); } });
    peek.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') hide(); });
  }

  /* ---------- histogram (illustrative, tied to settings) ---------- */
  const histo = document.getElementById('histo');
  let hctx = null, hw = 0, hh = 0;
  if (histo) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = histo.getBoundingClientRect();
    hw = histo.width = Math.max(120, rect.width) * dpr;
    hh = histo.height = Math.max(48, rect.height) * dpr;
    hctx = histo.getContext('2d');
  }
  function drawHisto() {
    if (!hctx) return;
    hctx.clearRect(0, 0, hw, hh);
    const shift = state.exposure / 100 * 0.22;
    const spread = 1 + state.contrast / 140;
    const cols = ['rgba(232,176,106,.7)', 'rgba(111,160,168,.55)'];
    for (let pass = 0; pass < 2; pass++) {
      hctx.beginPath();
      hctx.moveTo(0, hh);
      const mean = 0.5 + shift + (pass ? -0.06 : 0.04);
      for (let x = 0; x <= hw; x += 2) {
        const t = x / hw;
        const g = Math.exp(-Math.pow((t - mean) * (3.4 / spread), 2));
        const y = hh - g * hh * 0.92;
        hctx.lineTo(x, y);
      }
      hctx.lineTo(hw, hh); hctx.closePath();
      hctx.fillStyle = cols[pass]; hctx.fill();
    }
  }

  /* ---------- looks ---------- */
  const LOOKS = [
    { n: 'PORTRA', f: 'saturate(1.05) contrast(1.05) sepia(.12) hue-rotate(-6deg) brightness(1.03)', s: { exposure: 6, contrast: 8, shadows: 12, saturation: 6, warmth: 20, grain: 34 } },
    { n: 'NOIR', f: 'saturate(.18) contrast(1.22) brightness(.98)', s: { exposure: -4, contrast: 30, shadows: -10, saturation: -90, warmth: 0, grain: 50 } },
    { n: 'CINE 2383', f: 'saturate(.92) contrast(1.12) sepia(.06) hue-rotate(8deg) brightness(1.0)', s: { exposure: 2, contrast: 16, shadows: 20, saturation: -6, warmth: -14, grain: 40 } },
    { n: 'GOLDEN', f: 'saturate(1.2) contrast(1.04) sepia(.2) hue-rotate(-12deg) brightness(1.06)', s: { exposure: 12, contrast: 6, shadows: 18, saturation: 20, warmth: 40, grain: 28 } },
    { n: 'BLEACH', f: 'saturate(.6) contrast(1.16) brightness(1.08)', s: { exposure: 10, contrast: 20, shadows: -6, saturation: -40, warmth: 6, grain: 22 } },
    { n: 'FADE 78', f: 'saturate(.85) contrast(.9) sepia(.14) brightness(1.08)', s: { exposure: 8, contrast: -14, shadows: 30, saturation: -8, warmth: 16, grain: 46 } },
  ];
  const lookRow = document.getElementById('lookRow');
  if (lookRow) {
    LOOKS.forEach((lk, i) => {
      const b = document.createElement('button');
      b.className = 'look'; b.type = 'button'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', 'false');
      b.innerHTML = `<img src="./assets/frame.jpg" alt="Preview of the ${lk.n} look" loading="lazy" style="filter:${lk.f}"><span class="look-name">${lk.n}</span>`;
      b.addEventListener('click', () => {
        lookRow.querySelectorAll('.look').forEach(x => x.setAttribute('aria-selected', 'false'));
        b.setAttribute('aria-selected', 'true');
        setState(lk.s, true);
        document.getElementById('develop')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      });
      lookRow.appendChild(b);
    });
  }

  /* ---------- animated counters ---------- */
  const counters = document.querySelectorAll('.s-num');
  const cio = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target, to = parseFloat(el.dataset.to), dec = +(el.dataset.dec || 0);
      cio.unobserve(el);
      if (reduce) { el.textContent = to.toFixed(dec); continue; }
      const dur = 1200, t0 = performance.now();
      const tick = (t) => {
        const p = clamp((t - t0) / dur, 0, 1), e2 = 1 - Math.pow(1 - p, 3);
        el.textContent = (to * e2).toFixed(dec);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.5 });
  counters.forEach(c => cio.observe(c));

  /* ---------- film grain ---------- */
  const grain = document.querySelector('.grain');
  if (grain) {
    const gctx = grain.getContext('2d');
    const W = 320, H = 200; grain.width = W; grain.height = H;
    const render = () => {
      const img = gctx.createImageData(W, H);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      gctx.putImageData(img, 0, 0);
    };
    grain.style.imageRendering = 'pixelated';
    grain.style.width = '100%'; grain.style.height = '100%';
    grain.style.position = 'fixed'; grain.style.inset = '0';
    render();
    if (!reduce) {
      let last = 0;
      const loop = (t) => { if (t - last > 80) { render(); last = t; } requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }

  apply();
})();
