// Small progressive enhancements. Everything works without JavaScript.

// Safari (iOS 16 and 17) ignores a smooth scroll on a row that snaps, so arrows let go of the snap while it moves
window.glideTo = (el, left, smooth) => {
  if (!smooth) { el.scrollLeft = left; return; }
  el.style.scrollSnapType = 'none';
  el.scrollTo({ left, behavior: 'smooth' });
  clearTimeout(el._glide);
  el._glide = setTimeout(() => { el.style.scrollSnapType = ''; }, 700);
};
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Header gets a dashed line once the page scrolls
  const top = document.querySelector('.top');
  const onScroll = () => top && top.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Light / dark switch, remembered between visits
  const toggle = document.querySelector('.theme-toggle');
  const sync = () => {
    const dark = root.dataset.theme === 'dark';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  };
  if (toggle) {
    sync();
    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      const apply = () => {
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch (e) {}
        sync();
      };
      // A circle of the new theme grows out of the switch (where supported)
      if (!document.startViewTransition || reduce) return apply();
      const r = toggle.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.classList.add('theme-vt');
      const vt = document.startViewTransition(apply);
      vt.finished.then(() => root.classList.remove('theme-vt'), () => root.classList.remove('theme-vt'));
      vt.ready.then(() => {
        root.animate({ clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
          { duration: 550, easing: 'cubic-bezier(.2,.7,.2,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(() => {});
      vt.finished.catch(() => {});
    });
  }

  // V8: leaving for another page fades the content out first, so the next page's fade-in follows on smoothly
  if (document.body.classList.contains('v8') && !reduce) {
    document.addEventListener('click', ev => {
      const a = ev.target.closest && ev.target.closest('a[href]');
      if (!a || ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const to = new URL(a.href, location.href);
      if (to.origin !== location.origin || (to.pathname === location.pathname && to.search === location.search)) return;
      ev.preventDefault();
      document.documentElement.classList.add('v8-leaving');
      const back = a.hasAttribute('data-back') && document.referrer.startsWith(location.origin);
      setTimeout(() => { if (back) history.back(); else location.href = to.href; }, 160);
    });
    // Fetch a page as soon as the pointer or finger reaches its link, so it opens straight away
    const fetched = new Set([location.pathname]);
    const prefetch = ev => {
      const a = ev.target.closest && ev.target.closest('a[href]');
      if (!a) return;
      const to = new URL(a.href, location.href);
      if (to.origin !== location.origin || fetched.has(to.pathname)) return;
      fetched.add(to.pathname);
      const hint = document.createElement('link');
      hint.rel = 'prefetch';
      hint.href = to.pathname;
      document.head.append(hint);
    };
    document.addEventListener('pointerover', prefetch, { passive: true });
    document.addEventListener('touchstart', prefetch, { passive: true });
    addEventListener('pageshow', () => document.documentElement.classList.remove('v8-leaving'));  // coming back with the browser's back button
  }

  // Hero headline: split into words so they can rise in one by one
  document.querySelectorAll('.h0').forEach(h => {
    if (reduce || h.dataset.split) return;
    h.dataset.split = '1';
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = h.textContent.trim().split(/\s+/).map((w, i) => `<span class="w" aria-hidden="true" style="--i:${i}">${w}</span>`).join(' ');
  });

  // Images fade in once loaded
  document.querySelectorAll('.phone img, .sketch, .part__img img').forEach(img => {
    const done = () => img.classList.add('is-loaded');
    if (img.complete && img.naturalWidth) done(); else { img.addEventListener('load', done); img.addEventListener('error', done); }
  });

  // Chapter titles take part in the scroll reveal
  document.querySelectorAll('.chapter .h1, .chapter > .h2').forEach(h => h.classList.add('reveal-title'));

  // Groups reveal their children one after another
  document.querySelectorAll('.stagger').forEach(g => {
    [...g.children].forEach((c, i) => { c.style.setProperty('--i', i); c.classList.remove('reveal'); });
    g.classList.add('reveal');
  });

  // Gentle reveal on scroll
  const reveals = document.querySelectorAll('.reveal, .reveal-title');
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  }

  // Screen recordings: play only while on screen. With reduced motion, show controls instead.
  const videos = document.querySelectorAll('video[data-autoplay]');
  if (reduce) {
    videos.forEach(v => { v.controls = true; });
  } else if ('IntersectionObserver' in window) {
    const vio = new IntersectionObserver(entries => entries.forEach(en => {
      // if the phone refuses to autoplay (Low Power Mode), show the play button instead of a still screen
      if (en.isIntersecting) { if (en.target.dataset.user !== 'paused') en.target.play().catch(() => en.target.parentElement.classList.add('is-paused')); }
      else en.target.pause();
    }), { threshold: 0.4 });
    videos.forEach(v => vio.observe(v));
    // a recording downloads only when you are close to it, so a page with many opens fast
    const near = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.preload = 'auto'; near.unobserve(en.target); }
    }), { rootMargin: '800px 0px' });
    videos.forEach(v => near.observe(v));
  }
  // Flow rails: drag with the mouse, step with buttons, show progress
  document.querySelectorAll('.flow').forEach(flow => {
    const rail = flow.querySelector('.rail');
    const bar = flow.querySelector('.rail__bar span');
    const [prev, next] = flow.querySelectorAll('.nav-btn');
    if (!rail) return;
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      const ratio = rail.clientWidth / rail.scrollWidth;
      const p = max > 0 ? rail.scrollLeft / max : 0;
      if (bar) {
        bar.style.setProperty('--w', (ratio * 100).toFixed(2) + '%');
        bar.style.setProperty('--x', (p * (1 / ratio - 1) * 100).toFixed(2) + '%');
      }
      if (prev) prev.disabled = rail.scrollLeft < 4;
      if (next) next.disabled = rail.scrollLeft > max - 4;
      rail.classList.toggle('is-end', rail.scrollLeft > max - 4);
    };
    // phones show one screen at a time, so an arrow moves one screen; wider screens move two
    // phones move one screen per tap, wider screens two
    const step = () => {
      const s = rail.querySelector('.step');
      const one = (s?.offsetWidth || 240) + parseFloat(getComputedStyle(s?.parentElement || rail).columnGap || 0);
      return innerWidth <= 760 ? one : one * 2;
    };
    const go = (d) => { window.glideTo(rail, Math.max(0, Math.min(rail.scrollWidth - rail.clientWidth, rail.scrollLeft + d * step())), !reduce); setTimeout(update, 750); };
    prev && prev.addEventListener('click', () => go(-1));
    next && next.addEventListener('click', () => go(1));
    rail.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();

    // mouse drag (touch already scrolls natively)
    let down = false, startX = 0, startLeft = 0, moved = false;
    rail.addEventListener('pointerdown', ev => {
      if (ev.pointerType !== 'mouse' || ev.target.closest('.cmp__range')) return;
      down = true; moved = false; startX = ev.clientX; startLeft = rail.scrollLeft;
    });
    window.addEventListener('pointermove', ev => {
      if (!down) return;
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > 4) { moved = true; rail.classList.add('is-dragging'); }
      rail.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false; rail.classList.remove('is-dragging');
    });
    rail.addEventListener('click', ev => { if (moved) ev.preventDefault(); }, true);
    // keyboard: arrow keys when the rail is focused
    rail.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); next && next.click(); }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); prev && prev.click(); }
    });
  });

  // Before / after slider
  document.querySelectorAll('.cmp').forEach(cmp => {
    const range = cmp.querySelector('.cmp__range');
    range.addEventListener('input', () => cmp.style.setProperty('--pos', range.value + '%'));
  });

  // Numbers count up once when they come into view
  const counters = document.querySelectorAll('[data-count]');
  if (!reduce && 'IntersectionObserver' in window) {
    const cio = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, end = +el.dataset.count, t0 = performance.now();
      const tick = t => {
        const k = Math.min(1, (t - t0) / 900);
        el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      cio.unobserve(el);
    }), { threshold: 0.6 });
    counters.forEach(c => cio.observe(c));
  }

  // Contents sidebar: highlight the chapter on screen; collapsible on small screens
  const contents = document.querySelector('.contents');
  if (contents) {
    const links = [...contents.querySelectorAll('a')];
    const secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const pill = document.createElement('span');
    pill.className = 'contents__pill';
    pill.setAttribute('aria-hidden', 'true');
    contents.querySelector('ol').prepend(pill);
    // the current chapter is the last one whose top has passed 35% of the screen
    let ticking = false;
    const mark = () => {
      ticking = false;
      const line = innerHeight * 0.35;
      let cur = secs[0];
      for (const sec of secs) { if (sec.getBoundingClientRect().top <= line) cur = sec; }
      links.forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + cur.id ? 'true' : 'false'));
      const on = links.find(a => a.getAttribute('aria-current') === 'true');
      if (on && pill) { pill.style.transform = `translateY(${on.offsetTop}px)`; pill.style.height = on.offsetHeight + 'px'; }
    };
    // the list stays out of the way until the first chapter reaches the middle of the screen
    const reveal = () => contents.classList.toggle('is-shown', secs[0].getBoundingClientRect().top <= innerHeight * 0.5);
    let revealing = false;
    window.addEventListener('scroll', () => { if (!revealing) { revealing = true; requestAnimationFrame(() => { revealing = false; reveal(); }); } }, { passive: true });
    reveal();
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
    mark();
    const btn = contents.querySelector('.contents__toggle');
    const close = () => { contents.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', () => btn.setAttribute('aria-expanded', String(contents.classList.toggle('is-open'))));
    links.forEach(a => a.addEventListener('click', close));
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && contents.classList.contains('is-open')) { close(); btn.focus(); } });
    // Touch screens wide enough for the side rail (iPad landscape) can't hover it open:
    // the first tap opens the list, a tap on a chapter goes there, a tap elsewhere closes it
    if (matchMedia('(hover: none)').matches) {
      const rail = () => matchMedia('(min-width: 1100px)').matches;
      contents.addEventListener('click', ev => {
        const a = ev.target.closest('a');
        if (!a || !rail()) return;
        if (!contents.classList.contains('is-rail')) { ev.preventDefault(); contents.classList.add('is-rail'); return; }
        contents.classList.remove('is-rail');
      }, true);
      document.addEventListener('click', ev => {
        if (!contents.contains(ev.target)) contents.classList.remove('is-rail');
      });
    }
  }

  // Hero screens drift a little as you scroll past them
  const drift = [...document.querySelectorAll('.showcase .row5 .phone, .cover .row5 .phone')];
  if (drift.length && !reduce) {
    let pending = false;
    const move = () => {
      pending = false;
      drift.forEach((ph, i) => {
        const r = ph.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        ph.style.translate = `0 ${(k * (i % 2 ? 18 : -12)).toFixed(1)}px`;
      });
    };
    window.addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(move); } }, { passive: true });
    move();
  }

  // Play / pause buttons on screen recordings
  document.querySelectorAll('.vid-toggle').forEach(b => {
    const v = b.parentElement.querySelector('video');
    const sync = () => { const paused = v.paused; b.textContent = paused ? '▶' : '❚❚'; b.setAttribute('aria-label', paused ? 'Play video' : 'Pause video'); };
    b.addEventListener('click', () => { if (v.paused) { v.dataset.user = ''; v.play().catch(() => {}); } else { v.dataset.user = 'paused'; v.pause(); } });
    v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
  });

  // Sketch lightbox (links still open the image directly without JS)
  const boxLinks = document.querySelectorAll('[data-lightbox]');
  if (boxLinks.length && window.HTMLDialogElement) {
    const dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.innerHTML = '<button type="button" aria-label="Close">×</button><img alt="">';
    document.body.appendChild(dlg);
    const img = dlg.querySelector('img');
    dlg.querySelector('button').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });
    boxLinks.forEach(a => a.addEventListener('click', ev => {
      ev.preventDefault();
      img.src = a.href;
      img.alt = a.querySelector('img')?.alt || '';
      dlg.showModal();
    }));
  }

  // ---------------------------------------------------------------- home
  // Motion here only responds to the visitor; nothing holds the page or changes the scroll direction.
  if (document.body.classList.contains('is-home')) {
    const desk = window.matchMedia('(min-width: 900px)');
    const cvWrap = document.querySelector('.s-cv__line-wrap');
    const cvItems = [...document.querySelectorAll('.s-cv__item')];
    const floaters = [...document.querySelectorAll('[data-speed]')];
    let ticking = false;

    const frame = () => {
      ticking = false;
      if (cvWrap) {
        const line = innerHeight * 0.62, r = cvWrap.getBoundingClientRect();
        cvWrap.style.setProperty('--lp', reduce ? 1 : Math.min(1, Math.max(0, (line - r.top) / r.height)).toFixed(3));
        cvItems.forEach(it => it.classList.toggle('is-on', reduce || it.getBoundingClientRect().top < line));
      }
      if (!reduce && desk.matches) floaters.forEach(f => {
        const r = f.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) return;
        f.style.setProperty('--sy', ((r.top + r.height / 2 - innerHeight / 2) * +f.dataset.speed).toFixed(1) + 'px');
      });
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    frame();

    // the about statement rises word by word
    document.querySelectorAll('.s-about__statement').forEach(s => {
      if (reduce) return;
      s.setAttribute('aria-label', s.textContent.trim());
      s.innerHTML = s.textContent.trim().split(/\s+/).map((w, i) => `<span class="w" aria-hidden="true" style="--i:${i}">${w}</span>`).join(' ');
    });

    // the menu shows which part of the page you're in
    const navLinks = [...document.querySelectorAll('.top__nav a')];
    const map = { work: '/design-portfolio/#work', explorations: '/design-portfolio/#work', about: '/design-portfolio/#about', resume: '/design-portfolio/#resume', contact: '/design-portfolio/#contact' };
    if ('IntersectionObserver' in window) {
      const nio = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        navLinks.forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === map[en.target.id] ? 'true' : 'false'));
      }), { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(id => { const el = document.getElementById(id); el && nio.observe(el); });
    }
  }

  // Buttons lean a few pixels towards the cursor
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.btn').forEach(b => {
      b.addEventListener('pointermove', ev => {
        const r = b.getBoundingClientRect();
        const x = (ev.clientX - r.left - r.width / 2) / r.width, y = (ev.clientY - r.top - r.height / 2) / r.height;
        b.style.translate = `${(x * 8).toFixed(1)}px ${(y * 6).toFixed(1)}px`;
      });
      b.addEventListener('pointerleave', () => { b.style.translate = ''; });
    });
  }

  // Cards catch a soft light where the cursor is
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', ev => {
      const card = ev.target.closest && ev.target.closest('.spot');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      card.style.setProperty('--my', (ev.clientY - r.top) + 'px');
    }, { passive: true });
  }

  // Design system window: tabs switch panels (click, arrow keys, Home/End)
  document.querySelectorAll('.dsx').forEach(box => {
    const tabs = [...box.querySelectorAll('[role="tab"]')];
    const select = (t, focus) => {
      tabs.forEach(x => {
        const on = x === t;
        x.setAttribute('aria-selected', String(on));
        x.tabIndex = on ? 0 : -1;
        box.querySelector('#' + x.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) t.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', ev => {
        const n = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[ev.key];
        if (n === undefined) return;
        ev.preventDefault();
        select(tabs[(n + tabs.length) % tabs.length], true);
      });
    });
  });

  // Header statement: grey words turn black, one by one, as the page scrolls (normal scrolling, nothing held)
  const statement = document.querySelector('.r-hero__text');
  if (statement && !reduce) {
    const rest = [...statement.querySelectorAll('.r-w:not(.r-on)')];
    let queued = false;
    const paint = () => {
      queued = false;
      // starts grey at the top; every word is black after scrolling about 80% of the statement's height
      const p = Math.min(1, Math.max(0, scrollY / (statement.offsetHeight * 0.8)));
      const n = Math.round(p * rest.length);
      rest.forEach((w, i) => w.classList.toggle('r-lit', i < n));
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  }
})();

