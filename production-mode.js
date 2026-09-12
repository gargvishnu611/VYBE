/* VYBE — production presentation layer
   Removes placeholder presentation and keeps the public interface focused on
   published catalogue content. No runtime watcher is used, keeping the page light.
*/
(() => {
  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value || '').replace(/\s*·\s*Demo\b/gi, '').replace(/\bDemo\b/gi, '').replace(/\s{2,}/g, ' ').trim();

  window.VYBE_PRODUCTION = true;
  document.documentElement.dataset.vybeProduction = 'true';

  const style = document.createElement('style');
  style.id = 'vybeProductionStyles';
  style.textContent = `
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
      ['TOUCH + POINTER + SOUND', 'POINTER + TOUCH'],
      ['Motion mode', 'Visual effects'],
      ['MAKE THE SCREEN YOURS.', 'SET YOUR VIEW.']
    ]);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let text = node.nodeValue || '';
      replacements.forEach((to, from) => { text = text.replaceAll(from, to); });
      if (text !== node.nodeValue) node.nodeValue = text;
    });
  }

  function resetPlaceholderState() {
    $('heroTrack')?.replaceChildren(document.createTextNode('VYBE'));
    $('heroArtist')?.replaceChildren(document.createTextNode('Curated releases'));
    $('heroEnergy')?.replaceChildren(document.createTextNode('—'));
    $('heroMood')?.replaceChildren(document.createTextNode('Explore'));
    $('albumTitle')?.replaceChildren(document.createTextNode('VYBE'));
    $('albumBpm')?.replaceChildren(document.createTextNode('VYBE'));
    $('albumNumber')?.replaceChildren(document.createTextNode('—'));
    $('sceneTrack')?.replaceChildren(document.createTextNode('VYBE'));
    $('sceneMood')?.replaceChildren(document.createTextNode('EXPLORE'));
    $('lyricsTrackName')?.replaceChildren(document.createTextNode('SELECT A RELEASE'));
    $('lyricsDuration')?.replaceChildren(document.createTextNode('—'));
    $('lyricClock')?.replaceChildren(document.createTextNode('0:00'));
    const copy = $('lyricsCopy');
    if (copy) copy.innerHTML = '<p class="lyric-line active" data-time="0">Choose a published release to begin.</p>';
    showEmptyCatalogue('Published releases appear here after they are approved.');
  }

  function showEmptyCatalogue(message) {
    const grid = $('trackGrid');
    if (!grid) return;
    grid.innerHTML = `<div id="liveEmptyState"><div><strong>VYBE is live.</strong><span>${clean(message || 'Published releases appear here after they are approved.')}</span></div></div>`;
    $('playerBar')?.setAttribute('data-placeholder-hidden', 'true');
    $('playerBar')?.style.setProperty('display', 'none');
  }

  function hidePlaceholderArtists() {
    document.querySelectorAll('.artist-stage .artist-card').forEach((card) => card.setAttribute('data-placeholder-hidden', 'true'));
  }

  function init() {
    cleanTextNodes(document.body);
    renameLabels();
    resetPlaceholderState();
    hidePlaceholderArtists();
    window.VYBE_PRODUCTION_UI = { cleanTextNodes, renameLabels, hidePlaceholderArtists, showEmptyCatalogue };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
