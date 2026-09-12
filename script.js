/* VYBE — fail-safe bootstrap
   This file intentionally contains only the startup guard. The main runtime is in app.js.
*/
(() => {
  const hidePreloader = () => {
    const pre = document.getElementById('preloader');
    const progress = document.getElementById('preloaderProgress');
    const label = document.getElementById('preloaderLabel');
    if (!pre) return;
    if (progress) progress.style.width = '100%';
    if (label) label.textContent = 'READY';
    pre.classList.add('loaded');
    pre.setAttribute('aria-hidden', 'true');
    pre.style.opacity = '0';
    pre.style.visibility = 'hidden';
    pre.style.pointerEvents = 'none';
  };

  // Never let a broken/slow optional script keep the whole experience behind the loader.
  const boot = () => {
    try { hidePreloader(); } catch (_) {}
    setTimeout(() => { try { hidePreloader(); } catch (_) {} }, 1400);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Safety net for runtime exceptions/rejected promises during startup.
  window.addEventListener('error', () => { try { hidePreloader(); } catch (_) {} });
  window.addEventListener('unhandledrejection', () => { try { hidePreloader(); } catch (_) {} });
})();
