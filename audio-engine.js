/* VYBE — real audio engine
   Connects the visible player to HTML5 audio and published Supabase songs.
   Keeps the existing visual runtime, but replaces demo oscillator playback with real recordings.
*/
(() => {
  const $ = (id) => document.getElementById(id);
  const config = () => window.VYBE_CONFIG || {};
  const state = {
    audio: null,
    catalog: [],
    index: -1,
    loaded: false,
    muted: false,
    volume: 1,
    raf: 0,
    bound: false,
    localCards: []
  };

  const fmt = (sec) => {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };
  const esc = (v='') => String(v).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const storageUrl = (path, bucket = 'music') => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const base = String(config().supabaseUrl || '').replace(/\/$/, '');
    return base ? `${base}/storage/v1/object/public/${bucket}/${String(path).split('/').map(encodeURIComponent).join('/')}` : '';
  };
  const trackSrc = (t) => t.audioSrc || storageUrl(t.audio_path, config().musicBucket || 'music') || t.source_url || '';
  const linesFor = (t) => Array.isArray(t.lyrics) ? t.lyrics : String(t.lyrics || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);

  function ensureAudio() {
    if (state.audio) return state.audio;
    const a = new Audio();
    a.preload = 'metadata';
    a.crossOrigin = 'anonymous';
    a.volume = state.volume;
    a.addEventListener('timeupdate', syncUI);
    a.addEventListener('loadedmetadata', syncUI);
    a.addEventListener('ended', () => next(true));
    a.addEventListener('play', () => { document.documentElement.dataset.vybePlaying = 'true'; syncPlayButtons(true); });
    a.addEventListener('pause', () => { document.documentElement.dataset.vybePlaying = 'false'; syncPlayButtons(false); });
    a.addEventListener('error', () => toast('This VYBE audio could not be loaded'));
    state.audio = a;
    return a;
  }

  function toast(text) {
    const t = $('vybeToast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function syncPlayButtons(playing) {
    const play = $('playButton');
    if (play) play.textContent = playing ? '❚❚' : '▶';
    const dock = $('dockPlay');
    if (dock) dock.querySelector('span')?.replaceChildren(document.createTextNode(playing ? '❚❚' : '▶'));
    const exp = $('experienceButton');
    if (exp && playing) exp.querySelector('span')?.replaceChildren(document.createTextNode('❚❚'));
  }

  function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
  function setClass(id, cls) { const el = $(id); if (el) el.className = cls; }

  function updateTrackMeta(t) {
    setText('playerTitle', t.title || 'VYBE');
    setText('playerArtist', t.artist || 'VYBE Artist');
    setClass('playerThumb', `player-thumb ${t.art || 'art-a'}`);
    setText('heroTrack', t.title || 'VYBE');
    setText('heroArtist', t.artist || 'VYBE Artist');
    setText('heroEnergy', t.bpm ? `${t.bpm} BPM` : 'VYBE');
    setText('heroMood', t.mood || 'VYBE');
    const albumTitle = $('albumTitle'); if (albumTitle) albumTitle.innerHTML = esc((t.title || 'VYBE').toUpperCase()).replace(/ /g, '<br>');
    setText('albumBpm', t.bpm ? `${t.bpm} BPM` : 'VYBE');
    setText('albumNumber', String(state.index + 1).padStart(3, '0'));
    setText('signalBpm', t.bpm || '—');
    setText('sceneTrack', String(t.title || 'VYBE').toUpperCase());
    setText('sceneMood', String(t.mood || 'VYBE').toUpperCase());
    setText('lyricsTrackName', String(t.title || 'VYBE').toUpperCase());
    if (t.duration) setText('lyricsDuration', fmt(t.duration));
    document.title = `${t.title || 'VYBE'} · VYBE`;
  }

  function renderLyrics(t) {
    const copy = $('lyricsCopy');
    if (!copy) return;
    const lines = linesFor(t);
    copy.innerHTML = lines.length
      ? lines.map((line, i) => `<p class="lyric-line${i === 0 ? ' active' : ''}" data-time="${t.duration ? Math.round(i * t.duration / Math.max(1, lines.length)) : 0}">${esc(line)}</p>`).join('')
      : '<p class="lyric-line active" data-time="0">Lyrics coming soon.</p>';
  }

  function syncUI() {
    const a = state.audio;
    const t = state.catalog[state.index];
    if (!a || !t) return;
    const duration = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : (t.duration || 0);
    const pos = a.currentTime || 0;
    setText('currentTime', fmt(pos));
    setText('duration', fmt(duration));
    const range = $('progress');
    if (range) { range.max = duration || 0; range.value = Math.min(pos, duration || 0); }
    setText('lyricClock', fmt(pos));
    const lp = $('lyricsProgress')?.querySelector('i');
    if (lp) lp.style.height = `${duration ? Math.min(100, pos / duration * 100) : 0}%`;
    let active = 0;
    document.querySelectorAll('.lyric-line').forEach((line, i) => {
      if (pos >= Number(line.dataset.time || 0)) active = i;
      line.classList.toggle('active', i === active);
    });
    document.querySelectorAll('.track-card').forEach((c, i) => c.classList.toggle('selected', t._localIndex === i && state.catalog.includes(t)));
  }

  function animate() {
    const a = state.audio;
    const t = state.catalog[state.index];
    if (a && !a.paused && t) {
      const bpm = Number(t.bpm) || 100;
      const beat = (performance.now() / 1000) * bpm / 60;
      const pulse = Math.sin(beat * Math.PI * 2);
      document.querySelectorAll('#signalBars i').forEach((bar, i) => {
        bar.style.height = `${18 + Math.abs(Math.sin(beat * 1.35 + i * .72)) * 76}%`;
      });
      $('albumCard')?.classList.toggle('is-beat', pulse > .88);
      const scale = 1 + pulse * .012;
      const album = $('albumCard'); if (album) album.style.scale = String(scale);
    }
    state.raf = requestAnimationFrame(animate);
  }

  async function playAt(i, autoplay = true) {
    if (!state.catalog.length) return;
    state.index = (i + state.catalog.length) % state.catalog.length;
    const t = state.catalog[state.index];
    const src = trackSrc(t);
    if (!src) { toast('No audio source is published for this song yet'); return; }
    const a = ensureAudio();
    if (a.src !== new URL(src, location.href).href) { a.pause(); a.src = src; a.load(); }
    updateTrackMeta(t);
    renderLyrics(t);
    if (autoplay) {
      try { await a.play(); }
      catch (_) { toast('Tap Play once more to start this audio'); }
    }
    syncUI();
  }

  async function toggle() {
    const a = ensureAudio();
    if (!state.catalog.length) return;
    if (!a.src) return playAt(Math.max(0, state.index), true);
    if (a.paused) { try { await a.play(); } catch (_) {} }
    else a.pause();
  }
  function next(auto = false) { if (!state.catalog.length) return; playAt(state.index + 1, true); if (!auto) toast('Next VYBE'); }
  function prev() { if (!state.catalog.length) return; const a = state.audio; if (a && a.currentTime > 4) { a.currentTime = 0; return; } playAt(state.index - 1, true); }
  function setMuted() { const a = ensureAudio(); state.muted = !state.muted; a.muted = state.muted; const b = $('muteButton'); if (b) b.textContent = state.muted ? 'MUTE' : 'VOL'; }
  function shuffle() { if (!state.catalog.length) return; playAt(Math.floor(Math.random() * state.catalog.length), true); }

  function stopEvent(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
  }

  function bindCaptureControls() {
    if (state.bound) return;
    state.bound = true;
    document.addEventListener('click', ev => {
      const el = ev.target.closest('button, .track-card, [data-play], [data-i], [data-db-song]');
      if (!el) return;
      if (el.id === 'playButton' || el.id === 'dockPlay' || el.id === 'experienceButton' || el.id === 'finalPlayButton') { stopEvent(ev); toggle(); return; }
      if (el.id === 'nextButton') { stopEvent(ev); next(); return; }
      if (el.id === 'prevButton') { stopEvent(ev); prev(); return; }
      if (el.id === 'muteButton') { stopEvent(ev); setMuted(); return; }
      if (el.id === 'shuffleButton') { stopEvent(ev); shuffle(); return; }
      const card = el.closest('.track-card');
      if (card) {
        const i = Number(card.dataset.index);
        const demo = state.catalog.findIndex(t => t._localIndex === i);
        if (demo >= 0) { stopEvent(ev); playAt(demo, true); return; }
      }
      const play = el.dataset.play;
      if (play != null && /^\d+$/.test(play)) { stopEvent(ev); playAt(Number(play), true); return; }
      const db = el.dataset.dbSong;
      if (db) {
        const i = state.catalog.findIndex(t => t.id === db);
        if (i >= 0) { stopEvent(ev); playAt(i, true); return; }
      }
      const result = el.matches('.result[data-i]') ? Number(el.dataset.i) : -1;
      if (result >= 0) {
        const i = state.catalog.findIndex(t => t._localIndex === result);
        if (i >= 0) { stopEvent(ev); playAt(i, true); }
      }
    }, true);
    document.addEventListener('input', ev => {
      if (ev.target?.id === 'progress') {
        const a = ensureAudio();
        if (Number.isFinite(a.duration)) { stopEvent(ev); a.currentTime = Number(ev.target.value); syncUI(); }
      }
    }, true);
  }

  function renderLiveResults(query) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return;
    const box = $('searchResults'); if (!box) return;
    const found = state.catalog.filter(t => t._db && `${t.title} ${t.artist} ${t.genre} ${t.language} ${t.mood}`.toLowerCase().includes(q)).slice(0, 8);
    if (!found.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'vybe-card';
    wrap.style.marginTop = '10px';
    wrap.innerHTML = `<span class="vybe-pill">LIVE CATALOGUE</span><strong>${found.length} real song${found.length > 1 ? 's' : ''}</strong>${found.map(t => `<button class="result" data-real-song="${esc(t.id)}"><span><strong>${esc(t.title)}</strong><small>${esc(t.artist)} · ${esc(t.mood || t.genre || 'Published')}</small></span><em>PLAY</em></button>`).join('')}`;
    box.appendChild(wrap);
    wrap.querySelectorAll('[data-real-song]').forEach(btn => btn.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); const i = state.catalog.findIndex(t => t.id === btn.dataset.realSong); if (i >= 0) playAt(i, true); }));
  }

  async function loadPublished() {
    const client = window.VYBE_DB?.client?.();
    if (!client) return false;
    const { data, error } = await client.from('songs').select('id,title,slug,artist_id,audio_path,cover_path,lyrics,language,genre,mood,tags,bpm,duration_seconds,status,source_type,source_url,artists(name)').eq('status','published').order('published_at', { ascending: false }).limit(100);
    if (error || !Array.isArray(data)) return false;
    const db = data.map((s, i) => ({
      id: s.id,
      _db: true,
      _localIndex: -1,
      title: s.title,
      artist: s.artists?.name || 'VYBE Artist',
      bpm: s.bpm || 100,
      mood: s.mood || 'VYBE',
      genre: s.genre || '',
      language: s.language || '',
      tags: Array.isArray(s.tags) ? s.tags : [],
      duration: s.duration_seconds || 0,
      lyrics: s.lyrics || '',
      audio_path: s.audio_path,
      cover_path: s.cover_path,
      source_url: s.source_url || '',
      art: `art-${String.fromCharCode(97 + (i % 4))}`
    }));
    state.catalog = state.localCards.concat(db);
    // Build extra live cards without disturbing the visual demo catalogue.
    const grid = $('trackGrid');
    if (grid && db.length && !document.getElementById('liveCatalogueCards')) {
      const wrap = document.createElement('div');
      wrap.id = 'liveCatalogueCards';
      wrap.className = 'track-grid live-catalogue-grid';
      wrap.style.marginTop = '18px';
      wrap.innerHTML = db.map((t, i) => `<button class="track-card magnetic reveal-up" data-db-live="${esc(t.id)}"><div class="track-head"><span>DB ${String(i + 1).padStart(2,'0')}</span><span>${t.duration ? fmt(t.duration) : 'LIVE'}</span></div><div class="track-art ${t.art}"><i></i><b></b></div><div class="track-info"><div><strong>${esc(t.title)}</strong><small>${esc(t.artist)}</small></div><em>${esc(t.bpm)}</em></div></button>`).join('');
      grid.insertAdjacentElement('afterend', wrap);
      wrap.querySelectorAll('[data-db-live]').forEach(card => card.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); const i = state.catalog.findIndex(t => t.id === card.dataset.dbLive); if (i >= 0) playAt(i, true); }));
    }
    return true;
  }

  function snapshotLocalCatalogue() {
    // Mirror the six demo cards already rendered by app.js.
    state.localCards = [...document.querySelectorAll('#trackGrid .track-card')].slice(0, 100).map((c, i) => ({
      _localIndex: Number(c.dataset.index ?? i),
      title: c.querySelector('.track-info strong')?.textContent?.trim() || `VYBE ${i + 1}`,
      artist: c.querySelector('.track-info small')?.textContent?.trim() || 'VYBE Demo',
      bpm: Number(c.querySelector('.track-info em')?.textContent?.trim()) || 100,
      duration: Number((c.querySelector('.track-head span:last-child')?.textContent || '').split(':').reduce((a,v)=>a*60+Number(v),0)) || 0,
      mood: '', tags: (c.dataset.tags || '').split(/\s+/).filter(Boolean), art: [...c.querySelector('.track-art')?.classList || []].find(x => /^art-/.test(x)) || 'art-a',
      lyrics: []
    }));
    state.catalog = state.localCards.slice();
  }

  async function boot() {
    bindCaptureControls();
    snapshotLocalCatalogue();
    animate();
    const started = Date.now();
    while (!window.VYBE_DB?.ready?.() && Date.now() - started < 10000) await new Promise(r => setTimeout(r, 250));
    await loadPublished();
    if (window.VYBE_DB?.client?.()) toast('VYBE audio engine connected');
    const input = $('searchInput');
    if (input) {
      let timer;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => renderLiveResults(input.value), 350);
      });
    }
    document.addEventListener('click', ev => {
      const b = ev.target.closest('[data-real-song]');
      if (!b) return;
      const i = state.catalog.findIndex(t => t.id === b.dataset.realSong);
      if (i >= 0) playAt(i, true);
    }, true);
    document.addEventListener('change', ev => {
      if (ev.target?.id === 'progress') { const a = ensureAudio(); if (Number.isFinite(a.duration)) a.currentTime = Number(ev.target.value); }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
