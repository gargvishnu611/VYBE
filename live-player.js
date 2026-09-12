/* VYBE — production audio/catalogue runtime
   Published Supabase songs only. No placeholder playback, no fake catalogue.
*/
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (seconds) => {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const cfg = () => window.VYBE_CONFIG || {};
  const state = {
    songs: [], index: -1, audio: null, visualRaf: 0, bound: false, dbReady: false,
    reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
    pageVisible: !document.hidden, filter: 'all'
  };

  const storageUrl = (path, bucket) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const base = String(cfg().supabaseUrl || '').replace(/\/$/, '');
    return base ? `${base}/storage/v1/object/public/${bucket}/${String(path).split('/').map(encodeURIComponent).join('/')}` : '';
  };
  const audioUrl = (song) => storageUrl(song.audio_path, cfg().musicBucket || 'music') || song.source_url || '';
  const coverUrl = (song) => storageUrl(song.cover_path, cfg().artworkBucket || 'artwork');
  const toast = (message) => {
    const t = $('vybeToast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  function ensureAudio() {
    if (state.audio) return state.audio;
    const a = new Audio();
    a.preload = 'metadata';
    a.volume = 1;
    a.addEventListener('loadedmetadata', syncUI);
    a.addEventListener('timeupdate', syncUI);
    a.addEventListener('play', () => syncButtons(true));
    a.addEventListener('pause', () => syncButtons(false));
    a.addEventListener('ended', () => next(true));
    a.addEventListener('error', () => toast('This song could not be played right now.'));
    state.audio = a;
    return a;
  }

  function syncButtons(playing) {
    const p = $('playButton'); if (p) p.textContent = playing ? '❚❚' : '▶';
    const d = $('dockPlay'); if (d) d.querySelector('span')?.replaceChildren(document.createTextNode(playing ? '❚❚' : '▶'));
    const e = $('experienceButton'); if (e) e.textContent = playing ? 'Playing' : 'Start experience';
    document.documentElement.dataset.vybePlaying = playing ? 'true' : 'false';
  }

  function setText(id, value) { const el = $(id); if (el) el.textContent = value; }
  function updateMeta(song) {
    setText('playerTitle', song.title || 'VYBE');
    setText('playerArtist', song.artist || 'VYBE Artist');
    setText('heroTrack', song.title || 'VYBE');
    setText('heroArtist', song.artist || 'VYBE Artist');
    setText('heroEnergy', song.bpm ? `${song.bpm} BPM` : 'VYBE');
    setText('heroMood', song.mood || song.genre || 'VYBE');
    setText('albumBpm', song.bpm ? `${song.bpm} BPM` : 'VYBE');
    setText('signalBpm', song.bpm || '—');
    setText('sceneTrack', String(song.title || 'VYBE').toUpperCase());
    setText('sceneMood', String(song.mood || song.genre || 'VYBE').toUpperCase());
    setText('lyricsTrackName', String(song.title || 'VYBE').toUpperCase());
    setText('lyricsDuration', fmt(song.duration_seconds));
    document.title = `${song.title || 'VYBE'} · VYBE`;
    const thumb = $('playerThumb');
    if (thumb) {
      thumb.className = `player-thumb ${song.art || 'art-a'}`;
      const cover = coverUrl(song);
      thumb.style.backgroundImage = cover ? `url("${cover.replace(/"/g, '%22')}")` : '';
      thumb.style.backgroundSize = 'cover'; thumb.style.backgroundPosition = 'center';
    }
  }

  function renderLyrics(song) {
    const box = $('lyricsCopy'); if (!box) return;
    const lines = String(song.lyrics || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    box.innerHTML = lines.length
      ? lines.map((line, i) => `<p class="lyric-line${i === 0 ? ' active' : ''}" data-time="${song.duration_seconds ? Math.round(i * song.duration_seconds / Math.max(1, lines.length)) : 0}">${esc(line)}</p>`).join('')
      : '<p class="lyric-line active" data-time="0">Lyrics are not available for this release.</p>';
  }

  function syncUI() {
    const a = state.audio, s = state.songs[state.index];
    if (!a || !s) return;
    const duration = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : Number(s.duration_seconds) || 0;
    const pos = Number(a.currentTime) || 0;
    setText('currentTime', fmt(pos)); setText('duration', fmt(duration)); setText('lyricClock', fmt(pos));
    const range = $('progress'); if (range) { range.max = duration || 0; range.value = Math.min(pos, duration || 0); }
    const lp = $('lyricsProgress')?.querySelector('i'); if (lp) lp.style.height = `${duration ? Math.min(100, pos / duration * 100) : 0}%`;
    let active = 0;
    document.querySelectorAll('.lyric-line').forEach((line, i) => { if (pos >= Number(line.dataset.time || 0)) active = i; line.classList.toggle('active', i === active); });
  }

  function visualLoop() {
    if (!state.pageVisible || state.reduced || !state.audio || state.audio.paused) { state.visualRaf = 0; return; }
    const song = state.songs[state.index];
    const bpm = Number(song?.bpm) || 100;
    const beat = performance.now() / 1000 * bpm / 60;
    document.querySelectorAll('#signalBars i').forEach((bar, i) => { bar.style.height = `${18 + Math.abs(Math.sin(beat * 1.2 + i * .72)) * 70}%`; });
    const album = $('albumCard');
    if (album) { album.classList.toggle('is-beat', Math.sin(beat * Math.PI * 2) > .9); album.style.scale = String(1 + Math.sin(beat * Math.PI * 2) * .009); }
    state.visualRaf = requestAnimationFrame(visualLoop);
  }
  function startVisuals() { if (!state.visualRaf && !state.reduced) state.visualRaf = requestAnimationFrame(visualLoop); }

  async function playAt(index, autoplay = true) {
    if (!state.songs.length) { toast('No published songs yet.'); return; }
    state.index = (index + state.songs.length) % state.songs.length;
    const song = state.songs[state.index];
    const src = audioUrl(song);
    if (!src) { toast('This release has no playable audio yet.'); return; }
    const a = ensureAudio();
    const absolute = new URL(src, location.href).href;
    if (a.src !== absolute) { a.pause(); a.src = absolute; a.load(); }
    updateMeta(song); renderLyrics(song); syncUI();
    if (autoplay) {
      try { await a.play(); } catch (_) { toast('Tap Play to start the song.'); }
    }
    startVisuals();
    try {
      if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist, album: 'VYBE' });
    } catch (_) {}
    syncButtons(!a.paused);
  }

  function next(auto = false) { if (!state.songs.length) return; playAt(state.index + 1, true); if (!auto) toast('Next song'); }
  function previous() { const a = state.audio; if (a && a.currentTime > 4) { a.currentTime = 0; return; } if (state.songs.length) playAt(state.index - 1, true); }
  function toggle() { const a = ensureAudio(); if (!state.songs.length) return toast('No published songs yet.'); if (!a.src) return playAt(Math.max(0, state.index), true); if (a.paused) a.play().catch(() => toast('Tap Play to start the song.')); else a.pause(); }
  function shuffle() { if (state.songs.length) playAt(Math.floor(Math.random() * state.songs.length), true); }

  function renderCards() {
    const grid = $('trackGrid'); if (!grid) return;
    const filtered = state.songs.filter(song => state.filter === 'all' || [song.language, song.genre, song.mood, ...(song.tags || [])].join(' ').toLowerCase().includes(state.filter));
    grid.innerHTML = filtered.map((song, i) => `<button class="track-card magnetic reveal-up" data-live-index="${state.songs.indexOf(song)}"><div class="track-head"><span>${String(i + 1).padStart(2, '0')}</span><span>${fmt(song.duration_seconds)}</span></div><div class="track-art ${song.art}"${coverUrl(song) ? ` style="background-image:url('${esc(coverUrl(song))}');background-size:cover;background-position:center"` : ''}><i></i><b></b></div><div class="track-info"><div><strong>${esc(song.title)}</strong><small>${esc(song.artist)}</small></div><em>${song.bpm ? esc(song.bpm) : '—'}</em></div></button>`).join('');
    if (!filtered.length) grid.innerHTML = '<div id="liveEmptyState"><div><strong>No releases in this filter.</strong><span>Try another filter.</span></div></div>';
    grid.querySelectorAll('[data-live-index]').forEach(card => card.addEventListener('click', () => playAt(Number(card.dataset.liveIndex), true)));
  }

  function renderArtists() {
    const stage = document.querySelector('.artist-stage');
    const section = document.querySelector('.artists-section');
    if (!stage || !section) return;
    const names = [...new Map(state.songs.map(s => [s.artist, s])).values()].slice(0, 3);
    if (!names.length) { section.style.display = 'none'; return; }
    section.style.display = '';
    stage.innerHTML = names.map((song, i) => `<div class="artist-card ${i === 0 ? 'artist-main' : ''} reveal-up"><div class="artist-avatar av-${String.fromCharCode(97 + (i % 3))}">${esc(String(song.artist || 'V').slice(0,2).toUpperCase())}</div><div><small>${i === 0 ? 'FEATURED' : 'RELEASE'}</small><strong>${esc(song.artist || 'VYBE Artist')}</strong><span>${esc(song.genre || song.language || 'Independent artist')}</span></div><button class="round-button magnetic" aria-label="Play artist" data-artist-play="${esc(song.id)}">↗</button></div>`).join('');
    stage.querySelectorAll('[data-artist-play]').forEach(b => b.addEventListener('click', () => { const i = state.songs.findIndex(s => s.id === b.dataset.artistPlay); if (i >= 0) playAt(i, true); }));
  }

  function renderSearch(query) {
    const box = $('searchResults'); if (!box) return;
    const q = String(query || '').trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }
    const found = state.songs.filter(s => `${s.title} ${s.artist} ${s.genre} ${s.language} ${s.mood} ${(s.tags || []).join(' ')}`.toLowerCase().includes(q)).slice(0, 12);
    box.innerHTML = found.length ? found.map(s => `<button class="result" data-search-song="${esc(s.id)}"><span><strong>${esc(s.title)}</strong><small>${esc(s.artist)}${s.mood ? ` · ${esc(s.mood)}` : ''}</small></span><em>PLAY</em></button>`).join('') : '<div class="result"><strong>No songs found.</strong></div>';
    box.querySelectorAll('[data-search-song]').forEach(b => b.addEventListener('click', () => { const i = state.songs.findIndex(s => s.id === b.dataset.searchSong); if (i >= 0) { playAt(i, true); $('searchModal')?.classList.remove('open'); } }));
  }

  async function loadSongs() {
    const client = window.VYBE_DB?.client?.();
    if (!client) return false;
    const { data, error } = await client.from('songs').select('id,title,slug,artist_id,audio_path,cover_path,lyrics,language,genre,mood,tags,bpm,duration_seconds,status,source_type,source_url,artists(name)').eq('status','published').order('published_at', { ascending: false }).limit(200);
    if (error || !Array.isArray(data)) { console.warn('VYBE catalogue load failed', error); return false; }
    state.songs = data.map((s, i) => ({ id:s.id, title:s.title, artist:s.artists?.name || 'VYBE Artist', audio_path:s.audio_path, cover_path:s.cover_path, source_url:s.source_url || '', lyrics:s.lyrics || '', language:s.language || '', genre:s.genre || '', mood:s.mood || '', tags:Array.isArray(s.tags) ? s.tags : [], bpm:s.bpm || 0, duration_seconds:s.duration_seconds || 0, art:`art-${String.fromCharCode(97 + (i % 4))}` }));
    state.dbReady = true;
    window.__VYBE_LIVE_READY = true;
    renderCards(); renderArtists();
    if (state.songs.length) { $('playerBar')?.removeAttribute('data-placeholder-hidden'); $('playerBar')?.style.removeProperty('display'); await playAt(0, false); }
    else { window.VYBE_PRODUCTION_UI?.showEmptyCatalogue('New releases appear here after they are approved.'); }
    return true;
  }

  function bindControls() {
    if (state.bound) return; state.bound = true;
    document.addEventListener('click', (event) => {
      const el = event.target.closest('button'); if (!el) return;
      const handlers = {
        playButton: toggle, dockPlay: toggle, experienceButton: toggle, finalPlayButton: toggle,
        nextButton: next, prevButton: previous, shuffleButton: shuffle,
        muteButton: () => { const a=ensureAudio(); a.muted=!a.muted; el.textContent=a.muted?'MUTE':'VOL'; }
      };
      const fn = handlers[el.id]; if (!fn) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); fn();
    }, true);
    document.addEventListener('input', (event) => {
      if (event.target?.id !== 'progress') return;
      const a=ensureAudio(); if (Number.isFinite(a.duration)) { event.stopImmediatePropagation(); a.currentTime=Number(event.target.value); syncUI(); }
    }, true);
    document.addEventListener('keydown', (event) => {
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      if (event.code === 'Space') { event.preventDefault(); toggle(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
    });
    document.addEventListener('visibilitychange', () => { state.pageVisible = !document.hidden; if (state.pageVisible && state.audio && !state.audio.paused) startVisuals(); });
    $('searchInput')?.addEventListener('input', (e) => renderSearch(e.target.value));
    $('filterStatus')?.setAttribute('aria-live', 'polite');
    document.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => { state.filter=btn.dataset.filter || 'all'; renderCards(); }));
  }

  async function boot() {
    bindControls();
    const started = Date.now();
    while (!window.VYBE_DB?.ready?.() && Date.now() - started < 10000) await new Promise(r => setTimeout(r, 250));
    await loadSongs();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