// V1 hero: a sideways row of screens; the closer a screen is to the middle, the larger it is
(() => {
  const strip = document.querySelector('.m-strip');
  if (!strip) return;
  const slides = [...strip.children];
  let ticking = false;
  const paint = () => {
    ticking = false;
    const mid = strip.getBoundingClientRect().left + strip.clientWidth / 2;
    slides.forEach(s => {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid) / (r.width * 1.3);  // 0 in the middle, 1 one slot away
      s.firstElementChild.style.setProperty('--k', Math.max(0, 1 - d).toFixed(3));
    });
  };
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
  const go = (el, smooth) => strip.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - strip.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' });
  const current = () => slides.reduce((best, s) => Math.abs(s.offsetLeft + s.offsetWidth / 2 - strip.scrollLeft - strip.clientWidth / 2) <
    Math.abs(best.offsetLeft + best.offsetWidth / 2 - strip.scrollLeft - strip.clientWidth / 2) ? s : best);
  const start = () => { go(strip.querySelector('.is-start') || slides[0], false); paint(); };
  start();
  addEventListener('load', start, { once: true });
  addEventListener('resize', queue);
  strip.addEventListener('scroll', queue, { passive: true });
  document.querySelectorAll('.m-flow__btn').forEach(b => b.addEventListener('click', () => {
    const i = slides.indexOf(current()) + Number(b.dataset.dir);
    if (slides[i]) go(slides[i], true);
  }));
  // mouse drag; a click without dragging brings that screen to the middle
  let x0 = 0, s0 = 0, down = false, moved = false;
  strip.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'mouse') return; down = true; moved = false; x0 = ev.clientX; s0 = strip.scrollLeft; });
  addEventListener('pointermove', ev => {
    if (!down) return;
    if (Math.abs(ev.clientX - x0) > 4) { moved = true; strip.classList.add('is-drag'); }
    if (moved) strip.scrollLeft = s0 - (ev.clientX - x0);
  });
  addEventListener('pointerup', ev => {
    if (!down) return;
    down = false;
    if (moved) { const c = current(); strip.classList.remove('is-drag'); go(c, true); return; }
    const hit = ev.target.closest('.m-slide');
    if (hit) go(hit, true);
  });
})();

