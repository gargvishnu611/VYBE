/* VYBE — backend bridge
   Optional Supabase connection. The visual experience still works when the
   backend is not configured, while real accounts, requests and submissions
   become shared once vybe-config.js has Supabase credentials.
*/
(() => {
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cfg = window.VYBE_CONFIG || {};
  const ready = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  let client = null;
  let user = null;

  if (ready) {
    try { client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey); } catch (e) { console.warn('VYBE backend init failed', e); }
  }
  window.VYBE_DB = { ready: () => Boolean(client), client: () => client, getUser: () => user };

  const toast = (text) => {
    const t = document.getElementById('vybeToast');
    if (t) { t.textContent = text; t.classList.add('show'); clearTimeout(window.__vybeToast); window.__vybeToast = setTimeout(() => t.classList.remove('show'), 2200); }
  };
  const modal = (id, title, body) => {
    document.getElementById(id)?.remove();
    const m = document.createElement('div'); m.className='vybe-modal open'; m.id=id; m.setAttribute('aria-hidden','false');
    m.innerHTML = `<div class="vybe-panel"><div class="vybe-panel-head"><div><div class="eyebrow">VYBE ACCOUNT</div><h3>${title}</h3></div><button class="vybe-close" aria-label="Close">×</button></div>${body}</div>`;
    document.body.appendChild(m);
    const close=()=>{m.classList.remove('open');m.setAttribute('aria-hidden','true');setTimeout(()=>m.remove(),180)};
    m.querySelector('.vybe-close').onclick=close; m.addEventListener('click',e=>{if(e.target===m)close()});
    return m;
  };

  function addAccountButton() {
    const nav = document.querySelector('.nav-actions'); if (!nav || document.getElementById('accountButton')) return;
    const b=document.createElement('button'); b.className='nav-pill magnetic'; b.id='accountButton'; b.dataset.cursor='ACCOUNT'; b.textContent='ACCOUNT'; b.onclick=openAccount; nav.appendChild(b);
    if (!client) b.title='Connect Supabase to enable accounts';
  }

  async function refreshUser() {
    if (!client) return;
    const { data } = await client.auth.getUser(); user=data?.user||null;
    const b=document.getElementById('accountButton'); if (b) b.textContent=user ? (user.user_metadata?.display_name || user.email?.split('@')[0] || 'ACCOUNT') : 'ACCOUNT';
  }

  function openAccount() {
    if (!client) {
      return modal('accountSetupModal','Backend ready — connect Supabase',`<p>VYBE now has a production database schema and backend bridge. To activate shared accounts, search and replace the empty values in <strong>vybe-config.js</strong> with your Supabase project URL and public anon key.</p><div class="vybe-card"><strong>Already created a Supabase project?</strong><p>Run <code>supabase/schema.sql</code> in the SQL Editor, then add only the public anon key here. Never use a service_role key in the website.</p></div>`);
    }
    const body = user ? `<div class="vybe-card"><span class="vybe-pill">SIGNED IN</span><strong>${esc(user.email||'VYBE user')}</strong><p>Your account can keep likes, playlists and listening history across devices.</p></div><div class="vybe-actions"><button id="signOut" class="vybe-btn primary">Sign out</button></div>` : `<div class="vybe-tabs"><button class="vybe-btn vybe-tab active" id="tabSignIn">Sign in</button><button class="vybe-btn vybe-tab" id="tabSignUp">Create account</button></div><form id="authForm"><label class="vybe-label">Email</label><input class="vybe-input" name="email" type="email" required placeholder="you@example.com"><label class="vybe-label">Password</label><input class="vybe-input" name="password" type="password" minlength="6" required placeholder="••••••••"><label class="vybe-label" id="nameLabel" style="display:none">Display name</label><input class="vybe-input" id="displayName" name="displayName" style="display:none" placeholder="Your name"><button class="vybe-btn primary" type="submit" id="authSubmit">Sign in</button></form>`;
    const m=modal('accountModal',user?'Your VYBE account':'Welcome to VYBE',body);
    if(user){m.querySelector('#signOut').onclick=async()=>{await client.auth.signOut();await refreshUser();m.remove();toast('Signed out')}}
    else {
      let signup=false; const toggle=(v)=>{signup=v;m.querySelector('#tabSignIn').classList.toggle('active',!v);m.querySelector('#tabSignUp').classList.toggle('active',v);m.querySelector('#nameLabel').style.display=v?'block':'none';m.querySelector('#displayName').style.display=v?'block':'none';m.querySelector('#authSubmit').textContent=v?'Create account':'Sign in'};
      m.querySelector('#tabSignIn').onclick=()=>toggle(false);m.querySelector('#tabSignUp').onclick=()=>toggle(true);
      m.querySelector('#authForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const email=fd.get('email'),password=fd.get('password');let res;if(signup)res=await client.auth.signUp({email,password,options:{data:{display_name:fd.get('displayName')}}});else res=await client.auth.signInWithPassword({email,password});if(res.error)return toast(res.error.message);await refreshUser();m.remove();toast(signup?'Account created':'Welcome back')};
    }
  }

  async function saveRequest(form) {
    if (!client) return false;
    const fd=new FormData(form); const { data:{user:u} }=await client.auth.getUser();
    const payload={user_id:u?.id||null,title:String(fd.get('title')||''),artist:String(fd.get('artist')||''),reason:String(fd.get('reason')||'')};
    const {error}=await client.from('song_requests').insert(payload); if(error){console.warn(error);toast('Saved locally; backend request failed');return false} toast('Request synced to VYBE'); return true;
  }

  async function saveSubmission(form) {
    if (!client) return false;
    const fd=new FormData(form); const { data:{user:u} }=await client.auth.getUser(); const file=fd.get('audio');
    let audioPath=null;
    if (file instanceof File && file.size) {
      if (!u) { toast('Sign in to upload an audio file'); return false; }
      const safe=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-'); audioPath=`${u.id}/${Date.now()}-${safe}`;
      const up=await client.storage.from(cfg.musicBucket||'music').upload(audioPath,file,{upsert:false,contentType:file.type||'audio/mpeg'});
      if(up.error){console.warn(up.error);toast('Audio upload failed; metadata can still be sent');audioPath=null;}
    }
    const payload={owner_id:u?.id||null,artist_name:String(fd.get('artist')||''),contact_email:String(fd.get('email')||''),song_title:String(fd.get('title')||''),genre:String(fd.get('genre')||''),source_url:String(fd.get('url')||''),lyrics:String(fd.get('lyrics')||''),audio_path:audioPath,rights_confirmed:Boolean(fd.get('rights')),status:'under_review'};
    const {error}=await client.from('artist_submissions').insert(payload); if(error){console.warn(error);toast('Saved locally; backend submission failed');return false} toast('Submission synced to VYBE Studio');return true;
  }

  async function appendDatabaseSearch(query) {
    if(!client || !query || query.length<2) return;
    const q=query.trim(); const {data,error}=await client.from('songs').select('id,title,slug,language,genre,mood,artists(name),audio_path').eq('status','published').or(`title.ilike.%${q}%,language.ilike.%${q}%,genre.ilike.%${q}%,mood.ilike.%${q}%`).limit(8);
    if(error || !data?.length) return;
    const box=document.getElementById('searchResults'); if(!box)return;
    const existing=document.createElement('div'); existing.className='vybe-card'; existing.style.marginTop='10px'; existing.innerHTML=`<span class="vybe-pill">LIVE CATALOGUE</span><strong>${data.length} database result${data.length>1?'s':''}</strong>${data.map(s=>`<button class="result" data-db-song="${esc(s.id)}"><span><strong>${esc(s.title)}</strong><small>${esc(s.artists?.name||'VYBE Artist')} · ${esc(s.mood||s.genre||'Published')}</small></span><em>DB</em></button>`).join('')}`; box.appendChild(existing);
    existing.querySelectorAll('[data-db-song]').forEach(btn=>btn.onclick=()=>toast('Database playback hook ready — publish a VYBE player audio source to play this track'));
  }

  function interceptComingSoon() {
    document.addEventListener('click',e=>{const b=e.target.closest('[data-open-feature]');if(!b)return;const feature=b.dataset.openFeature;if(feature==='submit'||feature==='studio'){e.stopImmediatePropagation();e.preventDefault();const name=feature==='submit'?'Submit Your Music':'VYBE Studio';modal('comingSoonModal',name,`<div class="vybe-card"><span class="vybe-pill">COMING SOON</span><strong>${feature==='submit'?'Artist submissions are being prepared.':'The creator and review workspace is being prepared.'}</strong><p>These systems will connect to the VYBE backend, file storage and human review workflow once the production backend is activated.</p></div>`);}},true);
  }

  function wireForms() {
    document.addEventListener('submit',e=>{if(e.target.id==='requestForm')saveRequest(e.target); if(e.target.id==='submitForm')saveSubmission(e.target)},true);
    const input=document.getElementById('searchInput');
    if(input){let timer; input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>appendDatabaseSearch(input.value),450)},{passive:true})}
  }

  async function init(){
    addAccountButton(); interceptComingSoon(); wireForms();
    if(client){await refreshUser();client.auth.onAuthStateChange(()=>refreshUser());}
    window.VYBE_DB_STATUS = ready ? 'connected' : 'not-configured';
    document.documentElement.dataset.vybeBackend=client?'connected':'offline';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
