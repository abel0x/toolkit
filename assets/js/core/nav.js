/* ═══════════════════════════════════════════════════════════
   TOOLKIT — shared page behaviour
   Compact header, reveal animation, sliders and offline setup.
   ═══════════════════════════════════════════════════════════ */

(function initStickyHeader() {
  'use strict';

  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  let framePending = false;
  window.addEventListener('scroll', () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
      framePending = false;
    });
  }, { passive: true });
}());

(function initScrollReveal() {
  'use strict';

  const reveals = document.querySelectorAll('.reveal');
  if (!window.IntersectionObserver) {
    reveals.forEach((element) => element.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  reveals.forEach((element) => observer.observe(element));
}());

(function initRangeFill() {
  'use strict';

  document.querySelectorAll('input[type="range"]').forEach((slider) => {
    const update = () => {
      const min = Number(slider.min || 0);
      const max = Number(slider.max || 100);
      const value = Number(slider.value);
      const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
      slider.style.setProperty('--val', `${percent}%`);
    };
    slider.addEventListener('input', update);
    update();
  });
}());

(function initAnchorLinks() {
  'use strict';

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}());

(function registerServiceWorker() {
  'use strict';

  if (!('serviceWorker' in navigator) || !document.currentScript?.src) return;
  const script = new URL(document.currentScript.src);
  // assets/js/core/nav.js → the site root, wherever the page itself lives.
  const worker = new URL('../../../sw.js', script);
  // build.py links every script as file?v=<CACHE_VERSION> of its release.
  const pageVersion = script.searchParams.get('v');
  const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;
  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  function workerVersion(target) {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 3000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data?.version || null);
      };
      target.postMessage({ type: 'get-version' }, [channel.port2]);
    });
  }

  // Stays until the visitor reloads or closes it: input on the page is
  // never thrown away by an automatic reload.
  function showUpdateNotice() {
    if (document.getElementById('update-notice')) return;
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.append(container);
    }
    const notice = document.createElement('div');
    notice.id = 'update-notice';
    notice.className = 'toast toast--update';
    notice.setAttribute('role', 'status');
    const text = document.createElement('span');
    text.className = 'toast-msg';
    text.textContent = t('A new version of Toolkit is ready.');
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'toast-action';
    reload.textContent = t('Reload');
    reload.addEventListener('click', () => window.location.reload());
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', t('Close'));
    close.textContent = '×';
    close.addEventListener('click', () => {
      notice.classList.add('toast--exit');
      notice.addEventListener('animationend', () => notice.remove(), { once: true });
    });
    notice.append(text, reload, close);
    container.append(notice);
  }

  // A worker of another release took over this page (the first install
  // brings this page's own release, so it stays quiet).
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    const controller = navigator.serviceWorker.controller;
    if (!controller || !pageVersion) return;
    const version = await workerVersion(controller);
    if (version && version !== pageVersion) showUpdateNotice();
  });

  navigator.serviceWorker.register(worker.href).then((registration) => {
    // Browsers look for a new worker on navigation; a tab left open for
    // hours looks again when it comes back into view, at most once an hour.
    let lastCheck = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < UPDATE_CHECK_INTERVAL) return;
      lastCheck = Date.now();
      registration.update().catch(() => {});
    });
  }).catch(() => {});
}());