// V2: headings drift out of a blur, the hero flies into the clouds, and soft puffs follow the cursor
(() => {
  if (!document.body.classList.contains('v2')) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heads = document.querySelectorAll('.s-proj__title, .s-play__title, .s-cv__title, .s-foot__title, .s-tile__title');
  heads.forEach(h => {
    const t = h.textContent.trim();
    h.setAttribute('aria-label', t);
    h.innerHTML = t.split(/\s+/).map((w, i) => `<span class="bw" aria-hidden="true" style="--i:${i}">${w}</span>`).join(' ');
    h.classList.add('blur-in');
  });
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -12% 0px' });
  heads.forEach(h => io.observe(h));

  const hero = document.querySelector('.r-hero');
  if (!hero || still) return;
  let busy = false;
  const fly = () => { busy = false; hero.style.setProperty('--fly', Math.min(1, scrollY / hero.offsetHeight).toFixed(3)); };
  addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(fly); } }, { passive: true });
  let lx = 0, ly = 0;
  hero.addEventListener('pointermove', ev => {
    if (ev.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', ((ev.clientX - r.left) / r.width * 2 - 1).toFixed(3));
    hero.style.setProperty('--my', ((ev.clientY - r.top) / r.height * 2 - 1).toFixed(3));
    if (Math.hypot(ev.clientX - lx, ev.clientY - ly) < 28) return;
    lx = ev.clientX; ly = ev.clientY;
    const p = document.createElement('span');
    p.className = 'puff';
    p.style.left = ev.clientX - r.left + 'px';
    p.style.top = ev.clientY - r.top + 'px';
    hero.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  });
})();

