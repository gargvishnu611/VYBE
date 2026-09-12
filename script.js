/* VYBE — fail-safe bootstrap + backend loader
   The visual runtime stays in app.js. This file also loads the optional
   Supabase client, public configuration and VYBE backend bridge after the
   main runtime script so the existing experience keeps booting safely.
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

  const loadScript = (src) => new Promise((resolve) => {
    const existing = [...document.scripts].find(s => s.src === new URL(src, document.baseURI).href);
    if (existing) return existing.addEventListener('load', resolve, { once: true });
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = () => resolve(true); s.onerror = () => resolve(false); document.head.appendChild(s);
  });

  const loadBackend = async () => {
    try {
      await loadScript('vybe-config.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      await loadScript('vybe-backend.js');
    } catch (_) {}
  };

  const boot = () => {
    try { hidePreloader(); } catch (_) {}
    loadBackend();
    setTimeout(() => { try { hidePreloader(); } catch (_) {} }, 1400);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.addEventListener('error', () => { try { hidePreloader(); } catch (_) {} });
  window.addEventListener('unhandledrejection', () => { try { hidePreloader(); } catch (_) {} });
})();
