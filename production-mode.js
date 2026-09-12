/* VYBE — production presentation layer
   Removes placeholder/demo presentation, improves mobile/desktop polish,
   and keeps the public experience focused on published catalogue content.
*/
(() => {
  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value || '').replace(/\s*·\s*Demo\b/gi, '').replace(/\bDemo\b/gi, '').replace(/\bDEMO\b/g, '').replace(/\s{2,}/g, ' ').trim();

  window.VYBE_PRODUCTION = true;
  document.documentElement.dataset.vybeProduction = 'true';

  const style = document.createElement('style');
  style.id = 'vybeProductionStyles';
  style.textContent = `
    html[data-vybe-production="true"] .live-catalogue-grid:empty{display:none}
    html[data-vybe-production="true"] .player-bar{backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
    html[data-vybe-production="true"] .track-card{content-visibility:auto;contain-intrinsic-size:360px 430px}
    html[data-vybe-production="true"] #liveEmptyState{display:flex;min-height:180px;align-items:center;justify-content:center;text-align:center;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:rgba(255,255,255,.02);margin-top:18px;padding:28px}
    html[data-vybe-production="true"] #liveEmptyState strong{display:block;font-size:17px}
    html[data-vybe-production="true"] #liveEmptyState span{display:block;color:#7c7d86;font-size:11px;line-height:1.6;margin-top:7px}
    html[data-vybe-production="true"] [data-placeholder-hidden="true"]{display:none!important}
    @media(max-width:760px){html[data-vybe-production="true"] .player-bar{left:8px;right:8px;bottom:8px;border-radius:18px}.track-grid{contain:layout paint}}
    @media(prefers-reduced-motion:reduce){html[data-vybe-production="true"] *,html[data-vybe-production="true"] *::before,html[data-vybe-production="true"] *::after{scroll-behavior:auto!important}}
  `;
  document.head.appendChild(style);

  function cleanTextNodes(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT','STYLE','NOSCRIPT'].includes(parent.tagName)) return;
      const next = clean(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  }

  function renameLabels() {
    const replacements = new Map([
      ['LIVE EXPERIENCE', 'NOW PLAYING'],
      ['LIVE RADAR · DEMO DATA', 'CURATED CATALOGUE'],
      ['TOUCH / MOVE', 'MOVE / EXPLORE'],
      ['3D / REALTIME', 'LIVE VISUALS'],
      ['TOUCH + POINTER + SOUND', 'POINTER + TOUCH']
    ]);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let text = node.nodeValue || '';
      replacements.forEach((to, from) => { text = text.replaceAll(from, to); });
      node.nodeValue = text;
    });
  }

  function hideFakeArtists() {
    const stage = document.querySelector('.artist-stage');
    if (!stage) return;
    stage.querySelectorAll('.artist-card').forEach((card) => card.setAttribute('data-placeholder-hidden', 'true'));
    stage.dataset.placeholdersHidden = 'true';
  }

  function showEmptyCatalogue(message = 'The catalogue is being curated.') {
    const grid = $('trackGrid');
    if (!grid || $('liveEmptyState')) return;
    grid.innerHTML = '';
    const empty = document.createElement('div');
    empty.id = 'liveEmptyState';
    empty.innerHTML = '<div><strong>VYBE is live.</strong><span>' + message + '<br>New releases appear here as they are approved.</span></div>';
    grid.appendChild(empty);
    $('playerBar')?.setAttribute('data-placeholder-hidden', 'true');
    $('playerBar')?.style.setProperty('display', 'none');
  }

  function observe() {
    const observer = new MutationObserver(() => {
      cleanTextNodes(document.body);
      renameLabels();
      if (!window.__VYBE_LIVE_READY) hideFakeArtists();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    cleanTextNodes(document.body);
    renameLabels();
    hideFakeArtists();
    observe();
    window.VYBE_PRODUCTION_UI = { cleanTextNodes, renameLabels, showEmptyCatalogue, hideFakeArtists };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