// V3: titles rise letter by letter, hero clouds part as you scroll, a crisp cursor follows the mouse
(() => {
  if (!document.body.classList.contains('v3')) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const titles = document.querySelectorAll('.s-proj__title, .s-play__title, .s-cv__title, .s-foot__title, .s-tile__title');
  titles.forEach(t => {
    const text = t.textContent.trim();
    let i = 0;
    t.setAttribute('aria-label', text);
    t.innerHTML = text.split(/\s+/).map(w => {
      const alpha = [...w].map((c, k) => /\p{L}/u.test(c) ? k : -1).filter(k => k >= 0);
      const pick = alpha.length >= 4 ? alpha[Math.floor(alpha.length / 2)] : -1;
      const html = [...w].map((c, k) => `<span class="ch${k === pick ? ' it' : ''}" style="--i:${i + k}">${c}</span>`).join('');
      i += w.length;
      return `<span class="cw" aria-hidden="true">${html}</span>`;
    }).join(' ');
    t.classList.add('rise');
  });
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -10% 0px' });
  titles.forEach(t => io.observe(t));
  if (still) return;

  const hero = document.querySelector('.c-hero');
  let busy = false;
  const part = () => { busy = false; if (hero) hero.style.setProperty('--fly', Math.min(1, scrollY / hero.offsetHeight).toFixed(3)); };
  addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(part); } }, { passive: true });

})();

// V4: the glass folder tilts gently toward the cursor
(() => {
  const folder = document.querySelector('.g-folder');
  if (!folder || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const zone = folder.closest('.g-hero');
  zone.addEventListener('pointermove', ev => {
    const r = folder.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width - .5, y = (ev.clientY - r.top) / r.height - .5;
    folder.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
    folder.style.setProperty('--rx', (y * -6).toFixed(2) + 'deg');
  });
  zone.addEventListener('pointerleave', () => { folder.style.setProperty('--rx', '0deg'); folder.style.setProperty('--ry', '0deg'); });
})();

// V5: push the desk objects around; the little switch flips
(() => {
  const board = document.querySelector('.k-board');
  if (!board) return;
  board.querySelectorAll('.k-drag').forEach(el => {
    let sx = 0, sy = 0, dx = 0, dy = 0, moved = false;
    el.addEventListener('pointerdown', ev => {
      el.setPointerCapture(ev.pointerId);
      sx = ev.clientX - dx; sy = ev.clientY - dy; moved = false;
      el.classList.add('is-held');
    });
    el.addEventListener('pointermove', ev => {
      if (!el.classList.contains('is-held')) return;
      dx = ev.clientX - sx; dy = ev.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');
    });
    const drop = () => el.classList.remove('is-held');
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);
    if (el.classList.contains('k-toggle')) el.addEventListener('click', () => { if (!moved) el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); });
  });
})();

// V6: pixel headings print themselves in as they come into view
(() => {
  if (!document.body.classList.contains('v6') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const heads = document.querySelectorAll('.s-play__title, .s-cv__title, .s-foot__title');
  heads.forEach(h => h.classList.add('px'));
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -10% 0px' });
  heads.forEach(h => io.observe(h));
})();

// V7: buttons lean toward the cursor, the photo says hi when tapped
(() => {
  if (!document.body.classList.contains('v7')) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const photo = document.querySelector('.c7-photo');
  if (photo) photo.addEventListener('click', () => { photo.classList.remove('is-on'); void photo.offsetWidth; photo.classList.add('is-on'); setTimeout(() => photo.classList.remove('is-on'), 1800); });
  if (still) return;
  if (!fine) return;
  document.querySelectorAll('.c7-ctas .btn').forEach(b => {
    b.addEventListener('pointermove', ev => {
      const r = b.getBoundingClientRect();
      b.style.setProperty('--bx', ((ev.clientX - r.left - r.width / 2) * .15).toFixed(1) + 'px');
      b.style.setProperty('--by', ((ev.clientY - r.top - r.height / 2) * .25).toFixed(1) + 'px');
    });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--bx', '0px'); b.style.setProperty('--by', '0px'); });
  });
})();

// V7: the closing section and the resume rows animate in once, when they come into view
(() => {
  if (!document.body.classList.contains('v7')) return;
  const targets = [document.querySelector('.c7-foot'), document.querySelector('.s-cv__list'), document.querySelector('.s-about')].filter(Boolean);
  document.querySelectorAll('.s-cv__group').forEach((g, i) => g.style.setProperty('--gi', i));
  if (!('IntersectionObserver' in window)) { targets.forEach(t => t.classList.add('is-in')); return; }
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { threshold: .15 });
  targets.forEach(t => io.observe(t));
})();

