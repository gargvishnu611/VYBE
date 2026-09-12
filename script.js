/* VYBE — fail-safe bootstrap + backend + real audio loader
   Loads public Supabase configuration/backend first, then activates the real audio engine.
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
    const full = new URL(src, document.baseURI).href;
    const existing = [...document.scripts].find(s => s.src === full);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve(true);
      existing.addEventListener('load', () => resolve(true), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => { s.dataset.loaded = 'true'; resolve(true); };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });

  const boot = async () => {
    try { hidePreloader(); } catch (_) {}
    try { await loadScript('vybe-config.js'); } catch (_) {}
    try { await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'); } catch (_) {}
    try { await loadScript('vybe-backend.js'); } catch (_) {}
    // app.js is already loaded by index.html. Give it time to bind its UI,
    // then install the real HTML5 audio engine on top of the demo player.
    setTimeout(() => loadScript('audio-engine.js'), 1200);
    setTimeout(() => { try { hidePreloader(); } catch (_) {} }, 1400);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.addEventListener('error', () => { try { hidePreloader(); } catch (_) {} });
  window.addEventListener('unhandledrejection', () => { try { hidePreloader(); } catch (_) {} });
})();
