/* VYBE — production bootstrap
   Loads the public configuration/backend, then the live catalogue/audio layer and
   one lightweight presentation/performance layer.
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
    const existing = [...document.scripts].find((s) => s.src === full);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve(true);
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => { s.dataset.loaded = 'true'; resolve(true); };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });

  async function boot() {
    try { hidePreloader(); } catch (_) {}
    await loadScript('vybe-config.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    await loadScript('vybe-backend.js');
    await loadScript('live-player.js');
    await loadScript('production-polish.js');
    setTimeout(() => { try { hidePreloader(); } catch (_) {} }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.addEventListener('error', () => { try { hidePreloader(); } catch (_) {} });
  window.addEventListener('unhandledrejection', () => { try { hidePreloader(); } catch (_) {} });
})();