// V7 on phones: the menu button opens and closes the links
(() => {
  const btn = document.querySelector('.c7-menu');
  if (!btn) return;
  const bar = btn.closest('.top');
  const set = open => { bar.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', open); btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  bar.querySelectorAll('.top__nav a').forEach(a => a.addEventListener('click', () => set(false)));
  addEventListener('keydown', ev => { if (ev.key === 'Escape') set(false); });
  addEventListener('click', ev => { if (!bar.contains(ev.target)) set(false); });
})();

// V7 case-study showcase: scroll progress through the section picks the one project on screen.
// Scrolling itself is never intercepted; the frame is pinned with CSS (position: sticky).
(() => {
  const show = document.querySelector('.c7-show');
  if (!show) return;
  const items = [...show.querySelectorAll('.s-work')];
  const dots = [...show.querySelectorAll('.c7-show__dot')];
  const count = show.querySelector('.c7-show__count');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || items.length < 2) { show.classList.add('is-static'); return; }
  const pad = n => String(n).padStart(2, '0');
  let current = -1;
  const setActive = i => {
    if (i === current) return;
    current = i;
    items.forEach((el, k) => {
      el.classList.toggle('is-active', k === i);
      el.classList.toggle('is-past', k < i);
      el.inert = k !== i;
      el.setAttribute('aria-hidden', k !== i ? 'true' : 'false');
    });
    dots.forEach((d, k) => d.classList.toggle('is-on', k === i));
    if (count) count.textContent = `${pad(i + 1)} / ${pad(items.length)}`;
  };
  let busy = false;
  const update = () => {
    busy = false;
    const range = show.offsetHeight - innerHeight;
    const p = range > 0 ? Math.min(.9999, Math.max(0, -show.getBoundingClientRect().top / range)) : 0;
    setActive(Math.floor(p * items.length));
  };
  addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  // the dots jump to a project's part of the scroll, using normal smooth scrolling
  dots.forEach(d => d.addEventListener('click', () => {
    const range = show.offsetHeight - innerHeight;
    const top = show.getBoundingClientRect().top + scrollY + (Number(d.dataset.i) + .5) * range / items.length;
    scrollTo({ top, behavior: 'smooth' });
  }));
  update();
})();

// V8: each case study rises into place as you scroll to it, eased so it glides between scroll steps
(() => {
  const items = [...document.querySelectorAll('.c8-cases .s-proj')].map((el) => ({ el, box: el.querySelector('.s-proj__in') || el, now: 0, to: 0 }));
  if (!items.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const paint = (it) => it.el.style.setProperty('--up', (it.now * it.now * (3 - 2 * it.now)).toFixed(4));
  const measure = () => items.forEach((it) => {
    const top = it.box.getBoundingClientRect().top;
    it.to = Math.max(0, Math.min(1, (innerHeight - top) / (innerHeight * .65)));  // starts at the bottom edge, done when its top is 35% down the window
  });
  let raf = 0;
  const tick = () => {
    let moving = false;
    measure();
    items.forEach((it) => {
      it.now += (it.to - it.now) * .09;
      if (Math.abs(it.to - it.now) < .001) it.now = it.to;
      else moving = true;
      paint(it);
    });
    raf = moving ? requestAnimationFrame(tick) : 0;
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  measure();
  items.forEach((it) => { it.now = it.to; paint(it); });
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', wake);
})();

/* Survey findings: the bubble changes slowly, with the next one coming from behind */
document.querySelectorAll(".chat8__feature").forEach((deck) => {
  const slides = [...deck.querySelectorAll(".chat8__slide")];
  const dots = deck.querySelectorAll(".chat8__dot");
  const faces = deck.querySelectorAll(".chat8__orbit");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let at = 0, timer = 0, stopped = still, inView = false;
  const show = (i) => {
    at = (i + slides.length) % slides.length;
    slides.forEach((s, n) => {
      const pos = (n - at + slides.length) % slides.length;
      s.dataset.pos = pos === 0 ? 0 : pos === 1 ? 1 : 2;
      s.setAttribute("aria-hidden", pos !== 0);
    });
    dots.forEach((d, n) => d.classList.toggle("is-on", n === at));
    faces.forEach((f, n) => f.classList.toggle("is-on", n === at));
  };
  const halt = () => { clearInterval(timer); timer = 0; };
  const run = () => { halt(); if (!stopped && inView && !document.hidden) timer = setInterval(() => show(at + 1), 3000); };
  dots.forEach((d, n) => d.addEventListener("click", () => { show(n); run(); }));
  deck.addEventListener("focusin", halt);
  deck.addEventListener("focusout", run);
  document.addEventListener("visibilitychange", run);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; run(); }, { threshold: 0.2 }).observe(deck);
  let startX = null;
  const track = deck.querySelector(".chat8__track");
  track.addEventListener("pointerdown", (e) => { startX = e.clientX; });
  track.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const moved = e.clientX - startX;
    startX = null;
    if (Math.abs(moved) > 40) { show(at + (moved < 0 ? 1 : -1)); run(); }
  });
  show(0);
});

