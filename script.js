const tracks=[
  {title:'Night Drive',artist:'VYBE Radio · Demo',bpm:108},
  {title:'Afterglow',artist:'VYBE Radio · Demo',bpm:96},
  {title:'Midnight Rain',artist:'VYBE Radio · Demo',bpm:82},
  {title:'Neon Hearts',artist:'VYBE Radio · Demo',bpm:124}
];
const lyricStarts=[0,5,10,15,20,25];
let currentTrack=0,currentTime=0,isPlaying=false,isMuted=false,timer=null,audioCtx=null;
const $=id=>document.getElementById(id);
const stage=$('stage'),albumWrap=$('albumWrap'),album=$('album'),playButton=$('playButton'),progress=$('progress');
const currentTimeEl=$('currentTime'),durationEl=$('duration'),lyricClock=$('lyricClock'),lyricsProgress=$('lyricsProgress');
const playerTitle=$('playerTitle'),playerArtist=$('playerArtist'),stageTitle=$('stageTitle'),stageArtist=$('stageArtist');

function fmt(t){t=Math.max(0,Math.floor(t));return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`}
function setupAudio(){
  if(audioCtx)return;
  audioCtx=new (window.AudioContext||window.webkitAudioContext)();
}
function pulseSound(){
  if(!audioCtx||!isPlaying||isMuted)return;
  const now=audioCtx.currentTime;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type='sine';o.frequency.value=tracks[currentTrack].bpm>115?220:165;
  g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(.035,now+.015);g.gain.exponentialRampToValueAtTime(.001,now+.28);
  o.connect(g).connect(audioCtx.destination);o.start(now);o.stop(now+.3);
}
function startPlayback(){
  setupAudio(); if(audioCtx.state==='suspended')audioCtx.resume();
  isPlaying=true;playButton.textContent='❚❚';playButton.setAttribute('aria-label','Pause');
  if(timer)clearInterval(timer);
  timer=setInterval(()=>{currentTime+=.1;if(currentTime>=30){currentTime=0;loadTrack(currentTrack+1)}updateUI()},100);
  pulseSound();
}
function stopPlayback(){isPlaying=false;playButton.textContent='▶';playButton.setAttribute('aria-label','Play');clearInterval(timer);timer=null}
function updateUI(){
  progress.value=(currentTime/30)*100;currentTimeEl.textContent=fmt(currentTime);lyricClock.textContent=fmt(currentTime);lyricsProgress.style.width=`${(currentTime/30)*100}%`;
  document.querySelectorAll('.lyric-line').forEach((line,i)=>line.classList.toggle('active',currentTime>=lyricStarts[i]&&currentTime<(lyricStarts[i+1]??30)));
  if(isPlaying){const beat=Date.now()/1000*(tracks[currentTrack].bpm/60);const scale=1+Math.sin(beat*Math.PI*2)*.015;album.style.transform=`rotateX(10deg) rotateY(-18deg) rotateZ(-4deg) scale(${scale})`}
}
function loadTrack(index){
  currentTrack=(index+tracks.length)%tracks.length;currentTime=0;const t=tracks[currentTrack];
  [playerTitle,stageTitle].forEach(e=>e.textContent=t.title);[playerArtist,stageArtist].forEach(e=>e.textContent=t.artist);stageArtist.textContent=t.artist;durationEl.textContent='0:30';
  document.querySelectorAll('.track-card').forEach((c,i)=>c.classList.toggle('selected',i===currentTrack));updateUI();
}
function nextTrack(){loadTrack(currentTrack+1);if(!isPlaying)startPlayback()}
function prevTrack(){loadTrack(currentTrack-1);if(!isPlaying)startPlayback()}
playButton.addEventListener('click',()=>isPlaying?stopPlayback():startPlayback());
$('nextButton').addEventListener('click',nextTrack);$('prevButton').addEventListener('click',prevTrack);
progress.addEventListener('input',e=>{currentTime=Number(e.target.value)/100*30;updateUI()});
$('muteButton').addEventListener('click',()=>{isMuted=!isMuted;$('muteButton').textContent=isMuted?'MUTE':'VOL'});
$('shuffleButton').addEventListener('click',()=>{let n=Math.floor(Math.random()*tracks.length);while(n===currentTrack)n=Math.floor(Math.random()*tracks.length);loadTrack(n);startPlayback()});
document.querySelectorAll('.track-card').forEach(c=>c.addEventListener('click',()=>{loadTrack(Number(c.dataset.index));startPlayback()}));
document.querySelectorAll('[data-scroll]').forEach(b=>b.addEventListener('click',()=>document.querySelector(b.dataset.scroll).scrollIntoView({behavior:'smooth'})));
$('exploreButton').addEventListener('click',()=>document.querySelector('#trending').scrollIntoView({behavior:'smooth'}));
$('experienceButton').addEventListener('click',()=>{startPlayback();document.querySelector('#lyrics').scrollIntoView({behavior:'smooth'})});
let pointerX=0,pointerY=0,targetX=0,targetY=0;
stage.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect();targetX=((e.clientX-r.left)/r.width-.5)*24;targetY=((e.clientY-r.top)/r.height-.5)*-18});
stage.addEventListener('pointerleave',()=>{targetX=targetY=0});
function animatePointer(){pointerX+=(targetX-pointerX)*.08;pointerY+=(targetY-pointerY)*.08;albumWrap.style.transform=`rotateX(${pointerY}deg) rotateY(${pointerX}deg)`;requestAnimationFrame(animatePointer)}animatePointer();
const searchModal=$('searchModal'),searchInput=$('searchInput'),searchResults=$('searchResults');
function renderResults(q=''){const items=tracks.filter(t=>(t.title+' '+t.artist).toLowerCase().includes(q.toLowerCase()));searchResults.innerHTML=items.map(t=>`<div class="result" data-track="${tracks.indexOf(t)}"><strong>${t.title}</strong><small>${t.artist}</small></div>`).join('')||'<div class="result"><small>No matching demo tracks.</small></div>';searchResults.querySelectorAll('[data-track]').forEach(r=>r.addEventListener('click',()=>{loadTrack(Number(r.dataset.track));startPlayback();searchModal.classList.remove('open');searchModal.setAttribute('aria-hidden','true')}))}
$('searchButton').addEventListener('click',()=>{searchModal.classList.add('open');searchModal.setAttribute('aria-hidden','false');searchInput.value='';renderResults();setTimeout(()=>searchInput.focus(),50)});
$('closeSearch').addEventListener('click',()=>{searchModal.classList.remove('open');searchModal.setAttribute('aria-hidden','true')});
searchModal.addEventListener('click',e=>{if(e.target===searchModal)$('closeSearch').click()});searchInput.addEventListener('input',e=>renderResults(e.target.value));
window.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==searchInput){e.preventDefault();$('searchButton').click()}if(e.code==='Space'&&document.activeElement.tagName!=='INPUT'){e.preventDefault();isPlaying?stopPlayback():startPlayback()}if(e.key==='Escape')$('closeSearch').click()});
loadTrack(0);updateUI();
