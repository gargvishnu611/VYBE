/* VYBE — production polish
   Mobile-first spacing, lightweight rendering, clean public copy and safer fallbacks.
*/
(() => {
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const smallScreen = matchMedia('(max-width: 760px)').matches;
  const saveData = !!navigator.connection?.saveData;
  const lowMemory = Number(navigator.deviceMemory || 8) <= 4;

  window.VYBE_PRODUCTION = true;
  document.documentElement.dataset.vybeProduction = 'true';
  document.documentElement.dataset.vybeTouch = isTouch ? 'true' : 'false';
  document.documentElement.dataset.vybeLowPower = (saveData || lowMemory) ? 'true' : 'false';

  const style = document.createElement('style');
  style.id = 'vybeProductionPolish';
  style.textContent = `
    html[data-vybe-touch="true"] .cursor,html[data-vybe-touch="true"] .cursor-label{display:none!important}
    html[data-vybe-low-power="true"] #space{opacity:.22!important}
    html[data-vybe-low-power="true"] .grain{opacity:.12!important}
    html[data-vybe-low-power="true"] .world-grid,html[data-vybe-low-power="true"] .lab-grid{opacity:.26!important}
    html[data-vybe-production="true"] .track-card{contain:layout paint;}
    html[data-vybe-production="true"] .visual-lab,html[data-vybe-production="true"] .visual-section,html[data-vybe-production="true"] .immersive-player,html[data-vybe-production="true"] .hero-world{contain:layout paint;}
    html[data-vybe-production="true"] .artist-stage:empty{display:none!important}
    html[data-vybe-production="true"] .hide-public-placeholder{display:none!important}
    @media(max-width:760px){
      .hero{min-height:720px!important;padding-top:86px!important;padding-bottom:50px!important}
      .hero-world{min-height:360px!important;height:410px!important;margin-top:10px!important}
      .immersive-player{min-height:680px!important;padding-top:90px!important;padding-bottom:90px!important}
      .lyrics-section,.visual-section,.artists-section,.final-experience{padding-top:82px!important;padding-bottom:82px!important}
      .lyrics-stage{min-height:500px!important}
      .visual-lab{min-height:430px!important}
      .artist-stage{gap:10px!important}
      .player-bar{max-width:calc(100vw - 16px)!important}
      .nav-actions .nav-pill{padding:7px 9px!important;font-size:9px!important}
      .site-nav{padding-left:10px!important;padding-right:10px!important}
    }
    @media(min-width:761px) and (max-width:1100px){
      .hero{min-height:760px!important}
      .immersive-player{min-height:760px!important}
    }
    @media(prefers-reduced-motion:reduce){
      html[data-vybe-production="true"] *,html[data-vybe-production="true"] *::before,html[data-vybe-production="true"] *::after{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
    }
  `;
  document.head.appendChild(style);

  const replacements = new Map([
    ['VYBE / 001', 'VYBE'],
    ['LIVE EXPERIENCE', 'NOW PLAYING'],
    ['LIVE RADAR · DEMO DATA', 'CURATED CATALOGUE'],
    ['CURATED FOR YOU', 'FOR YOU'],
    ['TOUCH / MOVE', 'MOVE / EXPLORE'],
    ['TOUCH + POINTER + SOUND', 'POINTER + TOUCH'],
    ['3D / REALTIME', 'VISUAL EXPERIENCE'],
    ['VYBE SYSTEM', 'VYBE'],
    ['VYBE / NEXT', 'VYBE'],
    ['Not a music library.', 'More than a playlist.'],
    ['A music experience.', 'A world for every song.']
  ]);
  const banned = /\b(Demo|DEMO)\b/g;
  let scheduled = false;

  function cleanText(root = document.body){
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    for(const node of nodes){
      const p=node.parentElement;
      if(!p || ['SCRIPT','STYLE','NOSCRIPT'].includes(p.tagName)) continue;
      let text=node.nodeValue || '';
      replacements.forEach((to,from)=>{text=text.replaceAll(from,to)});
      text=text.replace(banned,'').replace(/\s{2,}/g,' ').trim();
      if(text!==node.nodeValue) node.nodeValue=text;
    }
  }

  function hideTechnicalCopy(){
    $$('p,small,span,strong').forEach(el=>{
      const t=(el.textContent||'').trim().toLowerCase();
      if(t==='motion engine' || t==='touch + pointer + sound' || t==='3d / realtime' || t.includes('demo catalogue') || t.includes('demo worlds')){
        el.classList.add('hide-public-placeholder');
      }
    });
  }

  function protectEmptyLiveState(){
    if(!window.__VYBE_LIVE_READY) return;
    const grid=document.getElementById('trackGrid');
    if(!grid) return;
    const cards=grid.querySelectorAll('.track-card');
    if(!cards.length && !document.getElementById('liveEmptyState')){
      grid.innerHTML='<div id="liveEmptyState"><div><strong>VYBE is live.</strong><span>New releases appear here after they are approved.</span></div></div>';
    }
  }

  function apply(){
    scheduled=false;
    cleanText();
    hideTechnicalCopy();
    protectEmptyLiveState();
    if(isTouch || saveData || lowMemory) document.documentElement.classList.add('vybe-light-render');
    if(smallScreen){
      const space=document.getElementById('space');
      if(space && (saveData || lowMemory)) space.style.opacity='.18';
    }
  }

  function scheduleApply(){
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(apply);
  }

  function init(){
    apply();
    window.VYBE_PRODUCTION_POLISH={cleanText,hideTechnicalCopy,protectEmptyLiveState,apply};
    const observer=new MutationObserver((records)=>{
      const meaningful=records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1 || n.nodeType===3) || r.type==='characterData');
      if(meaningful) scheduleApply();
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