/* The goal: words turn from grey to black as it scrolls through the window */
(() => {
  const line = document.querySelector('.v8 #goal .quote p');
  if (!line || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const text = line.textContent.trim();
  line.setAttribute('aria-label', text);
  line.innerHTML = text.split(/\s+/).map((w) => `<span class="goal8__word" aria-hidden="true">${w}</span>`).join(' ');
  const words = [...line.children];
  let busy = false;
  const paint = () => {
    busy = false;
    const box = line.getBoundingClientRect();
    const start = innerHeight * 0.9;
    const end = innerHeight * 0.45;
    const done = Math.min(1, Math.max(0, (start - box.top) / (start - end)));
    const reach = done * (words.length + 3);
    words.forEach((w, i) => { w.style.opacity = 0.22 + 0.78 * Math.min(1, Math.max(0, (reach - i) / 3)); });
  };
  addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(paint); } }, { passive: true });
  addEventListener('resize', paint);
  paint();
})();

/* Personas: swipe or use the arrows, with a 1/2 counter */
(() => {
  const nav = document.querySelector('.persona8__nav');
  const track = document.querySelector('#persona .persona-set');
  if (!nav || !track) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const count = nav.querySelector('.persona8__count');
  const [prev, next] = nav.querySelectorAll('[data-step]');
  const total = track.children.length;
  let cur = 0;
  const show = (i) => {
    cur = i;
    count.textContent = `${i + 1} / ${total}`;
    nav.querySelectorAll('.persona8__bar').forEach((b, n) => b.classList.toggle('is-on', n === i));
    prev.disabled = i === 0;
    next.disabled = i === total - 1;
  };
  // an arrow sets the persona straight away, so it never waits on a scroll event Safari may not send
  [prev, next].forEach((b) => b.addEventListener('click', () => {
    const i = Math.max(0, Math.min(total - 1, cur + Number(b.dataset.step)));
    show(i);
    window.glideTo(track, i * track.clientWidth, !still);
  }));
  // a swipe updates it from where the row comes to rest
  let t;
  track.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => show(Math.round(track.scrollLeft / track.clientWidth)), 120); }, { passive: true });
  show(0);
})();

/* Navigation: scrolling down morphs the pill into a go-to-top circle; scrolling up brings it back */
(() => {
  const bar = document.querySelector('.v8 .top__inner');
  if (!bar) return;
  const top = bar.closest('.top');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.createElement('button');
  btn.className = 'nav8-top';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Go to top');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>';
  btn.addEventListener('click', () => scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' }));
  bar.append(btn);
  const pill = bar.querySelector('nav');
  pill.querySelectorAll('a').forEach((a) => {
    const text = a.textContent.trim();
    a.setAttribute('aria-label', text);
    a.innerHTML = [...text].map((c, i) => `<span class="nav8-ch" aria-hidden="true" style="--i:${i}">${c}</span>`).join('');
  });
  const measure = () => {
    const mini = top.classList.contains('nav8-mini');
    bar.style.removeProperty('--nav-w');
    top.classList.remove('nav8-mini', 'nav8-ready');
    bar.style.setProperty('--nav-w', `${pill.offsetWidth}px`);
    top.classList.toggle('nav8-mini', mini);
    void pill.offsetWidth;
    top.classList.add('nav8-ready');
  };
  let last = scrollY, busy = false, held = false, leave = 0;
  const paint = () => {
    busy = false;
    const y = scrollY;
    if (y < 240) top.classList.remove('nav8-mini');
    else if (y > last + 6 && !held) top.classList.add('nav8-mini');
    else if (y < last - 6) top.classList.remove('nav8-mini');
    if (Math.abs(y - last) > 6) last = y;
  };
  addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(paint); } }, { passive: true });
  // with a mouse, hovering the go-to-top circle opens the navigation; moving away closes it again
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    btn.addEventListener('mouseenter', () => { clearTimeout(leave); held = true; top.classList.remove('nav8-mini'); });
    bar.addEventListener('mouseenter', () => { if (held) clearTimeout(leave); });
    bar.addEventListener('mouseleave', () => {
      if (!held) return;
      leave = setTimeout(() => { held = false; if (scrollY >= 240) top.classList.add('nav8-mini'); }, 300);
    });
  }
  addEventListener('resize', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
})();

/* Home title: the letters nearest the pointer lift very slightly */
(() => {
  const title = document.querySelector('.v8 .c7-title');
  if (!title || !matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const walk = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walk.nextNode()) if (walk.currentNode.nodeValue.trim()) nodes.push(walk.currentNode);
  nodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    node.nodeValue.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (!part.trim()) { frag.append(' '); return; }
      const word = document.createElement('span');
      word.className = 'wave8-word';
      [...part].forEach((c) => {
        const ch = document.createElement('span');
        ch.className = 'wave8-ch';
        ch.textContent = c;
        word.append(ch);
      });
      frag.append(word);
    });
    node.replaceWith(frag);
  });
  const letters = [...title.querySelectorAll('.wave8-ch')].map((el) => ({ el, x: 0, y: 0, now: 0 }));
  let px = 0, py = 0, over = false, raf = 0;
  const place = () => letters.forEach((l) => {
    const r = l.el.getBoundingClientRect();
    l.x = r.left + r.width / 2;
    l.y = r.top + r.height / 2 - l.now;
  });
  const tick = () => {
    let moving = over;
    letters.forEach((l) => {
      const dx = px - l.x;
      const dy = py - l.y;
      const near = over ? Math.exp(-(dx * dx) / 3200 - (dy * dy) / 5000) : 0;
      const target = near * -3;
      l.now += (target - l.now) * 0.1;
      if (Math.abs(l.now) > 0.05) moving = true;
      l.el.style.transform = Math.abs(l.now) > 0.05 ? `translateY(${l.now.toFixed(2)}px)` : '';
    });
    raf = moving ? requestAnimationFrame(tick) : 0;
  };
  title.addEventListener('pointerenter', () => { place(); over = true; if (!raf) raf = requestAnimationFrame(tick); });
  title.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; });
  title.addEventListener('pointerleave', () => { over = false; });
  addEventListener('scroll', () => { if (over) place(); }, { passive: true });
})();

