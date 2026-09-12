const VYBE$=id=>document.getElementById(id);const VYBEplay=()=>document.getElementById('playButton')?.click();const VYBEnext=()=>document.getElementById('nextButton')?.click();const VYBEprev=()=>document.getElementById('prevButton')?.click();
window.addEventListener('DOMContentLoaded',()=>{
  const p=VYBE$('playButton'),n=VYBE$('nextButton'),v=VYBE$('prevButton'),bar=VYBE$('progress');
  p?.addEventListener('click',()=>{if(window.isPlayingProxy){window.isPlayingProxy()}});
  n?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('vybe-next')));v?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('vybe-prev')));
  bar?.addEventListener('input',()=>window.dispatchEvent(new CustomEvent('vybe-seek',{detail:Number(bar.value)})));
});
