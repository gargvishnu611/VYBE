/* VYBE — production Supabase bridge
   Accounts, requests and artist submissions use the shared backend.
   Public catalogue/search is read-only through Supabase RLS.
*/
(() => {
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cfg = window.VYBE_CONFIG || {};
  const ready = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  let client = null;
  let user = null;

  if (ready) {
    try { client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); }
    catch (error) { console.warn('VYBE backend init failed', error); }
  }
  window.VYBE_DB = { ready: () => Boolean(client), client: () => client, getUser: () => user };

  const toast = (text) => {
    const t = document.getElementById('vybeToast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(window.__vybeToast);
    window.__vybeToast = setTimeout(() => t.classList.remove('show'), 2200);
  };

  const modal = (id, title, body) => {
    document.getElementById(id)?.remove();
    const m = document.createElement('div');
    m.className = 'vybe-modal open'; m.id = id; m.setAttribute('aria-hidden','false');
    m.innerHTML = `<div class="vybe-panel"><div class="vybe-panel-head"><div><div class="eyebrow">VYBE ACCOUNT</div><h3>${title}</h3></div><button class="vybe-close" aria-label="Close">×</button></div>${body}</div>`;
    document.body.appendChild(m);
    const close = () => { m.classList.remove('open'); m.setAttribute('aria-hidden','true'); setTimeout(() => m.remove(), 180); };
    m.querySelector('.vybe-close').onclick = close;
    m.addEventListener('click', e => { if (e.target === m) close(); });
    return m;
  };

  function addAccountButton() {
    const nav = document.querySelector('.nav-actions');
    if (!nav || document.getElementById('accountButton')) return;
    const b = document.createElement('button');
    b.className = 'nav-pill magnetic'; b.id = 'accountButton'; b.dataset.cursor = 'ACCOUNT'; b.textContent = 'ACCOUNT'; b.onclick = openAccount;
    nav.appendChild(b);
  }

  async function refreshUser() {
    if (!client) return;
    const { data } = await client.auth.getUser();
    user = data?.user || null;
    const b = document.getElementById('accountButton');
    if (b) b.textContent = user ? (user.user_metadata?.display_name || user.email?.split('@')[0] || 'ACCOUNT') : 'ACCOUNT';
  }

  function openAccount() {
    if (!client) return modal('accountSetupModal','Connect VYBE',`<div class="vybe-card"><strong>Account service unavailable</strong><p>The VYBE interface is available. Configure Supabase to enable accounts and shared data.</p></div>`);
    const body = user
      ? `<div class="vybe-card"><span class="vybe-pill">SIGNED IN</span><strong>${esc(user.email || 'VYBE user')}</strong><p>Your account keeps profile data and shared actions connected to VYBE.</p></div><div class="vybe-actions"><button id="signOut" class="vybe-btn primary">Sign out</button></div>`
      : `<div class="vybe-tabs"><button class="vybe-btn vybe-tab active" id="tabSignIn">Sign in</button><button class="vybe-btn vybe-tab" id="tabSignUp">Create account</button></div><form id="authForm"><label class="vybe-label">Email</label><input class="vybe-input" name="email" type="email" autocomplete="email" required placeholder="you@example.com"><label class="vybe-label">Password</label><input class="vybe-input" name="password" type="password" autocomplete="current-password" minlength="6" required placeholder="Password"><label class="vybe-label" id="nameLabel" style="display:none">Display name</label><input class="vybe-input" id="displayName" name="displayName" autocomplete="name" style="display:none" placeholder="Your name"><button class="vybe-btn primary" type="submit" id="authSubmit">Sign in</button></form>`;
    const m = modal('accountModal', user ? 'Your account' : 'Welcome to VYBE', body);
    if (user) {
      m.querySelector('#signOut').onclick = async () => { const { error } = await client.auth.signOut(); if (error) return toast(error.message); await refreshUser(); m.remove(); toast('Signed out'); };
      return;
    }
    let signup = false;
    const toggle = (value) => { signup = value; m.querySelector('#tabSignIn').classList.toggle('active', !value); m.querySelector('#tabSignUp').classList.toggle('active', value); m.querySelector('#nameLabel').style.display = value ? 'block' : 'none'; m.querySelector('#displayName').style.display = value ? 'block' : 'none'; m.querySelector('#authSubmit').textContent = value ? 'Create account' : 'Sign in'; };
    m.querySelector('#tabSignIn').onclick = () => toggle(false);
    m.querySelector('#tabSignUp').onclick = () => toggle(true);
    m.querySelector('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const email = String(fd.get('email') || '').trim();
      const password = String(fd.get('password') || '');
      const result = signup ? await client.auth.signUp({ email, password, options: { data: { display_name: String(fd.get('displayName') || '').trim() } } }) : await client.auth.signInWithPassword({ email, password });
      if (result.error) return toast(result.error.message);
      await refreshUser(); m.remove(); toast(signup ? 'Account created' : 'Welcome back');
    };
  }

  async function saveRequest(form) {
    if (!client) return;
    const fd = new FormData(form);
    const { data } = await client.auth.getUser();
    const payload = { user_id: data?.user?.id || null, title: String(fd.get('title') || '').trim(), artist: String(fd.get('artist') || '').trim(), reason: String(fd.get('reason') || '').trim() };
    if (!payload.title || !payload.artist) return;
    const { error } = await client.from('song_requests').insert(payload);
    if (error) console.warn('VYBE request sync failed', error); else toast('Request sent to VYBE');
  }

  async function saveSubmission(form) {
    if (!client) return;
    const fd = new FormData(form);
    const { data } = await client.auth.getUser();
    const u = data?.user;
    const file = fd.get('audio');
    let audioPath = null;
    if (file instanceof File && file.size) {
      if (!u) return toast('Sign in before uploading an audio file');
      const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 120);
      audioPath = `${u.id}/${Date.now()}-${safe}`;
      const upload = await client.storage.from(cfg.musicBucket || 'music').upload(audioPath, file, { upsert: false, contentType: file.type || 'audio/mpeg', cacheControl: '31536000' });
      if (upload.error) { console.warn(upload.error); return toast('Audio upload failed'); }
    }
    const payload = {
      owner_id: u?.id || null,
      artist_name: String(fd.get('artist') || '').trim(),
      contact_email: String(fd.get('email') || '').trim(),
      song_title: String(fd.get('title') || '').trim(),
      genre: String(fd.get('genre') || '').trim(),
      source_url: String(fd.get('url') || '').trim(),
      lyrics: String(fd.get('lyrics') || ''),
      audio_path: audioPath,
      rights_confirmed: Boolean(fd.get('rights')),
      status: 'under_review'
    };
    if (!payload.artist_name || !payload.song_title || !payload.contact_email || !payload.rights_confirmed) return;
    const { error } = await client.from('artist_submissions').insert(payload);
    if (error) console.warn('VYBE submission sync failed', error); else toast('Submission sent for review');
  }

  function wireForms() {
    document.addEventListener('submit', e => {
      if (e.target?.id === 'requestForm') saveRequest(e.target);
      if (e.target?.id === 'submitForm') saveSubmission(e.target);
    }, true);
  }

  async function init() {
    addAccountButton();
    wireForms();
    if (client) {
      await refreshUser();
      client.auth.onAuthStateChange((_event, session) => { user = session?.user || null; refreshUser(); });
    }
    window.VYBE_DB_STATUS = ready ? 'connected' : 'not-configured';
    document.documentElement.dataset.vybeBackend = client ? 'connected' : 'offline';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();