/* Screen rows: when everything fits, centre the screens and drop the arrows and scroll bar */
(() => {
  if (!document.querySelector('.v8')) return;
  const flows = [...document.querySelectorAll('.flow')].filter((f) => f.querySelector('.rail'));
  const check = () => flows.forEach((flow) => {
    const rail = flow.querySelector('.rail');
    flow.classList.remove('flow--fit');
    flow.classList.toggle('flow--fit', rail.scrollWidth <= rail.clientWidth + 1);
  });
  addEventListener('resize', check);
  addEventListener('load', check);
  check();
})();

/* Parallax: the case page screens and the footer move slower than the page */
(() => {
  if (!document.querySelector('.v8') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cover = document.querySelector('.cover8');
  const foot = document.querySelector('.c7-foot');
  let busy = false;
  const paint = () => {
    busy = false;
    if (cover) {
      const r = cover.getBoundingClientRect();
      if (r.bottom > 0) cover.style.setProperty('--plx', `${Math.round(scrollY * 0.35)}px`);
    }
    if (foot) {
      const r = foot.getBoundingClientRect();
      const done = Math.min(1, Math.max(0, (innerHeight - r.top) / Math.min(r.height, innerHeight)));
      foot.style.setProperty('--plx', `${Math.round((done - 1) * 120)}px`);
    }
  };
  addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(paint); } }, { passive: true });
  addEventListener('resize', paint);
  paint();
})();

/* Explorations page: the side list marks the section in view, and on phones keeps it in sight */
(() => {
  const links = [...document.querySelectorAll('.xp8__nav a')];
  if (!links.length) return;
  const mark = (id) => links.forEach((a) => {
    const on = a.getAttribute('href') === `#${id}`;
    if (on) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
    if (on && innerWidth < 900) a.parentElement.parentElement.scrollTo({ left: a.offsetLeft - 16, behavior: 'smooth' });
  });
  const seen = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) mark(en.target.id); }), { rootMargin: '-25% 0px -70% 0px' });
  document.querySelectorAll('.xp8__item').forEach((s) => seen.observe(s));
  // past the first section's heading the list shrinks to small lines
  const nav = document.querySelector('.xp8__nav');
  const size = () => nav.classList.toggle('is-mini', scrollY > 120);
  addEventListener('scroll', size, { passive: true });
  size();
  mark(location.hash.slice(1) || links[0].getAttribute('href').slice(1));
})();

/* Explorations page: tap the video to pause or play it. A video you paused stays paused */
document.querySelectorAll('.xp8__video video').forEach((v) => {
  const mark = () => v.parentElement.classList.toggle('is-paused', v.paused && v.dataset.user === 'paused');
  v.addEventListener('play', mark);
  v.addEventListener('pause', mark);
  v.addEventListener('click', () => {
    if (v.paused) { v.dataset.user = ''; v.play().catch(() => {}); }
    else { v.dataset.user = 'paused'; v.pause(); }
  });
});

/* Recordings: a thin progress bar under each phone. Drag or click it to rewind and look at a screen again */
const scrub = (v, phone) => {
  const r = document.createElement('input');
  r.type = 'range';
  r.className = 'scrub';
  r.min = 0; r.max = 1000; r.step = 1; r.value = 0;
  r.setAttribute('aria-label', 'Recording progress');
  phone.after(r);
  const fit = () => { r.style.width = phone.offsetWidth + 'px'; };  // layout width, so an entrance animation's scale doesn't shrink it
  new ResizeObserver(fit).observe(phone);
  let held = false, raf = 0;
  const paint = () => {
    if (!held && v.duration) r.value = Math.round(v.currentTime / v.duration * 1000);
    r.style.setProperty('--p', r.value / 10 + '%');
  };
  const loop = () => { paint(); raf = v.paused ? 0 : requestAnimationFrame(loop); };
  v.addEventListener('play', () => { if (!raf) raf = requestAnimationFrame(loop); });
  v.addEventListener('seeked', paint);
  r.addEventListener('pointerdown', () => { held = true; if (v.preload === 'none') v.preload = 'auto'; });
  r.addEventListener('input', () => {
    held = true;
    const go = () => { v.currentTime = r.value / 1000 * v.duration; };
    if (v.duration) go();
    else { if (v.preload === 'none') v.preload = 'auto'; v.addEventListener('loadedmetadata', go, { once: true }); v.load(); }
    r.style.setProperty('--p', r.value / 10 + '%');
  });
  const release = () => { held = false; };
  r.addEventListener('change', release);
  r.addEventListener('pointerup', release);
  r.addEventListener('pointercancel', release);
};
window.addScrub = scrub;
document.querySelectorAll('.phone--video > video').forEach((v) => scrub(v, v.parentElement));

/* An image that fails to load tries again, up to three times, so a dropped request doesn't leave a blank screen */
document.addEventListener('error', (ev) => {
  const img = ev.target;
  if (!(img instanceof HTMLImageElement)) return;
  const tries = Number(img.dataset.retry || 0);
  if (tries >= 3) return;
  img.dataset.retry = tries + 1;
  setTimeout(() => {
    const set = img.getAttribute('srcset');
    if (set) img.srcset = set;
    img.src = img.getAttribute('src');
  }, 500 * (tries + 1));
}, true);

