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
  // assets/js/core/nav.js → the site root, wherever the page itself lives.
  const worker = new URL('../../../sw.js', document.currentScript.src);
  navigator.serviceWorker.register(worker.href).catch(() => {});
}());