/* Explorations: switch between the list of apps and a grid of every screen */
(() => {
  const page = document.querySelector('.xp8');
  const btns = page ? [...page.querySelectorAll('.xp8__view button')] : [];
  // grid tiles rise into place as they come into view, left to right along each row
  const tiles = page ? [...page.querySelectorAll('.xp8__wall li')] : [];
  const seen = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    seen.unobserve(en.target);
  }), { rootMargin: '0px 0px -6% 0px' });
  const rise = () => {
    const cols = getComputedStyle(page.querySelector('.xp8__wall')).gridTemplateColumns.split(' ').length;
    tiles.forEach((li, i) => {
      li.style.setProperty('--i', i % cols);
      li.classList.remove('is-in');
      seen.observe(li);
    });
  };
  btns.forEach((btn) => btn.addEventListener('click', () => {
    const grid = btn.dataset.view === 'grid';
    if (page.classList.contains('is-wall') === grid) return;
    page.classList.toggle('is-wall', grid);
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    scrollTo({ top: 0, behavior: 'auto' });
    if (grid) { tiles.forEach((li) => li.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; })); rise(); }  // every screen fetches at once, so no tile waits empty
  }));
  // cards move only while they are on screen
  const live = new IntersectionObserver((entries) => entries.forEach((en) => en.target.classList.toggle('is-live', en.isIntersecting)));
  tiles.forEach((li) => live.observe(li));

  // tapping a card grows it into a modal of that screen
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = 'cubic-bezier(.2,.8,.2,1)';
  const cards = tiles.map((li) => li.querySelector('.xp8__tile'));
  let m = null;
  const apps = page ? JSON.parse(page.querySelector('#xp8-apps')?.textContent || '{}') : {};
  const from = (tile, box) => {
    const r = tile.getBoundingClientRect();
    const t = box.getBoundingClientRect();
    return `translate(${r.left - t.left}px, ${r.top - t.top}px) scale(${r.width / t.width})`;
  };
  const item = (shot, chosen, still) => {
    const fig = document.createElement('figure');
    fig.className = 'xp8m__shot';
    const box = document.createElement('div');
    box.className = 'phone xp8m__phone';
    if (shot.video) {
      const v = document.createElement('video');
      v.src = shot.video;
      v.poster = still || '';  // a screen from the same app shows until the recording starts
      v.muted = v.loop = v.autoplay = v.playsInline = true;
      box.append(v);
    } else {
      const im = new Image();
      im.sizes = '(min-width: 900px) 400px, 70vw';
      im.srcset = shot.srcset;
      im.src = shot.src;
      im.alt = shot.alt;
      im.loading = chosen ? 'eager' : 'lazy';
      box.append(im);
    }
    const cap = document.createElement('figcaption');
    cap.textContent = shot.cap;
    fig.append(box, cap);
    if (shot.video && window.addScrub) window.addScrub(box.querySelector('video'), box);
    return fig;
  };
  const step = (d) => {
    const figs = [...m.row.children];
    const w = figs[0].offsetWidth + parseFloat(getComputedStyle(m.row).columnGap);
    window.glideTo(m.row, m.row.scrollLeft + d * w, !still);
  };
  const close = () => {
    if (!m || m.closing) return;
    m.closing = true;
    const { root, box, tile } = m;
    const done = () => {
      tile.classList.remove('is-open');
      root.remove();
      document.documentElement.classList.remove('xp8m-on');
      tile.focus({ preventScroll: true });
      m = null;
    };
    if (still) { done(); return; }
    root.querySelector('.xp8m__scrim').animate({ opacity: [1, 0] }, { duration: 300, fill: 'forwards' });
    const card = root.querySelector('.xp8m__card');
    card.style.background = 'transparent';
    card.querySelectorAll('.xp8m__head, figcaption, .xp8m__shot').forEach((el) => { if (!el.contains(box)) el.style.visibility = 'hidden'; });
    m.row.style.overflow = 'visible';
    box.animate({ transform: ['none', from(tile, box)] }, { duration: 340, easing: ease, fill: 'forwards' });
    setTimeout(done, 350);
  };
  const open = (tile) => {
    if (m) return;
    const shots = apps[tile.dataset.app] || [];
    const at = Math.max(0, shots.findIndex((s) => s.key === tile.dataset.key));
    const root = document.createElement('div');
    root.className = 'xp8m';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', tile.dataset.app);
    root.innerHTML = `<div class="xp8m__scrim"></div><div class="xp8m__card"><div class="xp8m__head"><p class="xp8m__app"></p>
      <button type="button" data-step="-1" aria-label="Previous screens">←</button><button type="button" data-step="1" aria-label="Next screens">→</button>
      <button type="button" class="xp8m__close" aria-label="Close">✕</button></div><div class="xp8m__row" tabindex="0"></div></div>`;
    root.querySelector('.xp8m__app').textContent = tile.dataset.app;
    const row = root.querySelector('.xp8m__row');
    const cover = shots.find((s) => s.src)?.src;
    shots.forEach((s, i) => row.append(item(s, i === at, cover)));
    document.documentElement.classList.add('xp8m-on');
    document.body.append(root);
    const fig = row.children[at];
    row.scrollLeft = fig.offsetLeft - row.offsetLeft - (row.clientWidth - fig.offsetWidth) / 2;
    m = { root, row, tile, box: fig.querySelector('.xp8m__phone') };
    root.querySelectorAll('[data-step]').forEach((b) => { b.onclick = () => step(Number(b.dataset.step)); });
    root.querySelector('.xp8m__close').onclick = close;
    root.querySelector('.xp8m__scrim').onclick = close;
    root.querySelector('.xp8m__close').focus({ preventScroll: true });
    if (!still) {
      const card = root.querySelector('.xp8m__card');
      root.querySelector('.xp8m__scrim').animate({ opacity: [0, 1] }, { duration: 300 });
      card.animate({ backgroundColor: ['transparent', getComputedStyle(card).backgroundColor] }, { duration: 260, easing: 'ease-out' });
      root.querySelector('.xp8m__head').animate({ opacity: [0, 1] }, { duration: 260, delay: 160, fill: 'backwards' });
      [...row.children].forEach((f) => { if (f !== fig) f.animate({ opacity: [0, 1] }, { duration: 300, delay: 180, fill: 'backwards' }); });
      m.box.animate({ transform: [from(tile, m.box), 'none'] }, { duration: 420, easing: ease });
    }
    tile.classList.add('is-open');
  };
  cards.forEach((c) => c.addEventListener('click', () => open(c)));
  addEventListener('keydown', (ev) => {
    if (!m) return;
    if (ev.key === 'Escape') close();
    if (ev.key === 'ArrowLeft') step(-1);
    if (ev.key === 'ArrowRight') step(1);
  });
})();
