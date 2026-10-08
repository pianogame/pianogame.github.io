(() => {
  'use strict';

  const home = document.getElementById('hp-home-screen');
  const piano = document.getElementById('hp-four88');
  if (!home || !piano) return;

  const pianoButton = home.querySelector('[data-home-action="piano"]');
  const gameButton = home.querySelector('[data-home-action="game"]');
  const characterButton = home.querySelector('[data-home-action="character-talk"]');
  const dialogue = home.querySelector('[data-home-dialogue]');
  const homeButton = piano.querySelector('[data-home-action="home"]');
  if (!pianoButton || !homeButton) return;

  const homeBackground = home.querySelector('.hp-home-bg');
  let homeBackgroundReady = false;
  function markHomeBackgroundReady() {
    if (!homeBackground || homeBackgroundReady) return;
    homeBackgroundReady = true;
    home.classList.add('hp-home-background-ready');
  }
  function prioritizeHomeBackground() {
    if (!homeBackground) return Promise.resolve(false);
    if (homeBackground.complete && homeBackground.naturalWidth > 0) {
      markHomeBackgroundReady();
      return homeBackground.decode?.().catch(() => {}).then(() => true) || Promise.resolve(true);
    }
    return new Promise(resolve => {
      const done = ok => { if (ok) markHomeBackgroundReady(); resolve(ok); };
      homeBackground.addEventListener('load', () => done(true), { once:true });
      homeBackground.addEventListener('error', () => done(false), { once:true });
      // Never replace the fallback with black if the network stalls.
      setTimeout(() => resolve(false), 1800);
    });
  }
  void prioritizeHomeBackground();

  let homeTapGraph = null;
  let homeTapBuffer = null;
  let homeTapLoading = null;
  let homeTapCurrent = null;

  function prepareHomeTapSound() {
    if (homeTapBuffer) return Promise.resolve();
    if (homeTapLoading) return homeTapLoading;
    try {
      const bridge = window.HP_AUDIO_BRIDGE?.get?.();
      if (!bridge) return Promise.resolve();
      if (!homeTapGraph) {
        const gain = bridge.context.createGain();
        window.HP_SOUND_SETTINGS.bind('effects', gain);
        gain.connect(bridge.output);
        homeTapGraph = { context: bridge.context, gain };
      }
      homeTapLoading = fetch('/audio/home-button-tap.mp3?v=1')
        .then(response => {
          if (!response.ok) throw new Error('Tap sound unavailable');
          return response.arrayBuffer();
        })
        .then(data => homeTapGraph.context.decodeAudioData(data))
        .then(buffer => { homeTapBuffer = buffer; })
        .catch(() => {})
        .finally(() => { homeTapLoading = null; });
      return homeTapLoading;
    } catch (_) { return Promise.resolve(); }
  }

  function stopHomeTapSound() {
    const current = homeTapCurrent;
    homeTapCurrent = null;
    if (!current) return;
    const now = homeTapGraph.context.currentTime;
    // A tiny crossfade avoids clicks without accumulating overlapping effects.
    current.gain.gain.setValueAtTime(current.gain.gain.value, now);
    current.gain.gain.linearRampToValueAtTime(0, now + .008);
    try { current.source.stop(now + .008); } catch (_) {}
  }

  function playHomeTapSound() {
    const start = () => {
      try {
        if (!homeTapBuffer || !homeTapGraph) return false;
        stopHomeTapSound();
        const { context } = homeTapGraph;
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = homeTapBuffer;
        source.connect(gain); gain.connect(homeTapGraph.gain);
        const current = { source, gain };
        homeTapCurrent = current;
        source.onended = () => {
          try { source.disconnect(); gain.disconnect(); } catch (_) {}
          if (homeTapCurrent === current) homeTapCurrent = null;
        };
        source.start();
        return true;
      } catch (_) {
        return false;
      }
    };

    try {
      // Resume from the real user gesture first. On iOS/PWA the context can
      // become suspended again after screen/app changes.
      const resumed = window.HP_AUDIO_BRIDGE?.resume?.();
      if (homeTapBuffer && homeTapGraph?.context?.state === 'running') {
        start();
        return;
      }
      void Promise.resolve(resumed)
        .catch(() => {})
        .then(() => prepareHomeTapSound())
        .then(() => { start(); })
        .catch(() => {});
    } catch (_) {
      void prepareHomeTapSound().then(() => { start(); }).catch(() => {});
    }
  }

  function playGachaMenuTapSound() {
    try {
      const bridge = window.HP_AUDIO_BRIDGE?.get?.();
      if (!bridge) return;
      void window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
      const ctx = bridge.context;
      const now = ctx.currentTime;

      const master = ctx.createGain();
      master.gain.setValueAtTime(.0001, now);
      master.gain.exponentialRampToValueAtTime(.48, now + .012);
      master.gain.exponentialRampToValueAtTime(.0001, now + .46);
      window.HP_SOUND_SETTINGS?.bind?.('effects', master);
      master.connect(bridge.output);

      // Short premium "gacha entrance" cue: a soft low hit followed by
      // three glass-like rising tones. Deliberately distinct from the title/home tap.
      const tones = [
        { frequency:220.00, start:0,    end:.23, type:'sine',     level:.20 },
        { frequency:659.25, start:.035, end:.27, type:'triangle', level:.18 },
        { frequency:987.77, start:.095, end:.34, type:'sine',     level:.15 },
        { frequency:1318.51,start:.155, end:.42, type:'sine',     level:.12 },
      ];

      tones.forEach(({ frequency, start, end, type, level }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now + start);
        gain.gain.setValueAtTime(.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(level, now + start + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, now + end);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now + start);
        osc.stop(now + end + .02);
      });

      setTimeout(() => {
        try { master.disconnect(); } catch (_) {}
      }, 650);
    } catch (_) {}
  }

  function playGachaPullTapSound() {
    try {
      const bridge = window.HP_AUDIO_BRIDGE?.get?.();
      if (!bridge) return;
      void window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
      stopHomeTapSound();
      const ctx = bridge.context;
      const now = ctx.currentTime;

      const master = ctx.createGain();
      master.gain.setValueAtTime(.0001, now);
      master.gain.exponentialRampToValueAtTime(.58, now + .008);
      master.gain.exponentialRampToValueAtTime(.0001, now + .68);
      window.HP_SOUND_SETTINGS?.bind?.('effects', master);
      master.connect(bridge.output);

      // Gacha pull cue: deeper "don" impact + sparkling upward sweep.
      // This intentionally does not reuse the title/home button tap.
      const tones = [
        { frequency:130.81, start:0,    peak:.28, end:.22, type:'sine' },
        { frequency:523.25, start:.045, peak:.20, end:.27, type:'triangle' },
        { frequency:783.99, start:.105, peak:.17, end:.36, type:'sine' },
        { frequency:1046.50,start:.165, peak:.14, end:.47, type:'sine' },
        { frequency:1567.98,start:.245, peak:.10, end:.60, type:'triangle' },
      ];

      tones.forEach(({ frequency, start, peak, end, type }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now + start);
        gain.gain.setValueAtTime(.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(peak, now + start + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, now + end);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now + start);
        osc.stop(now + end + .025);
      });

      setTimeout(() => {
        try { master.disconnect(); } catch (_) {}
      }, 850);
    } catch (_) {}
  }
  void prepareHomeTapSound();
  window.addEventListener('hp-curtain-start', () => { void prepareHomeTapSound(); });
  window.addEventListener('pagehide', stopHomeTapSound);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopHomeTapSound(); });

  const touchLayer = document.createElement('div');
  touchLayer.className = 'hp-home-touch-layer';
  touchLayer.setAttribute('aria-hidden', 'true');
  home.appendChild(touchLayer);
  const openingTouchLayer = document.createElement('div');
  openingTouchLayer.className = 'hp-home-touch-layer hp-opening-touch-layer';
  openingTouchLayer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(openingTouchLayer);
  let touchSequence = 0;
  function showTouchEffect(clientX, clientY, inOpening = false) {
    if (!inOpening && (home.hidden || document.body.classList.contains('hp-booting')
      || document.documentElement.classList.contains('hp-install-required'))) return;
    const bounds = home.getBoundingClientRect();
    const rotated = document.documentElement.dataset.hpRotated === 'true';
    const x = inOpening ? clientX : rotated ? (clientY - bounds.top) * home.clientWidth / bounds.height
      : (clientX - bounds.left) * home.clientWidth / bounds.width;
    const y = inOpening ? clientY : rotated ? (bounds.right - clientX) * home.clientHeight / bounds.width
      : (clientY - bounds.top) * home.clientHeight / bounds.height;
    const layer = inOpening ? openingTouchLayer : touchLayer;
    while (layer.childElementCount >= 10) layer.firstElementChild.remove();
    const effect = document.createElement('span');
    effect.className = 'hp-home-touch-effect';
    effect.classList.toggle('hp-touch-on-light', inOpening && document.documentElement.classList.contains('hp-opening-orientation-bg'));
    effect.style.left = x + 'px'; effect.style.top = y + 'px';
    effect.style.setProperty('--touch-scale', Math.max(.65, Math.min(1, (inOpening ? innerWidth : home.clientWidth) / 1200)));
    const staff = document.createElement('span'); staff.className = 'hp-home-touch-staff';
    effect.appendChild(staff);
    ['♪', '♫', '♬'].forEach((glyph, index) => {
      const note = document.createElement('span'); note.className = 'hp-home-touch-note';
      note.textContent = glyph; note.style.setProperty('--note-x', ((index - 1) * 24) + 'px');
      note.style.setProperty('--note-rise', (40 + ((index + touchSequence) % 3) * 12) + 'px');
      note.style.setProperty('--note-delay', (index * .035) + 's'); effect.appendChild(note);
    });
    touchSequence++;
    layer.appendChild(effect);
    setTimeout(() => effect.remove(), 850);
  }
  document.addEventListener('pointerdown', event => {
    if (event.button > 0) return;
    const opening = document.getElementById('hp-opening-sequence');
    if (opening && !opening.hidden) {
      showTouchEffect(event.clientX, event.clientY, true);
    } else if (home.contains(event.target)) {
      showTouchEffect(event.clientX, event.clientY);
    }
  }, { capture:true, passive:true });

  home.querySelectorAll('button').forEach((button) => {
    const voiceAction = ['character-talk', 'voice-replay'].includes(button.dataset.homeAction);
    const gachaPianoTouchAction = button.hasAttribute('data-gacha-piano-touch');
    // The Gacha piano prompt owns its sound in touchGachaPiano() so taps on
    // either the piano hotspot or the surrounding overlay behave identically.
    if (!voiceAction && !gachaPianoTouchAction) button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      playHomeTapSound();
    }, { passive:true });
    button.addEventListener('click', (event) => {
      if (event.detail === 0) {
        if (!voiceAction && !gachaPianoTouchAction) playHomeTapSound();
        const bounds = button.getBoundingClientRect();
        showTouchEffect(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      }
    });
  });
  const menuTimers = new WeakMap();
  const pressTimers = new WeakMap();
  home.querySelectorAll('.hp-home-bottom-button').forEach(button => {
    let pressedAt = 0;
    const press = () => {
      clearTimeout(pressTimers.get(button));
      pressedAt = performance.now();
      button.classList.add('hp-home-is-pressed');
    };
    const release = () => {
      clearTimeout(pressTimers.get(button));
      // A quick, light tap must still paint a visible depression for 160ms.
      pressTimers.set(button, setTimeout(() => button.classList.remove('hp-home-is-pressed'),
        Math.max(0, 160 - (performance.now() - pressedAt))));
    };
    button.addEventListener('pointerdown', event => {
      if (event.button > 0) return;
      press();
      try { button.setPointerCapture(event.pointerId); } catch (_) {}
    }, { passive:true });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => {
      button.addEventListener(name, release);
    });
    button.addEventListener('click', () => {
      if (!button.classList.contains('hp-home-is-pressed')) { press(); release(); }
      clearTimeout(menuTimers.get(button));
      button.classList.remove('hp-home-confirmed');
      void button.offsetWidth;
      button.classList.add('hp-home-confirmed');
      menuTimers.set(button, setTimeout(() => button.classList.remove('hp-home-confirmed'), 560));
    });
  });

  const noticePageSize = 5;
  let noticePage = 0;
  function renderNoticePage(page = noticePage) {
    const cards = [...home.querySelectorAll('[data-home-notices] .hp-home-notice-card')];
    const pages = Math.max(1, Math.ceil(cards.length / noticePageSize));
    noticePage = Math.max(0, Math.min(pages - 1, page));
    cards.forEach((card, index) => { card.hidden = Math.floor(index / noticePageSize) !== noticePage; });
    const status = home.querySelector('[data-notice-page-status]');
    const prev = home.querySelector('[data-notice-page="prev"]');
    const next = home.querySelector('[data-notice-page="next"]');
    if (status) status.textContent = (noticePage + 1) + ' / ' + pages;
    if (prev) prev.disabled = noticePage === 0;
    if (next) next.disabled = noticePage >= pages - 1;
    const pager = home.querySelector('[data-home-notice-pager]');
    if (pager) pager.hidden = pages <= 1;
  }
  home.querySelector('[data-notice-page="prev"]')?.addEventListener('click', () => renderNoticePage(noticePage - 1));
  home.querySelector('[data-notice-page="next"]')?.addEventListener('click', () => renderNoticePage(noticePage + 1));
  renderNoticePage(0);
  new MutationObserver(() => renderNoticePage(0)).observe(
    home.querySelector('[data-home-notices]'), { childList:true }
  );

  const dialogOverlay = home.querySelector('.hp-home-dialog-overlay');
  const characterScreen = home.querySelector('[data-home-character-screen]');
  const missionScreen = home.querySelector('[data-home-mission-screen]');
  const rankingScreen = home.querySelector('[data-home-ranking-screen]');
  const gachaScreen = home.querySelector('[data-home-gacha-screen]');
  const canvas = home.querySelector('[data-home-canvas]');
  const homeVolume = home.querySelector('[data-home-volume]');
  const pianoVolume = piano.querySelector('[data-control="volume"]');
  let dialogOpener = null;
  function setCharacterHeaderActionsVisible(visible) {
    home.querySelectorAll('.hp-character-header-action').forEach(button => { button.hidden = !visible; });
  }
  const syncHomeVolume = () => {
    homeVolume.value = pianoVolume.value;
    home.querySelector('[data-home-volume-output]').textContent = pianoVolume.value + '%';
  };
  function closeHomeDialog() {
    if (dialogOverlay.hidden) return;
    dialogOverlay.hidden = true;
    setCharacterHeaderActionsVisible(false);
    home.querySelector('[data-home-profile]').hidden = true;
    delete dialogOverlay.dataset.screen;
    canvas.inert = false;
    dialogOpener?.focus({ preventScroll:true });
    dialogOpener = null;
    previewMotion.setActive(false);
    stopDetailVoice();
    syncCharacterVoice();
  }
  const playerProfileKey = 'pds-player-profile-v1';
  const playerNameDisplay = home.querySelector('[data-home-player-name]');
  const profileNameInput = home.querySelector('[data-profile-name]');
  const profileMessageInput = home.querySelector('[data-profile-message]');
  const profileInstrumentInput = home.querySelector('[data-profile-instrument]');
  const profileHomeBackgroundInput = home.querySelector('[data-profile-home-background]');
  const profileFrameInput = home.querySelector('[data-profile-frame]');
  const profileEffectInput = home.querySelector('[data-profile-effect]');
  const profileImageInput = home.querySelector('[data-profile-image-input]');
  const profileImageRemove = home.querySelector('[data-profile-image-remove]');
  const profilePreviewImage = home.querySelector('[data-profile-preview-image]');
  const profileStatus = home.querySelector('[data-profile-status]');
  const profileTopStatus = home.querySelector('[data-profile-top-status]');
  function setProfileTopStatus(message = '', isError = false) {
    if (!profileTopStatus) return;
    profileTopStatus.textContent = message;
    profileTopStatus.dataset.error = String(isError);
    profileTopStatus.hidden = !message;
  }
  const profilePreviewName = home.querySelector('[data-profile-preview-name]');
  const profilePreviewMessage = home.querySelector('[data-profile-preview-message]');
  const profileLevel = home.querySelector('[data-profile-level]');
  const homeLevel = home.querySelector('[data-home-level]');
  const defaultHomeBackground = '/assets/home/background/528030FF-B2C0-40B1-AA18-0B5410044B05.png?v=3';
  const profileDefaults = {
    name: 'ドリステP',
    message: 'ピアノを楽しもう♪',
    instrument: 'piano',
    image: '',
    homeBackground: 'default',
    frame: 'default',
    profileEffect: 'default',
  };
  const defaultProfileImage = '/assets/home/profile-default.svg';
  const gachaInventoryKey = 'pds-gacha-inventory-v1';
  const gachaTrialKey = 'pds-gacha-trial-v1';
  const gachaTrialEnabled =
    location.hostname.includes('git-staging-')
    || /-personal-app-projects\.vercel\.app$/i.test(location.hostname);

  // Staging QA continues to reset provisional cosmetics and draw history,
  // but earned instrument unlocks persist so the piano mode remains usable.
  if (gachaTrialEnabled) {
    try {
      const previous = JSON.parse(localStorage.getItem(gachaInventoryKey) || 'null');
      const allowed = new Set(['finalChip8','finalKoto','finalTrumpet','finalPipeOrgan','finalVibraphone']);
      const instruments = Array.isArray(previous?.instruments)
        ? previous.instruments.filter(id => allowed.has(id)) : [];
      localStorage.removeItem(gachaInventoryKey);
      localStorage.setItem(gachaInventoryKey, JSON.stringify({ instruments }));
      localStorage.removeItem(gachaTrialKey);
    } catch (_) {}
  }

  const homeBackgroundCatalog = Object.freeze({
    default: { name:'標準ホーム', image:defaultHomeBackground },
    crystal: { name:'クリスタルステージ', image:'/assets/home/character-screen-bg-20261006.svg' },
    celestial: { name:'天空クリスタル音楽宮殿', image:'/assets/gacha/backgrounds/celestial-v1.webp' },
    moonlight: { name:'月明かりの幻想音楽堂', image:'/assets/gacha/backgrounds/moonlight-v1.webp' },
    sunset: { name:'夕映えの宮殿ロビー', image:'/assets/gacha/backgrounds/sunset-v1.webp' },
    dreamroom: { name:'夢見る音楽室', image:'/assets/gacha/backgrounds/dreamroom-v1.webp' },
    stardome: { name:'星空ドーム', image:'/assets/gacha/backgrounds/stardome-v1.webp' },
    icepalace: { name:'氷晶宮殿', image:'/assets/gacha/backgrounds/icepalace-v1.webp' },
    roseterrace: { name:'夕暮れの薔薇庭園', image:'/assets/gacha/backgrounds/roseterrace-v1.webp' },
    neon: { name:'未来都市ネオンラウンジ', image:'/assets/gacha/backgrounds/neon-v1.webp' },
    undersea: { name:'夢幻の海底宮殿', image:'/assets/gacha/backgrounds/undersea-v1.webp' },
    rainbow: { name:'虹色天空の祝祭ステージ', image:'/assets/gacha/backgrounds/rainbow-v1.webp' },
  });
  const profileFrameCatalog = Object.freeze({
    default: { name:'標準フレーム' },
    starlight: { name:'スターライトフレーム' },
    frame01: { name:'星空ゴールド', image:'/assets/gacha/frames/frame01-v1.webp' },
    frame02: { name:'ロイヤルブルー', image:'/assets/gacha/frames/frame02-v1.webp' },
    frame03: { name:'クリスタルシルバー', image:'/assets/gacha/frames/frame03-v1.webp' },
    frame04: { name:'ローズゴールド', image:'/assets/gacha/frames/frame04-v1.webp' },
    frame05: { name:'エメラルド', image:'/assets/gacha/frames/frame05-v1.webp' },
    frame06: { name:'アメジスト', image:'/assets/gacha/frames/frame06-v1.webp' },
    frame07: { name:'サファイア', image:'/assets/gacha/frames/frame07-v1.webp' },
    frame08: { name:'ルビー', image:'/assets/gacha/frames/frame08-v1.webp' },
    frame09: { name:'ムーンライト', image:'/assets/gacha/frames/frame09-v1.webp' },
    frame10: { name:'フェアリー', image:'/assets/gacha/frames/frame10-v1.webp' },
    frame11: { name:'クラシック', image:'/assets/gacha/frames/frame11-v1.webp' },
    frame12: { name:'オーロラ', image:'/assets/gacha/frames/frame12-v1.webp' },
    frame13: { name:'スノークリスタル', image:'/assets/gacha/frames/frame13-v1.webp' },
    frame14: { name:'ノクターン', image:'/assets/gacha/frames/frame14-v1.webp' },
    frame15: { name:'セレブレーション', image:'/assets/gacha/frames/frame15-v1.webp' },
  });
  const profileEffectCatalog = Object.freeze({
    default: { name:'エフェクトなし' },
    starlightElegant: {
      name:'スターライトノーツ・上品',
      description:'小さな金色の光粒と淡い音符がカード全体を静かに漂うエフェクト',
    },
    starlightBrilliant: {
      name:'スターライトノーツ・華やか',
      description:'光の帯・星粒・音符がカード全体をきらびやかに巡るエフェクト',
    },
  });
  const pianoSkinCatalog = Object.freeze({
    default: { name:'標準・コンサートブラック' },
    moonlightIvory: { name:'ムーンライト・アイボリー', description:'真珠のような白鍵と深い青黒鍵、銀色の縁取りを合わせた鍵盤スキン' },
  });
  const touchEffectCatalog = Object.freeze({
    default: { name:'標準・ゴールドスパーク' },
    crystalBloom: { name:'クリスタル・ブルーム', description:'鍵盤タッチから青紫の結晶光とリングが広がるエフェクト' },
  });
  const pianoBackgroundCatalog = Object.freeze({
    default: { name:'標準・コンサートホール' },
    moonlightHall: { name:'月明かりの幻想音楽堂', description:'青い月光と幻想的なホールを使ったピアノモード背景' },
  });
  window.HP_GACHA_CUSTOMIZATION_CATALOG = Object.freeze({
    pianoSkins:pianoSkinCatalog,
    touchEffects:touchEffectCatalog,
    pianoBackgrounds:pianoBackgroundCatalog,
  });

  function loadGachaInventory() {
    const blank = { backgrounds:['default'], frames:['default'], profileEffects:['default'], pianoSkins:['default'], touchEffects:['default'], pianoBackgrounds:['default'], instruments:[], voices:[], characters:[] };
    try {
      const saved = JSON.parse(localStorage.getItem(gachaInventoryKey) || 'null');
      if (!saved || typeof saved !== 'object') return blank;
      return {
        backgrounds:Array.from(new Set(['default', ...(Array.isArray(saved.backgrounds) ? saved.backgrounds : [])])),
        frames:Array.from(new Set(['default', ...(Array.isArray(saved.frames) ? saved.frames : [])])),
        profileEffects:Array.from(new Set(['default', ...(Array.isArray(saved.profileEffects) ? saved.profileEffects : [])])),
        pianoSkins:Array.from(new Set(['default', ...(Array.isArray(saved.pianoSkins) ? saved.pianoSkins : [])])),
        touchEffects:Array.from(new Set(['default', ...(Array.isArray(saved.touchEffects) ? saved.touchEffects : [])])),
        pianoBackgrounds:Array.from(new Set(['default', ...(Array.isArray(saved.pianoBackgrounds) ? saved.pianoBackgrounds : [])])),
        instruments:Array.from(new Set((Array.isArray(saved.instruments) ? saved.instruments : []).filter(id => ['finalChip8','finalKoto','finalTrumpet','finalPipeOrgan','finalVibraphone'].includes(id)))),
        voices:Array.from(new Set(Array.isArray(saved.voices) ? saved.voices : [])),
        characters:Array.from(new Set(Array.isArray(saved.characters) ? saved.characters : [])),
      };
    } catch (_) {
      return blank;
    }
  }
  let gachaInventory = loadGachaInventory();

  function saveGachaInventory() {
    try { localStorage.setItem(gachaInventoryKey, JSON.stringify(gachaInventory)); } catch (_) {}
    window.dispatchEvent(new CustomEvent('pds-gacha-inventory-change', { detail:gachaInventory }));
  }

  function hasOwnedCustomization(type, id) {
    if (id === 'default') return true;
    if (type === 'background') return gachaInventory.backgrounds.includes(id);
    if (type === 'frame') return gachaInventory.frames.includes(id);
    if (type === 'profileEffect') return gachaInventory.profileEffects.includes(id);
    if (type === 'pianoSkin') return gachaInventory.pianoSkins.includes(id);
    if (type === 'touchEffect') return gachaInventory.touchEffects.includes(id);
    if (type === 'pianoBackground') return gachaInventory.pianoBackgrounds.includes(id);
    return false;
  }

  function fillOwnedSelect(select, catalog, ownedIds, selectedId) {
    if (!select) return;
    const ids = Array.from(new Set(['default', ...ownedIds])).filter(id => catalog[id]);
    select.replaceChildren(...ids.map(id => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = id === 'default' ? catalog[id].name : '所持｜' + catalog[id].name;
      return option;
    }));
    select.value = ids.includes(selectedId) ? selectedId : 'default';
  }

  function applyPlayerCustomization() {
    const bgId = hasOwnedCustomization('background', playerProfile.homeBackground) ? playerProfile.homeBackground : 'default';
    const frameId = hasOwnedCustomization('frame', playerProfile.frame) ? playerProfile.frame : 'default';
    const homeBg = home.querySelector('.hp-home-bg');
    if (homeBg) {
      const next = homeBackgroundCatalog[bgId]?.image || defaultHomeBackground;
      if (homeBg.getAttribute('src') !== next) homeBg.setAttribute('src', next);
    }
    [profilePreviewImage, home.querySelector('[data-ranking-profile-image]')].filter(Boolean).forEach(img => {
      renderProfileFrame(img, frameId);
    });
    home.dataset.profileFrame = frameId;
    const effectId = hasOwnedCustomization('profileEffect', playerProfile.profileEffect) ? playerProfile.profileEffect : 'default';
    const profileSummary = home.querySelector('.hp-player-profile-summary');
    if (profileSummary) profileSummary.dataset.profileEffect = effectId;
    const frameImage = profileFrameCatalog[frameId]?.image || '';
    home.style.setProperty('--profile-frame-image', frameImage ? 'url("' + frameImage.replace(/"/g,'%22') + '")' : 'none');
  }

  // Keep the avatar's existing dimensions. The frame is a separate overlay;
  // percentage padding on an img would be measured against the parent width.
  function renderProfileFrame(img, frameId) {
    if (!img) return;
    const id = profileFrameCatalog[frameId] ? frameId : 'default';
    img.dataset.profileFrame = id;
    const source = profileFrameCatalog[id]?.image;
    let portrait = img.parentElement;
    if (!portrait?.classList.contains('hp-profile-portrait')) {
      if (!source || !portrait) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'hp-profile-portrait';
      img.replaceWith(wrapper);
      wrapper.appendChild(img);
      portrait = wrapper;
    }
    let layer = portrait.querySelector('.hp-profile-frame-layer');
    portrait.classList.toggle('is-framed', !!source);
    if (!source) { layer?.remove(); return; }
    if (!layer) {
      layer = document.createElement('img');
      layer.className = 'hp-profile-frame-layer';
      layer.alt = '';
      layer.setAttribute('aria-hidden','true');
      layer.decoding = 'async';
      portrait.appendChild(layer);
    }
    if (layer.getAttribute('src') !== source) layer.src = source;
  }

  function syncFrameSelectionPreview() {
    if (!profileFrameInput) return;
    const preview = home.querySelector('[data-profile-frame-preview]');
    if (!preview) return;

    const id = profileFrameCatalog[profileFrameInput.value] ? profileFrameInput.value : 'default';
    const item = profileFrameCatalog[id] || profileFrameCatalog.default;
    const avatar = preview.querySelector('.hp-customization-frame-avatar');
    const art = preview.querySelector('.hp-customization-frame-art');
    const label = preview.querySelector('.hp-customization-preview-copy strong');

    if (label) label.textContent = item?.name || '標準フレーム';

    if (avatar) {
      const avatarSource = safeProfileImage(profileImageDraft || playerProfile.image);
      avatar.hidden = false;
      if (avatar.getAttribute('src') !== avatarSource) avatar.src = avatarSource;
    }

    const source = item?.image || '';
    if (art) {
      if (source) {
        art.hidden = false;
        art.style.display = 'block';
        art.style.visibility = 'visible';
        art.style.opacity = '1';
        if (art.getAttribute('src') !== source) art.src = source;
      } else {
        art.hidden = true;
        art.removeAttribute('src');
      }
    }

    preview.hidden = false;
    preview.style.display = 'flex';
    preview.style.visibility = 'visible';
    preview.style.opacity = '1';
  }

  function ensureProfileEffectLayer(summary) {
    if (!summary) return null;
    let layer = summary.querySelector(':scope > .hp-profile-effect-layer');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.className = 'hp-profile-effect-layer';
    layer.setAttribute('aria-hidden','true');

    const particles = [
      ['✦',  6, 20,  .0, .86], ['♪', 15, 72, -.8, .92], ['✧', 25, 38, -1.6, .72],
      ['♫', 34, 82, -.3, .84], ['•', 43, 18, -2.0, .56], ['✦', 51, 58, -1.1, .76],
      ['♪', 60, 31, -.5, .88], ['✧', 69, 76, -1.8, .72], ['♫', 78, 45, -.9, .82],
      ['✦', 88, 22, -2.2, .72], ['♪', 94, 68, -.2, .86], ['•', 11, 46, -1.4, .52],
      ['✧', 31, 12, -.7, .66], ['✦', 47, 88, -2.5, .70], ['♪', 72, 14, -1.0, .80],
      ['•', 84, 86, -1.7, .48], ['♫', 21, 91, -2.1, .70], ['✧', 57, 93, -.4, .64],
    ];

    particles.forEach(([glyph, x, y, delay, scale], index) => {
      const particle = document.createElement('span');
      particle.className = 'hp-profile-effect-particle';
      particle.textContent = glyph;
      particle.style.setProperty('--effect-x', x + '%');
      particle.style.setProperty('--effect-y', y + '%');
      particle.style.setProperty('--effect-delay', delay + 's');
      particle.style.setProperty('--effect-scale', String(scale));
      particle.dataset.effectParticle = String(index + 1);
      layer.appendChild(particle);
    });

    summary.prepend(layer);
    return layer;
  }

  function syncProfileEffectPreview() {
    const summary = home.querySelector('.hp-player-profile-summary');
    if (!summary) return;
    const id = profileEffectCatalog[profileEffectInput?.value] ? profileEffectInput.value : (playerProfile.profileEffect || 'default');
    summary.dataset.profileEffect = id;
    const layer = ensureProfileEffectLayer(summary);
    if (layer) {
      layer.dataset.effectId = id;
      layer.hidden = id === 'default';
    }
  }

  function syncCustomizationInputs() {
    fillOwnedSelect(profileHomeBackgroundInput, homeBackgroundCatalog, gachaInventory.backgrounds, playerProfile.homeBackground);
    fillOwnedSelect(profileFrameInput, profileFrameCatalog, gachaInventory.frames, playerProfile.frame);
    fillOwnedSelect(profileEffectInput, profileEffectCatalog, gachaInventory.profileEffects, playerProfile.profileEffect);
    syncFrameSelectionPreview();
    syncProfileEffectPreview();
  }

  function loadPlayerProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(playerProfileKey) || 'null');
      if (!saved || typeof saved !== 'object') return { ...profileDefaults };
      return {
        name: String(saved.name || profileDefaults.name).slice(0, 12),
        message: String(saved.message || profileDefaults.message).slice(0, 40),
        instrument: ['piano','violin','bass','guitar'].includes(saved.instrument) ? saved.instrument : 'piano',
        image: typeof saved.image === 'string' && (saved.image.startsWith('data:image/') || saved.image.startsWith('/')) ? saved.image : '',
        homeBackground: typeof saved.homeBackground === 'string' ? saved.homeBackground : 'default',
        frame: typeof saved.frame === 'string' ? saved.frame : 'default',
        profileEffect: typeof saved.profileEffect === 'string' ? saved.profileEffect : 'default',
      };
    } catch (_) {
      return { ...profileDefaults };
    }
  }

  let playerProfile = loadPlayerProfile();
  let profileImageDraft = playerProfile.image || '';

  function safeProfileImage(value) {
    return typeof value === 'string' && value ? value : defaultProfileImage;
  }

  function attachProfileImageFallback(img) {
    if (!img || img.dataset.profileFallbackBound === 'true') return;
    img.dataset.profileFallbackBound = 'true';
    img.addEventListener('error', () => {
      if (!img.src.endsWith('/assets/home/profile-default.svg')) img.src = defaultProfileImage;
    });
  }

  async function prepareProfileImage(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error('JPEG・PNG・WebP画像を選んでください。');
    if (file.size > 12 * 1024 * 1024) throw new Error('画像は12MB以下にしてください。');

    const objectUrl = URL.createObjectURL(file);
    try {
      const source = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('画像を読み込めませんでした。'));
        img.src = objectUrl;
      });
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const context = canvas.getContext('2d', { alpha:false });
      context.fillStyle = '#f3efe5';
      context.fillRect(0,0,size,size);
      const sw = source.naturalWidth || source.width, sh = source.naturalHeight || source.height;
      const scale = Math.max(size / sw, size / sh);
      const dw = sw * scale, dh = sh * scale;
      context.drawImage(source, (size-dw)/2, (size-dh)/2, dw, dh);
      const dataUrl = canvas.toDataURL('image/jpeg', .84);

      // Production sharing can attach a server-side image moderation implementation here.
      // Expected result: { allowed:boolean }. If no checker exists, image remains local-only.
      const checker = window.PDS_PROFILE_IMAGE_MODERATOR?.check;
      if (typeof checker === 'function') {
        const result = await checker(dataUrl);
        if (result && result.allowed === false) throw new Error('この画像はプロフィール画像として使用できません。');
      }
      return dataUrl;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  let lastPlayerNameFitSignature = '';
  function fitHomePlayerName() {
    if (!playerNameDisplay?.isConnected || !playerNameDisplay.clientWidth) return;
    const name = playerNameDisplay.textContent || '';
    const available = Math.max(1, playerNameDisplay.clientWidth - 8);
    const inheritedSize = parseFloat(getComputedStyle(playerNameDisplay.parentElement).fontSize) || 14;
    const signature = name + '|' + available + '|' + inheritedSize;
    // iOS can re-measure its viewport repeatedly after resuming a background
    // PWA. Do not reset the rendered name on every redundant measurement.
    if (signature === lastPlayerNameFitSignature) return;
    // Measure and refit synchronously in one rendering task, avoiding a frame
    // showing a too-large label before requestAnimationFrame shrinks it again.
    playerNameDisplay.style.removeProperty('font-size');
    playerNameDisplay.style.removeProperty('letter-spacing');
    const baseSize = parseFloat(getComputedStyle(playerNameDisplay).fontSize) || 14;
    const required = playerNameDisplay.scrollWidth;
    if (required > available) {
      const target = Math.max(baseSize * .54, baseSize * (available / required) * .96);
      playerNameDisplay.style.fontSize = target + 'px';
      if (target < baseSize * .72) playerNameDisplay.style.letterSpacing = '-.025em';
    }
    lastPlayerNameFitSignature = signature;
  }

  function syncPlayerProfileUI() {
    const name = playerProfile.name || profileDefaults.name;
    const message = playerProfile.message || profileDefaults.message;
    if (playerNameDisplay) {
      playerNameDisplay.textContent = name;
      fitHomePlayerName();
    }
    if (profilePreviewName) profilePreviewName.textContent = name;
    const rankingName = home.querySelector('[data-ranking-player-name]');
    if (rankingName) {
      const label = rankingName.querySelector('span') || rankingName;
      label.textContent = name;
    }
    if (profilePreviewMessage) profilePreviewMessage.textContent = message;
    if (profilePreviewImage) {
      profilePreviewImage.src = safeProfileImage(profileImageDraft || playerProfile.image);
      attachProfileImageFallback(profilePreviewImage);
    }
    if (profileNameInput) profileNameInput.value = name;
    if (profileMessageInput) profileMessageInput.value = message;
    if (profileInstrumentInput) profileInstrumentInput.value = playerProfile.instrument;
    syncCustomizationInputs();
    applyPlayerCustomization();
    if (profileLevel && homeLevel) profileLevel.textContent = homeLevel.textContent;
  }
  syncPlayerProfileUI();

  function openHomePanel(action, opener = null) {
    dialogOpener = opener;
    setCharacterHeaderActionsVisible(false);
    home.querySelector('#hp-home-dialog-title').textContent = { notice: 'お知らせ', settings: '設定', profile: 'プロフィール設定' }[action];
    home.querySelector('[data-home-dialog-kicker]').textContent = { notice: 'INFORMATION', settings: 'SOUND SETTINGS', profile: 'PLAYER PROFILE' }[action];
    home.querySelector('[data-home-notices]').hidden = action !== 'notice';
    home.querySelector('[data-home-settings]').hidden = action !== 'settings';
    home.querySelector('[data-home-profile]').hidden = action !== 'profile';
    dialogOverlay.dataset.screen = action;
    if (action === 'settings') renderGlobalCharacterCredits();
    if (action === 'notice') renderNoticePage(0);
    setProfileTopStatus();
    if (action === 'profile') {
      profileImageDraft = playerProfile.image || '';
      syncPlayerProfileUI();
      if (profileStatus) profileStatus.textContent = '';
    }
    syncHomeVolume();
    canvas.inert = true;
    dialogOverlay.hidden = false;
    syncCharacterVoice();
    previewMotion.setActive(false);
    dialogOverlay.querySelector('.hp-home-dialog-button:not([hidden])')?.focus({ preventScroll:true });
  }

  for (const action of ['notice', 'settings']) {
    const button = home.querySelector('[data-home-action="' + action + '"]');
    const openPanel = () => openHomePanel(action, button);
    let pointerId = null, startX = 0, startY = 0, openedByPointer = false;
    button.addEventListener('pointerdown', event => {
      if (event.button > 0) return;
      pointerId = event.pointerId; startX = event.clientX; startY = event.clientY; openedByPointer = false;
    }, { passive:true });
    button.addEventListener('pointerup', event => {
      if (event.pointerId !== pointerId) return;
      const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
      pointerId = null;
      if (moved <= 14) { openedByPointer = true; openPanel(); }
    }, { passive:true });
    button.addEventListener('pointercancel', () => { pointerId = null; });
    button.addEventListener('click', event => {
      if (openedByPointer) { openedByPointer = false; event.preventDefault(); return; }
      openPanel();
    });
  }

  const syncFramePreviewFromEvent = (event) => {
    if (event?.target !== profileFrameInput) return;
    syncFrameSelectionPreview();
    requestAnimationFrame(syncFrameSelectionPreview);
  };
  profileFrameInput?.addEventListener('input', syncFramePreviewFromEvent);
  profileFrameInput?.addEventListener('change', syncFramePreviewFromEvent);
  profileFrameInput?.addEventListener('blur', syncFrameSelectionPreview);
  home.addEventListener('change', event => {
    if (event.target === profileFrameInput) syncFrameSelectionPreview();
  }, true);
  profileEffectInput?.addEventListener('input', syncProfileEffectPreview);
  profileEffectInput?.addEventListener('change', syncProfileEffectPreview);

  const settingsProfileButton = home.querySelector('[data-home-action="profile-settings"]');
  settingsProfileButton?.addEventListener('click', () => openHomePanel('profile', settingsProfileButton));

  const levelProfileButton = home.querySelector('[data-home-action="profile-open"]');
  levelProfileButton?.addEventListener('click', () => openHomePanel('profile', levelProfileButton));

  home.querySelector('[data-home-action="profile-back"]')?.addEventListener('click', () => {
    openHomePanel('settings', settingsProfileButton || levelProfileButton);
  });

  profileImageInput?.addEventListener('change', async () => {
    const file = profileImageInput.files?.[0];
    if (!file) return;
    if (profileStatus) profileStatus.textContent = '画像を準備しています…';
    try {
      profileImageDraft = await prepareProfileImage(file);
      if (profilePreviewImage) {
        profilePreviewImage.src = safeProfileImage(profileImageDraft);
        attachProfileImageFallback(profilePreviewImage);
      }
      syncFrameSelectionPreview();
      if (profileStatus) profileStatus.textContent = window.PDS_PROFILE_IMAGE_MODERATOR?.check
        ? '画像を確認しました。保存するとプロフィール画像に反映されます。'
        : '画像を準備しました。現在は端末内のみで使用します。';
    } catch (error) {
      if (profileStatus) profileStatus.textContent = error?.message || '画像を設定できませんでした。';
    } finally {
      profileImageInput.value = '';
    }
  });

  profileImageRemove?.addEventListener('click', () => {
    profileImageDraft = '';
    if (profilePreviewImage) profilePreviewImage.src = defaultProfileImage;
    syncFrameSelectionPreview();
    if (profileStatus) profileStatus.textContent = 'プロフィール画像を外しました。保存すると反映されます。';
  });

    home.querySelector('[data-player-profile-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const name = (profileNameInput?.value || '').trim().slice(0, 12);
    const message = (profileMessageInput?.value || '').trim().slice(0, 40);
    if (!name) {
      if (profileStatus) profileStatus.textContent = 'プレイヤー名を入力してください。';
      setProfileTopStatus('プレイヤー名を入力してください', true);
      profileNameInput?.focus({ preventScroll:true });
      return;
    }
    playerProfile = {
      name,
      message: message || profileDefaults.message,
      instrument: profileInstrumentInput?.value || 'piano',
      image: profileImageDraft || '',
      homeBackground: hasOwnedCustomization('background', profileHomeBackgroundInput?.value) ? profileHomeBackgroundInput.value : 'default',
      frame: hasOwnedCustomization('frame', profileFrameInput?.value) ? profileFrameInput.value : 'default',
      profileEffect: hasOwnedCustomization('profileEffect', profileEffectInput?.value) ? profileEffectInput.value : 'default',
    };
    try { localStorage.setItem(playerProfileKey, JSON.stringify(playerProfile)); } catch (_) {}
    syncPlayerProfileUI();
    if (profileStatus) {
      const bgName = homeBackgroundCatalog[playerProfile.homeBackground]?.name || homeBackgroundCatalog.default.name;
      const frameName = profileFrameCatalog[playerProfile.frame]?.name || profileFrameCatalog.default.name;
      const effectName = profileEffectCatalog[playerProfile.profileEffect]?.name || profileEffectCatalog.default.name;
      const savedMessage = '保存しました｜背景：' + bgName + '／フレーム：' + frameName + '／エフェクト：' + effectName;
      profileStatus.textContent = savedMessage;
      setProfileTopStatus(savedMessage);
    }
  });
  const missionMenuButton = home.querySelector('[data-home-action="missions"]');
  const rankingMenuButton = home.querySelector('[data-home-action="ranking"]');
  const missionList = home.querySelector('[data-mission-list]');
  const missionTicketCount = home.querySelector('[data-mission-ticket-count]');
  const missionClaimAll = home.querySelector('[data-mission-claim-all]');
  const missionStateKey = 'pds-mission-state-v1';
  let missionTab = 'daily';

  const missionDefinitions = [
    { id:'daily-home', group:'daily', stat:'homeOpen', target:1, reward:1, icon:'♬', title:'ホームを開く', note:'今日のステージにアクセスしよう' },
    { id:'daily-talk', group:'daily', stat:'characterTalk', target:3, reward:1, icon:'♪', title:'キャラクターに3回話しかける', note:'ホームのキャラクターをタップ' },
    { id:'daily-notes', group:'daily', stat:'notes', target:20, reward:1, icon:'♩', title:'鍵盤を20音弾く', note:'ピアノモードで自由に演奏' },
    { id:'normal-piano', group:'normal', stat:'pianoEnter', target:1, reward:1, icon:'♬', title:'ピアノモードを使ってみる', note:'ピアノモードへ1回移動' },
    { id:'normal-notes-100', group:'normal', stat:'notes', target:100, reward:2, icon:'♫', title:'鍵盤を100音弾く', note:'累計100音を演奏' },
    { id:'normal-talk-20', group:'normal', stat:'characterTalk', target:20, reward:2, icon:'♪', title:'キャラクターに20回話しかける', note:'お気に入りのキャラクターと交流' },
  ];

  function localDateKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }

  function loadMissionState() {
    const blank = {
      dailyDate: localDateKey(),
      daily: {},
      lifetime: {},
      claimedDaily: [],
      claimedNormal: [],
      tickets: 0,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(missionStateKey) || 'null');
      if (!saved || typeof saved !== 'object') return blank;
      const state = {
        ...blank,
        ...saved,
        daily: saved.daily && typeof saved.daily === 'object' ? saved.daily : {},
        lifetime: saved.lifetime && typeof saved.lifetime === 'object' ? saved.lifetime : {},
        claimedDaily: Array.isArray(saved.claimedDaily) ? saved.claimedDaily : [],
        claimedNormal: Array.isArray(saved.claimedNormal) ? saved.claimedNormal : [],
        tickets: Math.max(0, Number(saved.tickets) || 0),
      };
      if (state.dailyDate !== localDateKey()) {
        state.dailyDate = localDateKey();
        state.daily = {};
        state.claimedDaily = [];
      }
      return state;
    } catch (_) {
      return blank;
    }
  }

  let missionState = loadMissionState();

  function normalizeMissionDate() {
    const today = localDateKey();
    if (missionState.dailyDate === today) return false;
    missionState.dailyDate = today;
    missionState.daily = {};
    missionState.claimedDaily = [];
    return true;
  }

  function saveMissionState() {
    try { localStorage.setItem(missionStateKey, JSON.stringify(missionState)); } catch (_) {}
  }

  function missionValue(definition) {
    const source = definition.group === 'daily' ? missionState.daily : missionState.lifetime;
    return Math.max(0, Number(source[definition.stat]) || 0);
  }

  function missionClaimed(definition) {
    const source = definition.group === 'daily' ? missionState.claimedDaily : missionState.claimedNormal;
    return source.includes(definition.id);
  }

  function missionComplete(definition) {
    return missionValue(definition) >= definition.target;
  }

  function renderMissionScreen() {
    if (!missionList) return;
    if (normalizeMissionDate()) saveMissionState();
    if (missionTicketCount) missionTicketCount.textContent = String(missionState.tickets);
    const gachaTicketCount = home.querySelector('[data-gacha-ticket-count]');
    if (gachaTicketCount) gachaTicketCount.textContent = String(missionState.tickets);
    home.querySelectorAll('[data-mission-tab]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.missionTab === missionTab));
    });

    const definitions = missionDefinitions.filter(definition => definition.group === missionTab);
    missionList.replaceChildren(...definitions.map(definition => {
      const value = Math.min(missionValue(definition), definition.target);
      const complete = missionComplete(definition);
      const claimed = missionClaimed(definition);

      const card = document.createElement('article');
      card.className = 'hp-mission-card' + (claimed ? ' is-claimed' : '');

      const icon = document.createElement('span');
      icon.className = 'hp-mission-icon';
      icon.textContent = definition.icon;

      const copy = document.createElement('div');
      copy.className = 'hp-mission-copy';
      const title = document.createElement('strong');
      title.textContent = definition.title;
      const note = document.createElement('small');
      note.textContent = definition.note;
      copy.append(title,note);

      const progress = document.createElement('div');
      progress.className = 'hp-mission-progress';
      const line = document.createElement('div');
      line.className = 'hp-mission-progress-line';
      line.style.setProperty('--mission-progress', Math.min(100, value / definition.target * 100) + '%');
      const fill = document.createElement('i');
      line.appendChild(fill);
      const count = document.createElement('b');
      count.textContent = value + ' / ' + definition.target;
      progress.append(line,count);

      const reward = document.createElement('div');
      reward.className = 'hp-mission-reward';
      const rewardText = document.createElement('span');
      rewardText.textContent = '🎟 ×' + definition.reward;
      const claim = document.createElement('button');
      claim.type = 'button';
      claim.dataset.missionClaim = definition.id;
      claim.textContent = claimed ? '受取済み' : complete ? '受け取る' : '未達成';
      claim.disabled = claimed || !complete;
      reward.append(rewardText,claim);

      card.append(icon,copy,progress,reward);
      return card;
    }));

    const hasClaimable = missionDefinitions.some(definition => missionComplete(definition) && !missionClaimed(definition));
    if (missionClaimAll) missionClaimAll.disabled = !hasClaimable;
  }

  function claimMission(definition) {
    if (!definition || missionClaimed(definition) || !missionComplete(definition)) return false;
    if (definition.group === 'daily') missionState.claimedDaily.push(definition.id);
    else missionState.claimedNormal.push(definition.id);
    missionState.tickets += definition.reward;
    saveMissionState();
    return true;
  }

  function recordMissionStat(stat, amount = 1) {
    normalizeMissionDate();
    const value = Math.max(0, Number(amount) || 0);
    missionState.daily[stat] = (Number(missionState.daily[stat]) || 0) + value;
    missionState.lifetime[stat] = (Number(missionState.lifetime[stat]) || 0) + value;
    saveMissionState();
    if (missionScreen && !missionScreen.hidden) renderMissionScreen();
  }

  missionList?.addEventListener('click', event => {
    const button = event.target.closest('[data-mission-claim]');
    if (!button) return;
    const definition = missionDefinitions.find(item => item.id === button.dataset.missionClaim);
    if (claimMission(definition)) renderMissionScreen();
  });
  missionClaimAll?.addEventListener('click', () => {
    let claimedAny = false;
    missionDefinitions.forEach(definition => {
      if (claimMission(definition)) claimedAny = true;
    });
    if (claimedAny) renderMissionScreen();
  });
  home.querySelectorAll('[data-mission-tab]').forEach(button => button.addEventListener('click', () => {
    missionTab = button.dataset.missionTab === 'normal' ? 'normal' : 'daily';
    renderMissionScreen();
  }));

  function openMissionScreen() {
    if (!missionScreen || !missionScreen.hidden) return;
    closeHomeDialog();
    if (characterScreen && !characterScreen.hidden) closeCharacterScreen();
    if (rankingScreen && !rankingScreen.hidden) closeRankingScreen();
    if (gachaScreen && !gachaScreen.hidden) closeGachaScreen();
    renderMissionScreen();
    canvas.inert = true;
    missionScreen.hidden = false;
    stopCharacterVoice();
    syncCharacterVoice();
    missionScreen.querySelector('[data-home-action="mission-screen-close"]')?.focus({preventScroll:true});
  }
  function closeMissionScreen() {
    if (!missionScreen || missionScreen.hidden) return;
    missionScreen.hidden = true;
    canvas.inert = false;
    syncCharacterVoice();
    missionMenuButton?.focus({preventScroll:true});
  }

  missionMenuButton?.addEventListener('click', openMissionScreen);
  missionScreen?.querySelector('[data-home-action="mission-screen-close"]')?.addEventListener('click', closeMissionScreen);

  const rankingStateKey = 'pds-ranking-cache-v1';
  let rankingTab = 'overall';

  function loadRankingState() {
    const blank = { overall:[], monthly:[], self:{ overall:null, monthly:null } };
    try {
      const saved = JSON.parse(localStorage.getItem(rankingStateKey) || 'null');
      if (!saved || typeof saved !== 'object') return blank;
      return {
        overall: Array.isArray(saved.overall) ? saved.overall : [],
        monthly: Array.isArray(saved.monthly) ? saved.monthly : [],
        self: saved.self && typeof saved.self === 'object' ? saved.self : blank.self,
      };
    } catch (_) {
      return blank;
    }
  }

  let rankingState = loadRankingState();

  const rankingDemoEnabled =
    location.hostname.includes('git-staging-')
    || /-personal-app-projects\.vercel\.app$/i.test(location.hostname);

  function demoRankingData() {
    const selfName = playerProfile.name || profileDefaults.name;
    return {
      overall: [
        { rank:1, name:'Nocturne', score:982430, profile:{level:96,message:'夜の曲を中心に弾いています。',instrument:'ピアノ',image:'/characters/character02/list-art.jpg'} },
        { rank:2, name:'みずいろ鍵盤', score:951820, profile:{level:91,message:'今日も一音ずつ。',instrument:'ピアノ',image:'/characters/character01/list-art.jpg'} },
        { rank:3, name:'Aria_P', score:927560, profile:{level:89,message:'音楽は自由に。',instrument:'バイオリン'} },
        { rank:4, name:'月灯り', score:901240, profile:{level:87,message:'ゆっくり遊んでます。',instrument:'ピアノ'} },
        { rank:5, name:'Fortissimo', score:879630, profile:{level:85,message:'強く、楽しく。',instrument:'エレキギター'} },
        { rank:6, name:selfName, score:852110, isSelf:true },
        { rank:7, name:'Crescendo', score:828940, profile:{level:80,message:'少しずつ上達中。',instrument:'ピアノ'} },
        { rank:8, name:'星屑ピアノ', score:801520, profile:{level:77,message:'星空みたいな音が好き。',instrument:'ピアノ'} },
        { rank:9, name:'Cantabile', score:774300, profile:{level:74,message:'歌うように弾きたい。',instrument:'バイオリン'} },
        { rank:10, name:'鍵盤ねこ', score:748860, profile:{level:72,message:'ねことピアノ。',instrument:'ピアノ'} },
      ],
      monthly: [
        { rank:1, name:'Aria_P', score:316420, profile:{level:89,message:'音楽は自由に。',instrument:'バイオリン',image:'/characters/character01/list-art.jpg'} },
        { rank:2, name:'Nocturne', score:301780, profile:{level:96,message:'夜の曲を中心に弾いています。',instrument:'ピアノ',image:'/characters/character02/list-art.jpg'} },
        { rank:3, name:'星屑ピアノ', score:289560, profile:{level:77,message:'星空みたいな音が好き。',instrument:'ピアノ'} },
        { rank:4, name:selfName, score:271930, isSelf:true },
        { rank:5, name:'月灯り', score:263480, profile:{level:87,message:'ゆっくり遊んでます。',instrument:'ピアノ'} },
        { rank:6, name:'Cantabile', score:252710, profile:{level:74,message:'歌うように弾きたい。',instrument:'バイオリン'} },
        { rank:7, name:'みずいろ鍵盤', score:244300, profile:{level:91,message:'今日も一音ずつ。',instrument:'ピアノ'} },
        { rank:8, name:'Fortissimo', score:231940, profile:{level:85,message:'強く、楽しく。',instrument:'エレキギター'} },
        { rank:9, name:'Crescendo', score:219660, profile:{level:80,message:'少しずつ上達中。',instrument:'ピアノ'} },
        { rank:10, name:'鍵盤ねこ', score:204810, profile:{level:72,message:'ねことピアノ。',instrument:'ピアノ'} },
      ],
      self: {
        overall:{ rank:6, score:852110 },
        monthly:{ rank:4, score:271930 },
      },
    };
  }

  function fitRankingName(button) {
    const label = button?.querySelector('span');
    if (!button || !label) return;
    button.style.removeProperty('font-size');
    requestAnimationFrame(() => {
      const available = Math.max(1, button.clientWidth - 20);
      const required = label.scrollWidth;
      if (required <= available) return;
      const base = parseFloat(getComputedStyle(button).fontSize) || 13;
      button.style.fontSize = Math.max(base * .62, base * available / required * .96) + 'px';
    });
  }

  function fitRankingScore(node) {
    if (!node) return;
    node.style.removeProperty('font-size');
    requestAnimationFrame(() => {
      const available = Math.max(1, node.clientWidth - 12);
      const required = node.scrollWidth;
      if (required <= available) return;
      const base = parseFloat(getComputedStyle(node).fontSize) || 20;
      node.style.fontSize = Math.max(base * .58, base * available / required * .96) + 'px';
    });
  }

    function openRankingProfile(entry, rankValue) {
    const overlay = home.querySelector('[data-ranking-profile-overlay]');
    if (!overlay) return;
    const isSelf = !!entry?.isSelf;
    const profile = isSelf
      ? {
          level: Number(home.querySelector('[data-home-level]')?.textContent) || null,
          message: playerProfile.message || profileDefaults.message,
          instrument: ({piano:'ピアノ',violin:'バイオリン',bass:'エレキベース',guitar:'エレキギター'})[playerProfile.instrument] || '未設定',
          image: playerProfile.image || '',
          profileEffect: playerProfile.profileEffect || 'default',
        }
      : (entry?.profile || {});
    const setText = (selector, value) => {
      const node = overlay.querySelector(selector);
      if (node) node.textContent = value;
    };
    const rankingCard = overlay.querySelector('.hp-ranking-profile-card');
    if (rankingCard) rankingCard.dataset.profileEffect = profile.profileEffect || 'default';
    setText('[data-ranking-profile-name]', String(entry?.name || 'PLAYER'));
    setText('[data-ranking-profile-level]', profile.level ?? '—');
    setText('[data-ranking-profile-rank]', (rankValue || '—') + (rankValue ? '位' : ''));
    const score = Number(entry?.score);
    setText('[data-ranking-profile-score]', Number.isFinite(score) ? score.toLocaleString('ja-JP') : '—');
    setText('[data-ranking-profile-instrument]', profile.instrument || '未設定');
    setText('[data-ranking-profile-message]', profile.message || 'プロフィール情報未連携');
    const profileImage = overlay.querySelector('[data-ranking-profile-image]');
    if (profileImage) {
      profileImage.src = safeProfileImage(profile.image);
      profileImage.dataset.profileFrame = entry?.isSelf ? (playerProfile.frame || 'default') : (profile.frame || 'default');
      renderProfileFrame(profileImage, profileImage.dataset.profileFrame);
      attachProfileImageFallback(profileImage);
    }
    overlay.hidden = false;
    overlay.querySelector('[data-ranking-profile-close]:not(.hp-ranking-profile-backdrop)')?.focus({preventScroll:true});
  }

  function closeRankingProfile() {
    const overlay = home.querySelector('[data-ranking-profile-overlay]');
    if (overlay) overlay.hidden = true;
  }

  function renderRankingScreen() {
    const list = home.querySelector('[data-ranking-list]');
    const empty = home.querySelector('[data-ranking-empty]');
    const storedEntries = Array.isArray(rankingState[rankingTab]) ? rankingState[rankingTab] : [];
    const demo = rankingDemoEnabled && storedEntries.length === 0 ? demoRankingData() : null;
    const entries = demo ? demo[rankingTab] : storedEntries;
    home.querySelectorAll('[data-ranking-tab]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.rankingTab === rankingTab));
    });

    if (list) {
      list.replaceChildren(...entries.map((entry,index) => {
        const row = document.createElement('article');
        const numericRank = Number(entry?.rank) || index + 1;
        row.className = 'hp-ranking-row'
          + (entry?.isSelf ? ' is-self' : '')
          + (numericRank <= 3 ? ' is-top-' + numericRank : '');
        const rank = document.createElement('b');
        rank.textContent = String(numericRank);
        const avatar = document.createElement('img');
        avatar.className = 'hp-ranking-avatar';
        avatar.alt = '';
        avatar.src = safeProfileImage(entry?.isSelf ? playerProfile.image : entry?.profile?.image);
        avatar.dataset.profileFrame = entry?.isSelf ? (playerProfile.frame || 'default') : (entry?.profile?.frame || 'default');

        attachProfileImageFallback(avatar);

        const name = document.createElement('button');
        name.type = 'button';
        name.className = 'hp-ranking-name-button';
        const nameLabel = document.createElement('span');
        nameLabel.textContent = String(entry?.name || 'PLAYER');
        name.appendChild(nameLabel);
        name.addEventListener('click', () => openRankingProfile(entry, numericRank));
        const score = document.createElement('span');
        score.className = 'hp-ranking-score-display';
        const numericScore = Number(entry?.score);
        score.textContent = Number.isFinite(numericScore) ? numericScore.toLocaleString('ja-JP') : '—';
        row.append(rank,avatar,name,score);
        renderProfileFrame(avatar, avatar.dataset.profileFrame);
        requestAnimationFrame(() => {
          fitRankingName(name);
          fitRankingScore(score);
        });
        return row;
      }));
    }
    if (empty) empty.hidden = entries.length > 0;

    const self = demo ? demo.self[rankingTab] : (rankingState.self?.[rankingTab] || null);
    const selfRank = home.querySelector('[data-ranking-self-rank]');
    const selfScore = home.querySelector('[data-ranking-self-score]');
    const selfStatus = home.querySelector('[data-ranking-self-status]');
    if (selfRank) selfRank.textContent = self?.rank ? String(self.rank) : '—';
    if (selfScore) {
      selfScore.textContent = Number.isFinite(Number(self?.score)) ? Number(self.score).toLocaleString('ja-JP') : '—';
      requestAnimationFrame(() => fitRankingScore(selfScore));
    }
    if (selfStatus) selfStatus.textContent = demo
      ? 'STAGING用の仮ランキングを表示中です。'
      : self?.rank ? 'ランキングに参加中です。' : 'まだランキング記録がありません。';
    let rankingName = home.querySelector('[data-ranking-player-name]');
    if (rankingName) {
      const selfName = playerProfile.name || profileDefaults.name;
      if (rankingName.tagName !== 'BUTTON') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hp-ranking-self-name-button';
        button.setAttribute('data-ranking-player-name','');
        const avatar = document.createElement('img');
        avatar.className = 'hp-ranking-self-avatar';
        avatar.alt = '';
        avatar.src = safeProfileImage(playerProfile.image);
        attachProfileImageFallback(avatar);
        const label = document.createElement('span');
        button.append(avatar,label);
        rankingName.replaceWith(button);
        rankingName = button;
      }
      const selfAvatar = rankingName.querySelector('.hp-ranking-self-avatar');
      if (selfAvatar) { selfAvatar.src = safeProfileImage(playerProfile.image); renderProfileFrame(selfAvatar, playerProfile.frame); }
      const selfLabel = rankingName.querySelector('span');
      if (selfLabel) selfLabel.textContent = selfName;
      rankingName.onclick = () => openRankingProfile({
        name:selfName,
        score:self?.score,
        isSelf:true
      }, self?.rank || null);
      requestAnimationFrame(() => fitRankingName(rankingName));
    }
  }

  home.querySelectorAll('[data-ranking-tab]').forEach(button => button.addEventListener('click', () => {
    rankingTab = button.dataset.rankingTab === 'monthly' ? 'monthly' : 'overall';
    renderRankingScreen();
  }));

  function openRankingScreen() {
    if (!rankingScreen || !rankingScreen.hidden) return;
    closeHomeDialog();
    if (characterScreen && !characterScreen.hidden) closeCharacterScreen();
    if (missionScreen && !missionScreen.hidden) closeMissionScreen();
    if (gachaScreen && !gachaScreen.hidden) closeGachaScreen();
    renderRankingScreen();
    canvas.inert = true;
    rankingScreen.hidden = false;
    stopCharacterVoice();
    syncCharacterVoice();
    rankingScreen.querySelector('[data-home-action="ranking-screen-close"]')?.focus({preventScroll:true});
  }
  function closeRankingScreen() {
    if (!rankingScreen || rankingScreen.hidden) return;
    closeRankingProfile();
    rankingScreen.hidden = true;
    canvas.inert = false;
    syncCharacterVoice();
    rankingMenuButton?.focus({preventScroll:true});
  }

  rankingMenuButton?.addEventListener('click', openRankingScreen);
  rankingScreen?.querySelector('[data-home-action="ranking-screen-close"]')?.addEventListener('click', closeRankingScreen);
  home.querySelectorAll('[data-ranking-profile-close]').forEach(button => button.addEventListener('click', closeRankingProfile));

  const gachaMenuButton = home.querySelector('[data-home-action="gacha"]');

  const gachaTrialTicketCap = 9999;
  const gachaVisuals = {
    piano: '/assets/gacha/visuals/piano-v1.webp',
    normal: '/assets/gacha/visuals/result-normal-v2.webp?v=21',
    special: '/assets/gacha/visuals/result-character-v2.webp?v=21',
    ticket: '/assets/gacha/visuals/ticket-v1.webp',
  };
  let gachaDrawing = false;

  function loadGachaTrialState() {
    try {
      const saved = JSON.parse(localStorage.getItem(gachaTrialKey) || 'null');
      return saved && typeof saved === 'object'
        ? { history:Array.isArray(saved.history) ? saved.history.slice(0,100) : [] }
        : { history:[] };
    } catch (_) {
      return { history:[] };
    }
  }
  let gachaTrialState = loadGachaTrialState();

  function saveGachaTrialState() {
    try { localStorage.setItem(gachaTrialKey, JSON.stringify(gachaTrialState)); } catch (_) {}
  }

  function gachaPool() {
    return registry?.list?.().filter(character => character && character.available !== false) || [];
  }

  const gachaInstrumentIds = ['finalChip8','finalKoto','finalTrumpet','finalPipeOrgan','finalVibraphone'];
  const gachaInstrumentRewards = gachaInstrumentIds.map(instrumentId => ({
    kind:'instrument',
    id:'instrument:' + instrumentId,
    instrumentId,
    name:'楽器「' + (window.HP_INSTRUMENTS?.[instrumentId]?.name || instrumentId) + '」',
    reading:'NEW INSTRUMENT',
    description:'獲得するとピアノモードで演奏できる楽器',
  }));
  const gachaTrialItems = [
    ...gachaInstrumentRewards,
    ...Object.entries(homeBackgroundCatalog).filter(([id, item]) => !['default','crystal'].includes(id) && item.image).map(([id, item]) => ({
      kind:'background', id:'background:' + id, customizationId:id,
      name:'ホーム背景「' + item.name + '」', reading:'HOME BACKGROUND', description:'ホーム背景', image:item.image,
    })),
    ...Object.entries(profileFrameCatalog).filter(([id, item]) => id !== 'default' && item.image).map(([id, item]) => ({
      kind:'frame', id:'frame:' + id, customizationId:id,
      name:'プロフィールフレーム「' + item.name + '」', reading:'PROFILE FRAME', description:'プロフィールフレーム', image:item.image,
    })),
    ...Object.entries(profileEffectCatalog).filter(([id]) => id !== 'default').map(([id, item]) => ({
      kind:'profileEffect', id:'profileEffect:' + id, customizationId:id,
      name:'プロフィール背景エフェクト「' + item.name + '」', reading:'PROFILE EFFECT',
      description:item.description || 'プロフィール背景エフェクト',
    })),
    ...Object.entries(pianoSkinCatalog).filter(([id]) => id !== 'default').map(([id, item]) => ({
      kind:'pianoSkin', id:'pianoSkin:' + id, customizationId:id,
      name:'鍵盤スキン「' + item.name + '」', reading:'PIANO KEY SKIN',
      description:item.description || 'ピアノモード鍵盤スキン',
    })),
    ...Object.entries(touchEffectCatalog).filter(([id]) => id !== 'default').map(([id, item]) => ({
      kind:'touchEffect', id:'touchEffect:' + id, customizationId:id,
      name:'タッチエフェクト「' + item.name + '」', reading:'TOUCH EFFECT',
      description:item.description || 'ピアノモードタッチエフェクト',
    })),
    ...Object.entries(pianoBackgroundCatalog).filter(([id]) => id !== 'default').map(([id, item]) => ({
      kind:'pianoBackground', id:'pianoBackground:' + id, customizationId:id,
      name:'ピアノモード背景「' + item.name + '」', reading:'PIANO BACKGROUND',
      description:item.description || 'ピアノモード背景',
    })),
  ];

  function gachaVoiceRewards() {
    return gachaPool().flatMap(character => {
      const set = registry?.voiceSet?.(character);
      return (set?.entries || []).filter(entry => entry?.file).slice(0,3).map(entry => ({
        kind:'voice',
        id:'voice:' + character.id + ':' + entry.file,
        voiceId:character.id + ':' + entry.file,
        characterId:character.id,
        voiceFile:entry.file,
        name:character.name + ' ボイス',
        reading:'VOICE',
        description:(entry.lines || []).join(' '),
      }));
    });
  }

  function annotateGachaOwnership(results) {
    const seenBackgrounds = new Set(gachaInventory.backgrounds || []);
    const seenFrames = new Set(gachaInventory.frames || []);
    const seenProfileEffects = new Set(gachaInventory.profileEffects || []);
    const seenPianoSkins = new Set(gachaInventory.pianoSkins || []);
    const seenTouchEffects = new Set(gachaInventory.touchEffects || []);
    const seenPianoBackgrounds = new Set(gachaInventory.pianoBackgrounds || []);
    const seenInstruments = new Set(gachaInventory.instruments || []);
    const seenVoices = new Set(gachaInventory.voices || []);
    const seenCharacters = new Set(gachaInventory.characters || []);

    return (results || []).map(result => {
      if (!result) return result;
      let isNewReward = false;
      let alreadyOwned = false;
      if (result.kind === 'background' && result.customizationId) {
        alreadyOwned = seenBackgrounds.has(result.customizationId);
        isNewReward = !alreadyOwned;
        seenBackgrounds.add(result.customizationId);
      } else if (result.kind === 'frame' && result.customizationId) {
        alreadyOwned = seenFrames.has(result.customizationId);
        isNewReward = !alreadyOwned;
        seenFrames.add(result.customizationId);
      } else if (result.kind === 'profileEffect' && result.customizationId) {
        alreadyOwned = seenProfileEffects.has(result.customizationId);
        isNewReward = !alreadyOwned;
        seenProfileEffects.add(result.customizationId);
      } else if (result.kind === 'pianoSkin' && result.customizationId) {
        alreadyOwned = seenPianoSkins.has(result.customizationId);
        isNewReward = !alreadyOwned;
        seenPianoSkins.add(result.customizationId);
      } else if (result.kind === 'touchEffect' && result.customizationId) {
        alreadyOwned = seenTouchEffects.has(result.customizationId);
        isNewReward = !alreadyOwned;
        seenTouchEffects.add(result.customizationId);
      } else if (result.kind === 'pianoBackground' && result.customizationId) {
        alreadyOwned = seenPianoBackgrounds.has(result.customizationId);
        isNewReward = !alreadyOwned;
        seenPianoBackgrounds.add(result.customizationId);
      } else if (result.kind === 'instrument' && result.instrumentId) {
        alreadyOwned = seenInstruments.has(result.instrumentId);
        isNewReward = !alreadyOwned;
        seenInstruments.add(result.instrumentId);
      } else if (result.kind === 'voice' && result.voiceId) {
        alreadyOwned = seenVoices.has(result.voiceId);
        isNewReward = !alreadyOwned;
        seenVoices.add(result.voiceId);
      } else if (result.kind === 'character' && result.characterId) {
        alreadyOwned = seenCharacters.has(result.characterId);
        isNewReward = !alreadyOwned;
        seenCharacters.add(result.characterId);
      }
      return { ...result, isNewReward, alreadyOwned };
    });
  }

  function grantGachaResults(results) {
    let changed = false;
    for (const result of results || []) {
      if (result?.kind === 'background' && result.customizationId && !gachaInventory.backgrounds.includes(result.customizationId)) {
        gachaInventory.backgrounds.push(result.customizationId); changed = true;
      } else if (result?.kind === 'frame' && result.customizationId && !gachaInventory.frames.includes(result.customizationId)) {
        gachaInventory.frames.push(result.customizationId); changed = true;
      } else if (result?.kind === 'profileEffect' && result.customizationId && !gachaInventory.profileEffects.includes(result.customizationId)) {
        gachaInventory.profileEffects.push(result.customizationId); changed = true;
      } else if (result?.kind === 'pianoSkin' && result.customizationId && !gachaInventory.pianoSkins.includes(result.customizationId)) {
        gachaInventory.pianoSkins.push(result.customizationId); changed = true;
      } else if (result?.kind === 'touchEffect' && result.customizationId && !gachaInventory.touchEffects.includes(result.customizationId)) {
        gachaInventory.touchEffects.push(result.customizationId); changed = true;
      } else if (result?.kind === 'pianoBackground' && result.customizationId && !gachaInventory.pianoBackgrounds.includes(result.customizationId)) {
        gachaInventory.pianoBackgrounds.push(result.customizationId); changed = true;
      } else if (result?.kind === 'instrument' && gachaInstrumentIds.includes(result.instrumentId) && !gachaInventory.instruments.includes(result.instrumentId)) {
        gachaInventory.instruments.push(result.instrumentId); changed = true;
      } else if (result?.kind === 'voice' && result.voiceId && !gachaInventory.voices.includes(result.voiceId)) {
        gachaInventory.voices.push(result.voiceId); changed = true;
      } else if (result?.kind === 'character' && result.characterId && !gachaInventory.characters.includes(result.characterId)) {
        gachaInventory.characters.push(result.characterId); changed = true;
      }
    }
    if (changed) {
      saveGachaInventory();
      syncCustomizationInputs();
      applyPlayerCustomization();
    }
  }

  function makeCharacterResult(character) {
    return {
      kind:'character',
      id:'character:' + character.id,
      characterId:character.id,
      name:character.name,
      reading:character.reading || '',
      description:'CHARACTER',
      rarity:'rainbow',
    };
  }

  function drawTrialResult(options = {}) {
    const pool = gachaPool();
    const forceCharacter = !!options.forceCharacter;
    const forceItem = !!options.forceItem;
    if (!pool.length) return null;
    if (forceItem) {
      const trialEffect = gachaTrialItems.find(item =>
        item.kind === 'profileEffect'
        && item.customizationId
        && !gachaInventory.profileEffects.includes(item.customizationId)
      );
      if (trialEffect) return { ...trialEffect };
    }
    if (!forceItem && (forceCharacter || Math.random() < .34)) {
      return makeCharacterResult(pool[Math.floor(Math.random() * pool.length)]);
    }
    const rewards = [...gachaTrialItems, ...gachaVoiceRewards()];
    const item = rewards[Math.floor(Math.random() * rewards.length)] || gachaTrialItems[0];
    return { ...item };
  }

  let gachaResultState = null;
  let gachaResultMotions = [];
  let gachaResultTransitioning = false;

  function destroyGachaResultMotions() {
    for (const motion of gachaResultMotions) {
      try { motion.destroy(); } catch (_) {}
    }
    gachaResultMotions = [];
  }

  function mountGachaResultMotions() {
    destroyGachaResultMotions();
    home.querySelectorAll('[data-gacha-result-motion]').forEach(root => {
      const character = registry?.get?.(root.dataset.gachaResultMotion);
      if (!character) return;
      const motion = new window.HP_MOTION_CHARACTER.MotionCharacter(root);
      gachaResultMotions.push(motion);
      void motion.setCharacter(character).then(() => motion.setActive(false));
    });
  }

  function buildGachaResultCard(result, index, compact = false) {
    const card = document.createElement('article');
    card.className = 'hp-gacha-result-card'
      + (compact ? ' is-compact' : ' is-single-reveal')
      + (result?.kind === 'character' ? ' is-character-result'
        : result?.kind === 'voice' ? ' is-voice-result'
        : ' is-item-result');
    card.dataset.resultKind = result?.kind || 'item';
    card.classList.toggle('is-new-reward', result?.isNewReward === true);
    card.classList.toggle('is-owned-reward', result?.alreadyOwned === true);

    if (result?.kind === 'character') {
      const character = registry?.get?.(result.characterId);
      card.dataset.characterId = character?.id || '';
      card.classList.toggle('is-new-character', result?.isNewCharacter === true);
      if (character?.profileBackground) {
        card.style.setProperty('--gacha-result-bg', 'url("' + character.profileBackground + '")');
      }
      const art = document.createElement('div');
      art.className = 'hp-gacha-result-motion';
      art.dataset.gachaResultMotion = character?.id || '';
      art.setAttribute('aria-hidden','true');
      card.appendChild(art);
    } else if (result?.kind === 'voice') {
      card.style.setProperty('--gacha-result-bg', 'url("' + gachaVisuals.normal + '")');
      const art = document.createElement('div');
      art.className = 'hp-gacha-result-voice-art';
      art.setAttribute('aria-hidden','true');
      art.innerHTML = '<span>♪</span><i>♫</i><b>♪</b>';
      card.appendChild(art);
    } else if (result?.kind === 'instrument') {
      card.style.setProperty('--gacha-result-bg', 'url("' + gachaVisuals.normal + '")');
      const glyphs = {
        finalChip8:'♫', finalKoto:'♬', finalTrumpet:'🎺',
        finalPipeOrgan:'🎹', finalVibraphone:'🔔'
      };
      const art = document.createElement('div');
      art.className = 'hp-gacha-result-instrument-art';
      art.setAttribute('aria-hidden','true');
      art.dataset.instrumentId = result.instrumentId || '';
      const glyph = document.createElement('span');
      glyph.textContent = glyphs[result.instrumentId] || '♪';
      const legend = document.createElement('small');
      legend.textContent = 'INSTRUMENT';
      art.append(glyph, legend);
      card.appendChild(art);
    } else if (result?.kind === 'profileEffect') {
      card.style.setProperty('--gacha-result-bg', 'url("' + gachaVisuals.normal + '")');
      const art = document.createElement('div');
      art.className = 'hp-gacha-result-profile-effect-art';
      art.dataset.effectId = result.customizationId || '';
      art.setAttribute('aria-hidden','true');
      art.innerHTML = '<i>♪</i><i>✦</i><i>♫</i><i>✧</i><i>♪</i><i>✦</i><i>♫</i>';
      card.appendChild(art);
    } else if (['pianoSkin','touchEffect','pianoBackground'].includes(result?.kind)) {
      card.style.setProperty('--gacha-result-bg', 'url("' + gachaVisuals.normal + '")');
      const art = document.createElement('div');
      art.className = 'hp-gacha-result-piano-custom-art';
      art.dataset.customKind = result.kind;
      art.setAttribute('aria-hidden','true');
      art.innerHTML = result.kind === 'pianoSkin'
        ? '<span class="keys">▯▮▯▮▯▯▮▯</span>'
        : result.kind === 'touchEffect'
          ? '<span class="touch">✦<i>◇</i><b>✧</b></span>'
          : '<span class="scene">☾<i>♪</i><b>✦</b></span>';
      card.appendChild(art);
    } else {
      card.style.setProperty('--gacha-result-bg', 'url("' + gachaVisuals.normal + '")');
      const art = document.createElement('img');
      art.className = 'hp-gacha-result-item-art';
      art.src = result?.image || gachaVisuals.ticket;
      art.alt = '';
      art.decoding = 'async';
      card.appendChild(art);
    }

    const name = document.createElement('strong');
    name.textContent = result?.name || 'REWARD';
    const reading = document.createElement('em');
    reading.textContent = result?.reading || result?.description || '';
    const ownership = document.createElement('mark');
    ownership.className = 'hp-gacha-result-ownership';
    ownership.textContent = result?.isNewReward === true ? 'NEW' : result?.alreadyOwned === true ? '獲得済み' : '獲得';
    card.append(name,reading,ownership);
    return card;
  }

  function closeGachaResult() {
    const overlay = home.querySelector('[data-gacha-result-overlay]');
    if (overlay) overlay.hidden = true;
    destroyGachaResultMotions();
    stopGachaAcquisitionVoice();
    gachaResultState = null;
    gachaResultTransitioning = false;
    gachaDrawing = false;
    renderGachaScreen();
  }

  function renderGachaResultStep() {
    const overlay = home.querySelector('[data-gacha-result-overlay]');
    const list = home.querySelector('[data-gacha-result-list]');
    const title = home.querySelector('[data-gacha-result-title]');
    const progress = home.querySelector('[data-gacha-result-progress]');
    const next = home.querySelector('[data-gacha-result-next]');
    const skip = home.querySelector('[data-gacha-result-skip]');
    const ok = home.querySelector('.hp-gacha-result-ok');
    if (!overlay || !list || !gachaResultState) return;

    const { results, index, summary } = gachaResultState;
    overlay.dataset.count = String(results.length);
    overlay.dataset.mode = summary ? 'summary' : 'sequence';
    const screenResult = summary ? null : results[index];
    const screenBackground = screenResult?.kind === 'character' ? gachaVisuals.special : gachaVisuals.normal;
    overlay.dataset.resultKind = summary ? 'summary' : (screenResult?.kind || 'item');
    overlay.style.setProperty('--gacha-result-screen-bg', 'url("' + screenBackground + '")');

    if (summary) {
      if (title) title.textContent = '10連結果';
      if (progress) progress.textContent = '';
      list.replaceChildren(...results.map((result, cardIndex) => buildGachaResultCard(result, cardIndex, true)));
      if (next) next.hidden = true;
      if (skip) skip.hidden = true;
      if (ok) ok.hidden = false;
      requestAnimationFrame(mountGachaResultMotions);
      ok?.focus({preventScroll:true});
      return;
    }

    const current = results[index];
    if (title) title.textContent = current?.kind === 'character'
      ? 'キャラクター獲得'
      : current?.kind === 'instrument'
        ? '楽器獲得'
        : current?.kind === 'voice'
          ? 'ボイス獲得'
        : current?.kind === 'background' || current?.kind === 'frame'
          ? 'カスタマイズ獲得'
          : 'アイテム獲得';
    if (progress) progress.textContent = results.length > 1 ? (index + 1) + ' / ' + results.length : '';
    list.replaceChildren(buildGachaResultCard(current, index, false));
    if (next) {
      next.hidden = results.length <= 1;
      next.textContent = index >= results.length - 1 ? '結果一覧へ' : '次へ';
    }
    if (skip) skip.hidden = results.length <= 1 || index >= results.length - 1;
    if (ok) ok.hidden = results.length > 1;
    requestAnimationFrame(mountGachaResultMotions);
    (results.length > 1 ? next : ok)?.focus({preventScroll:true});
  }

  function showGachaResult(results, index = 0) {
    const overlay = home.querySelector('[data-gacha-result-overlay]');
    if (!overlay || !results.length) return;
    gachaResultState = { results:[...results], index, summary:false, skipMode:false, seenNewSpecialIndexes:new Set() };
    overlay.hidden = false;
    renderGachaResultStep();
  }

  let gachaAnimationTimer = 0;
  let gachaAnimationReadyTimer = 0;
  let gachaAnimationResolve = null;
  let gachaAnimationMode = 'idle';
  let gachaAnimationAwaitingTouch = false;
  let gachaAnimationMandatory = false;
  let gachaUpgradeTimers = [];
  const gachaFlourishSources = new Set();
  function clearGachaUpgradeTimers() {
    for (const timer of gachaUpgradeTimers) clearTimeout(timer);
    gachaUpgradeTimers = [];
  }
  function scheduleGachaUpgrade(callback, delay) {
    const timer = setTimeout(() => {
      gachaUpgradeTimers = gachaUpgradeTimers.filter(id => id !== timer);
      if (gachaAnimationMode === 'reveal') callback();
    }, delay);
    gachaUpgradeTimers.push(timer);
  }
  function stopGachaFlourish() {
    for (const voice of gachaFlourishSources) {
      voice.source.onended = null;
      try { voice.source.stop(); } catch (_) {}
      try { voice.source.disconnect(); voice.gain.disconnect(); } catch (_) {}
    }
    gachaFlourishSources.clear();
  }
  let gachaAcquisitionVoiceSource = null;
  let gachaFlourishGraph = null;
  let gachaFlourishBuffer = null;
  let gachaFlourishLoading = null;
  let gachaTransitionGraph = null;
  const gachaTransitionVoices = new Set();

  function ensureGachaTransitionGraph() {
    const bridge = window.HP_AUDIO_BRIDGE?.get?.();
    if (!bridge) return null;
    if (gachaTransitionGraph?.context === bridge.context) return gachaTransitionGraph;
    try {
      const master = bridge.context.createGain();
      master.gain.value = .66;
      window.HP_SOUND_SETTINGS?.bind?.('effects',master);
      master.connect(bridge.output);
      gachaTransitionGraph = {context:bridge.context,master};
      return gachaTransitionGraph;
    } catch (_) { return null; }
  }
  function stopGachaTransitionTones() {
    for (const voice of gachaTransitionVoices) {
      voice.osc.onended = null;
      try { voice.osc.stop(); } catch (_) {}
      try { voice.osc.disconnect(); voice.gain.disconnect(); } catch (_) {}
    }
    gachaTransitionVoices.clear();
  }
  // Stable ascending C-D-E cue even when the streamed orchestral file
  // is still decoding on iOS. The final cue borrows the awarded instrument's
  // timbre, making the third stage an audible reward instead of just a tint.
  function playGachaTransitionTone(level, instrumentId = '') {
    const graph = ensureGachaTransitionGraph();
    if (!graph) return;
    try {
      void window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
      stopGachaTransitionTones();
      const ctx = graph.context, now=ctx.currentTime;
      const base=[523.25,587.33,659.25][Math.min(2,Math.max(0,level))];
      const instrumentStyles = {
        finalChip8:{wave:'square',length:.22,cutoff:6800,gain:.07},
        finalKoto:{wave:'triangle',length:.45,cutoff:2800,gain:.12},
        finalTrumpet:{wave:'sawtooth',length:.48,cutoff:1500,gain:.11},
        finalPipeOrgan:{wave:'sine',length:.66,cutoff:2300,gain:.18},
        finalVibraphone:{wave:'sine',length:.9,cutoff:6000,gain:.16}
      };
      const style = instrumentStyles[instrumentId] || {wave:'sine',length:.4,cutoff:5000,gain:.13};
      const notes = level===2 ? [1,1.259921,1.498307] : [1];
      notes.forEach((ratio,index) => {
        const t=now + (level===2 ? index*.2 : 0);
        const osc=ctx.createOscillator();
        const gain=ctx.createGain();
        const filter=ctx.createBiquadFilter();
        filter.type='lowpass';
        filter.frequency.value=style.cutoff;
        osc.type=style.wave;
        osc.frequency.setValueAtTime(base*ratio,t);
        gain.gain.setValueAtTime(.0001,t);
        gain.gain.linearRampToValueAtTime(style.gain,t+.025);
        gain.gain.exponentialRampToValueAtTime(.0001,t+style.length);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(graph.master);
        const voice={osc,gain,filter};
        gachaTransitionVoices.add(voice);
        osc.onended=() => {
          gachaTransitionVoices.delete(voice);
          try {osc.disconnect(); filter.disconnect(); gain.disconnect();} catch (_) {}
        };
        osc.start(t);
        osc.stop(t+style.length+.04);
      });
    } catch (_) {}
  }
  let gachaTouchOrchestraGraph = null;
  let gachaTouchOrchestraBuffer = null;
  let gachaTouchOrchestraLoading = null;
  let gachaTouchOrchestraSource = null;

  function prepareGachaFlourish() {
    if (gachaFlourishBuffer) return Promise.resolve();
    if (gachaFlourishLoading) return gachaFlourishLoading;
    try {
      const bridge = window.HP_AUDIO_BRIDGE?.get?.();
      if (!bridge) return Promise.resolve();
      if (!gachaFlourishGraph) {
        const gain = bridge.context.createGain();
        gain.gain.value = .95;
        window.HP_SOUND_SETTINGS?.bind?.('effects', gain);
        gain.connect(bridge.output);
        gachaFlourishGraph = { context:bridge.context, gain };
      }
      gachaFlourishLoading = fetch('/audio/gacha-touch-orchestra-v1.mp3?v=2', { cache:'force-cache' })
        .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('gacha sound unavailable')))
        .then(buffer => gachaFlourishGraph.context.decodeAudioData(buffer))
        .then(buffer => { gachaFlourishBuffer = buffer; })
        .catch(() => {})
        .finally(() => { gachaFlourishLoading = null; });
      return gachaFlourishLoading;
    } catch (_) {
      return Promise.resolve();
    }
  }

  function prepareGachaTouchOrchestra() {
    if (gachaTouchOrchestraBuffer) return Promise.resolve();
    if (gachaTouchOrchestraLoading) return gachaTouchOrchestraLoading;
    try {
      const bridge = window.HP_AUDIO_BRIDGE?.get?.();
      if (!bridge) return Promise.resolve();
      if (!gachaTouchOrchestraGraph) {
        const gain = bridge.context.createGain();
        gain.gain.value = .96;
        window.HP_SOUND_SETTINGS?.bind?.('effects', gain);
        gain.connect(bridge.output);
        gachaTouchOrchestraGraph = { context:bridge.context, gain };
      }
      gachaTouchOrchestraLoading = fetch('/audio/gacha-touch-orchestra-v1.mp3?v=1', { cache:'force-cache' })
        .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('gacha touch orchestra unavailable')))
        .then(buffer => gachaTouchOrchestraGraph.context.decodeAudioData(buffer))
        .then(buffer => { gachaTouchOrchestraBuffer = buffer; })
        .catch(() => {})
        .finally(() => { gachaTouchOrchestraLoading = null; });
      return gachaTouchOrchestraLoading;
    } catch (_) {
      return Promise.resolve();
    }
  }

  function stopGachaTouchOrchestra() {
    const source = gachaTouchOrchestraSource;
    gachaTouchOrchestraSource = null;
    if (!source) return;
    try { source.stop(); } catch (_) {}
    try { source.disconnect(); } catch (_) {}
  }

  function playGachaTouchOrchestra() {
    try {
      if (!gachaTouchOrchestraBuffer || !gachaTouchOrchestraGraph) {
        void prepareGachaTouchOrchestra();
        return 0;
      }
      void window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
      stopHomeTapSound();
      stopGachaTouchOrchestra();
      const source = gachaTouchOrchestraGraph.context.createBufferSource();
      const gain = gachaTouchOrchestraGraph.context.createGain();
      gain.gain.value = 1;
      source.buffer = gachaTouchOrchestraBuffer;
      source.connect(gain);
      gain.connect(gachaTouchOrchestraGraph.gain);
      gachaTouchOrchestraSource = source;
      source.onended = () => {
        try { source.disconnect(); gain.disconnect(); } catch (_) {}
        if (gachaTouchOrchestraSource === source) gachaTouchOrchestraSource = null;
      };
      source.start();
      return gachaTouchOrchestraBuffer.duration || 0;
    } catch (_) {
      return 0;
    }
  }

  function playGachaPianoChord() {
    try {
      const bridge = window.HP_AUDIO_BRIDGE?.get?.();
      if (!bridge) return;
      void window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
      const ctx = bridge.context;
      const master = ctx.createGain();
      master.gain.setValueAtTime(.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(.18, ctx.currentTime + .025);
      master.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + 1.45);
      window.HP_SOUND_SETTINGS?.bind?.('effects', master);
      master.connect(bridge.output);
      [261.63,329.63,392,523.25,659.25].forEach((frequency,index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index % 2 ? 'triangle' : 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(.23/(index+1), ctx.currentTime + .025 + index*.07);
        gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .75 + index*.11);
        osc.connect(gain); gain.connect(master);
        osc.start(ctx.currentTime + index*.07);
        osc.stop(ctx.currentTime + 1.1 + index*.12);
      });
      setTimeout(() => { try { master.disconnect(); } catch (_) {} }, 1700);
    } catch (_) {}
  }

  function stopGachaAcquisitionVoice() {
    if (!gachaAcquisitionVoiceSource) return;
    const source = gachaAcquisitionVoiceSource;
    gachaAcquisitionVoiceSource = null;
    source.onended = null;
    try { source.stop(); } catch (_) {}
    try { source.disconnect(); } catch (_) {}
  }

  async function playGachaAcquisitionVoice(result) {
    if (result?.kind !== 'character' || result?.isNewCharacter !== true || !result.characterId) return;
    const character = registry?.get?.(result.characterId);
    if (!character) return;
    const set = registry?.voiceSet?.(character);
    const defaults = (set?.entries || []).filter(entry => entry?.file).slice(0,5);
    if (!defaults.length) return;
    const entry = defaults[Math.floor(Math.random() * defaults.length)];
    try {
      const generationResultId = result.id;
      const buffer = await prepareVoice(entry.file, set);
      if (!buffer || gachaAnimationMode !== 'reveal' || gachaResultState?.results?.find(r => r.id === generationResultId) == null) return;
      const graph = ensureVoiceGraph();
      if (!graph) return;
      stopGachaAcquisitionVoice();
      window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
      const source = graph.context.createBufferSource();
      const gain = graph.context.createGain();
      gain.gain.value = 1;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(graph.gain);
      gachaAcquisitionVoiceSource = source;
      source.onended = () => {
        try { source.disconnect(); gain.disconnect(); } catch (_) {}
        if (gachaAcquisitionVoiceSource === source) gachaAcquisitionVoiceSource = null;
      };
      source.start();
    } catch (_) {}
  }

  // Ascending musical levels: standard +0, rainbow +200 cents, instrument +400.
  function playGachaFlourish(pitchCents = 0, maxSeconds = 0) {
    try {
      if (!gachaFlourishBuffer || !gachaFlourishGraph) return;
      void window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
      stopGachaFlourish();
      const ctx = gachaFlourishGraph.context;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const when = ctx.currentTime;
      const pitchRatio = Math.pow(2, pitchCents / 1200);
      source.buffer = gachaFlourishBuffer;
      if (Number.isFinite(source.detune?.value)) source.detune.value = pitchCents;
      gain.gain.setValueAtTime(.82,when);
      const length = gachaFlourishBuffer.duration / pitchRatio;
      let scheduledStop = 0;
      if (maxSeconds > 0 && length > .1) {
        const duration = Math.min(maxSeconds,length);
        gain.gain.setValueAtTime(.82,when+Math.max(0,duration-.12));
        gain.gain.linearRampToValueAtTime(.001,when+duration);
        scheduledStop = when+duration+.012;
      }
      source.connect(gain);
      gain.connect(gachaFlourishGraph.gain);
      const voice = {source,gain};
      gachaFlourishSources.add(voice);
      source.onended = () => {
        gachaFlourishSources.delete(voice);
        try {source.disconnect();gain.disconnect();} catch (_) {}
      };
      source.start(when);
      if (scheduledStop) source.stop(scheduledStop);
    } catch (_) {}
  }

  function resetGachaAnimationClasses(overlay) {
    overlay?.classList.remove(
      'is-playing','is-ten','is-special','is-awaiting-touch','is-revealing',
      'is-intro','is-draw-reveal','is-character-hit','is-item-hit','is-mandatory-special',
      'is-upgrading','is-upgrade-rainbow','is-instrument-hit'
    );
  }

  function finishGachaAnimation(status = 'done') {
    clearTimeout(gachaAnimationTimer);
    clearTimeout(gachaAnimationReadyTimer);
    clearGachaUpgradeTimers();
    stopGachaFlourish();
    stopGachaTransitionTones();
    gachaAnimationTimer = 0;
    gachaAnimationReadyTimer = 0;
    gachaAnimationAwaitingTouch = false;
    gachaAnimationMandatory = false;
    gachaAnimationMode = 'idle';
    const overlay = home.querySelector('[data-gacha-animation-overlay]');
    if (overlay) {
      resetGachaAnimationClasses(overlay);
      overlay.hidden = true;
    }
    const resolve = gachaAnimationResolve;
    gachaAnimationResolve = null;
    resolve?.(status);
  }

  function playGachaIntro(count) {
    const overlay = home.querySelector('[data-gacha-animation-overlay]');
    if (!overlay) return Promise.resolve('touch');
    clearTimeout(gachaAnimationTimer);
    clearTimeout(gachaAnimationReadyTimer);
    clearGachaUpgradeTimers();
    stopGachaFlourish();
    stopGachaTransitionTones();
    resetGachaAnimationClasses(overlay);
    gachaAnimationMode = 'intro';
    gachaAnimationAwaitingTouch = false;
    overlay.hidden = false;
    overlay.style.setProperty('--gacha-stage-bg','url("' + gachaVisuals.piano + '")');
    overlay.classList.add('is-playing','is-intro');
    overlay.classList.toggle('is-ten', count === 10);
    const label = overlay.querySelector('[data-gacha-animation-label]');
    if (label) label.textContent = '夢のステージが、幕を開ける——';
    return new Promise(resolve => {
      gachaAnimationResolve = resolve;
      gachaAnimationReadyTimer = setTimeout(() => {
        if (!gachaAnimationResolve) return;
        gachaAnimationAwaitingTouch = true;
        overlay.classList.add('is-awaiting-touch');
        if (label) label.textContent = 'ピアノに触れてください';
      }, 1050);
    });
  }

  function touchGachaPiano() {
    const overlay = home.querySelector('[data-gacha-animation-overlay]');
    if (!overlay || gachaAnimationMode !== 'intro' || !gachaAnimationAwaitingTouch) return;
    gachaAnimationAwaitingTouch = false;
    overlay.classList.remove('is-awaiting-touch');
    playHomeTapSound();
    playGachaPianoChord();
    const label = overlay.querySelector('[data-gacha-animation-label]');
    if (label) label.textContent = 'さあ、運命の演奏を——';
    gachaAnimationTimer = setTimeout(() => finishGachaAnimation('touch'), 520);
  }

  function playGachaDrawReveal(result,index,total,{ mandatory=false }={}) {
    const overlay=home.querySelector('[data-gacha-animation-overlay]');
    if (!overlay) return Promise.resolve('done');
    clearTimeout(gachaAnimationTimer);
    clearGachaUpgradeTimers();
    stopGachaAcquisitionVoice();
    stopGachaFlourish();
    stopGachaTransitionTones();
    resetGachaAnimationClasses(overlay);
    gachaAnimationMode='reveal';
    gachaAnimationMandatory=mandatory;
    overlay.hidden=false;
    overlay.classList.toggle('is-mandatory-special',mandatory);

    const isCharacter=result?.kind==='character';
    const isInstrument=result?.kind==='instrument';
    const isRainbow=result?.rarity==='rainbow'||isCharacter||isInstrument;
    const label=overlay.querySelector('[data-gacha-animation-label]');
    const cardTitle=overlay.querySelector('.hp-gacha-reveal-card b');
    const cardEmblem=overlay.querySelector('.hp-gacha-reveal-emblem');
    const instrumentName=overlay.querySelector('[data-gacha-instrument-name]');
    const instrumentIcon=overlay.querySelector('[data-gacha-instrument-glyph]');
    const instrumentGlyphs={finalChip8:'♫',finalKoto:'♬',finalTrumpet:'♩',
      finalPipeOrgan:'♭',finalVibraphone:'✦'};
    overlay.style.setProperty('--gacha-stage-bg','url("'+gachaVisuals.normal+'")');
    overlay.classList.add('is-playing','is-draw-reveal','is-revealing','is-item-hit');
    overlay.classList.toggle('is-upgrading',isRainbow);
    overlay.classList.toggle('is-ten',total===10);
    overlay.dataset.drawIndex=String(index+1);
    if (label) label.textContent='光が、新しい贈り物を結ぶ——';
    if (cardTitle) cardTitle.textContent=isRainbow?'MYSTERY':'REWARD';
    if (cardEmblem) cardEmblem.textContent='♪';
    if (instrumentName) instrumentName.textContent=isInstrument
      ? (window.HP_INSTRUMENTS?.[result.instrumentId]?.name || result.name || '新しい楽器') : '';
    if (instrumentIcon) instrumentIcon.textContent=instrumentGlyphs[result?.instrumentId]||'♫';

    // Wait for the ordinary flourish to actually play through before
    // raising the pitch. On a cold cache, allow more than three seconds.
    const trackMs=Math.round((gachaFlourishBuffer?.duration||0)*1000);
    const normalStageMs=Math.max(3500,Math.min(6500,trackMs+260));
    const rainbowStageMs=Math.max(2600,Math.min(5100,trackMs+180));
    const instrumentStageMs=3200;
    playGachaFlourish(0);
    playGachaTransitionTone(0);

    if (isRainbow) {
      scheduleGachaUpgrade(() => {
        overlay.classList.remove('is-item-hit');
        overlay.classList.add('is-special','is-upgrade-rainbow');
        overlay.classList.toggle('is-character-hit',isCharacter);
        overlay.style.setProperty('--gacha-stage-bg','url("'+gachaVisuals.special+'")');
        if (label) label.textContent='虹色の旋律—— RAINBOW!';
        if (cardTitle) cardTitle.textContent=isCharacter?'CHARACTER':'RAINBOW';
        playGachaFlourish(200);
        playGachaTransitionTone(1);
        if (isCharacter && result?.isNewCharacter===true) {
          scheduleGachaUpgrade(() => {void playGachaAcquisitionVoice(result);},640);
        }
      },normalStageMs);
    }

    if (isInstrument) {
      scheduleGachaUpgrade(() => {
        // A separate full-scale animated instrument reveal, not merely
        // recoloring the earlier character/item card.
        overlay.classList.remove('is-upgrade-rainbow');
        overlay.classList.add('is-instrument-hit');
        if (label) label.textContent='さらなる高みへ—— 新たな楽器、解放！';
        playGachaFlourish(400);
        playGachaTransitionTone(2,result.instrumentId);
      },normalStageMs+rainbowStageMs);
    }

    const duration=isInstrument
      ? normalStageMs+rainbowStageMs+instrumentStageMs
      : isRainbow?normalStageMs+rainbowStageMs+350:1650;
    return new Promise(resolve => {
      gachaAnimationResolve=resolve;
      gachaAnimationTimer=setTimeout(() => finishGachaAnimation('done'),duration);
    });
  }

  function markNewSpecialRevealSeen(index) {
    if (!gachaResultState || !Number.isInteger(index)) return;
    if (!(gachaResultState.seenNewSpecialIndexes instanceof Set)) {
      gachaResultState.seenNewSpecialIndexes = new Set();
    }
    gachaResultState.seenNewSpecialIndexes.add(index);
  }

  function pendingNewSpecialIndexes() {
    if (!gachaResultState) return [];
    const seen = gachaResultState.seenNewSpecialIndexes instanceof Set
      ? gachaResultState.seenNewSpecialIndexes
      : new Set();
    return gachaResultState.results
      .map((result,index) => ({ result,index }))
      .filter(({result,index}) =>
        ((result?.kind === 'character' && result?.isNewCharacter === true)
        || (result?.kind === 'instrument' && result?.isNewReward === true))
        && !seen.has(index)
      )
      .map(({index}) => index);
  }

  function nextPendingNewSpecialIndex(afterIndex = -1) {
    const pending = pendingNewSpecialIndexes();
    if (!pending.length) return -1;
    const later = pending.find(index => index > afterIndex);
    return Number.isInteger(later) ? later : pending[0];
  }

  async function revealNextPendingNewSpecial(afterIndex = -1) {
    if (!gachaResultState) return false;
    const index = nextPendingNewSpecialIndex(afterIndex);
    if (index < 0) return false;

    const resultOverlay = home.querySelector('[data-gacha-result-overlay]');
    if (resultOverlay) resultOverlay.hidden = true;
    destroyGachaResultMotions();

    const result = gachaResultState.results[index];
    gachaDrawing = true;
    renderGachaScreen();
    await playGachaDrawReveal(result, index, gachaResultState.results.length, { mandatory:true });
    markNewSpecialRevealSeen(index);

    gachaResultState.index = index;
    gachaResultState.summary = false;
    gachaResultTransitioning = false;
    gachaDrawing = false;
    gachaScreen?.classList.remove('is-drawing');
    if (resultOverlay) resultOverlay.hidden = false;
    renderGachaResultStep();
    renderGachaScreen();
    return true;
  }

  function nextRainbowResultIndex(afterIndex = -1) {
    if (!gachaResultState?.results?.length) return -1;
    for (let index = Math.max(-1, afterIndex) + 1; index < gachaResultState.results.length; index++) {
      const result = gachaResultState.results[index];
      // Only a genuinely new character gets the rainbow reveal.
      // Already-owned characters — including duplicates first obtained earlier
      // in this same 10-pull — are kept for the final summary only.
      if (result?.rarity === 'rainbow' && result?.isNewCharacter === true) return index;
    }
    return -1;
  }

  function showFinalGachaSummary() {
    if (!gachaResultState?.results?.length) return;
    const animationOverlay = home.querySelector('[data-gacha-animation-overlay]');
    const resultOverlay = home.querySelector('[data-gacha-result-overlay]');
    if (animationOverlay) {
      resetGachaAnimationClasses(animationOverlay);
      animationOverlay.hidden = true;
    }
    gachaResultState.index = gachaResultState.results.length - 1;
    gachaResultState.summary = true;
    gachaResultTransitioning = false;
    gachaDrawing = false;
    gachaScreen?.classList.remove('is-drawing');
    if (resultOverlay) resultOverlay.hidden = false;
    renderGachaResultStep();
    renderGachaScreen();
  }

  async function transitionToGachaResultIndex(nextIndex) {
    if (!gachaResultState || gachaResultTransitioning) return;
    const overlay = home.querySelector('[data-gacha-result-overlay]');
    const { results } = gachaResultState;
    if (nextIndex < 0 || nextIndex >= results.length) return;

    gachaResultTransitioning = true;
    if (overlay) overlay.hidden = true;
    destroyGachaResultMotions();
    gachaDrawing = true;
    renderGachaScreen();
    const status = await playGachaDrawReveal(
      results[nextIndex],
      nextIndex,
      results.length,
      { mandatory: results[nextIndex]?.isNewCharacter === true
          || (results[nextIndex]?.kind === 'instrument' && results[nextIndex]?.isNewReward === true) }
    );
    if (status === 'done' && (results[nextIndex]?.isNewCharacter === true
      || (results[nextIndex]?.kind === 'instrument' && results[nextIndex]?.isNewReward === true))) {
      markNewSpecialRevealSeen(nextIndex);
    }
    if (status === 'summary') {
      const stoppedOnNewCharacter = await revealNextPendingNewSpecial(nextIndex);
      if (!stoppedOnNewCharacter) showFinalGachaSummary();
      return;
    }
    gachaResultState.index = nextIndex;
    gachaResultState.summary = false;
    if (overlay) overlay.hidden = false;
    renderGachaResultStep();
    gachaResultTransitioning = false;
    gachaDrawing = false;
    renderGachaScreen();
  }

  async function advanceGachaResult() {
    if (!gachaResultState || gachaResultState.summary || gachaResultTransitioning) return;
    const { results, index } = gachaResultState;
    if (results.length <= 1) return;

    // Once SKIP is chosen for a ten-pull, keep that choice active after a
    // mandatory rainbow stop. A tap on the rainbow result resumes skipping
    // to the next unseen NEW character; if there is none, show the summary.
    if (gachaResultState.skipMode === true) {
      gachaResultTransitioning = true;
      const stoppedOnNewCharacter = await revealNextPendingNewSpecial(index);
      if (!stoppedOnNewCharacter) showFinalGachaSummary();
      return;
    }

    // Normal mode reveals every result one by one.
    if (index < results.length - 1) {
      await transitionToGachaResultIndex(index + 1);
    } else {
      gachaResultState.summary = true;
      renderGachaResultStep();
    }
  }

  async function skipGachaResultSequence() {
    if (!gachaResultState || gachaResultState.results.length <= 1 || gachaResultState.summary || gachaResultTransitioning) return;
    gachaResultState.skipMode = true;
    gachaResultTransitioning = true;
    const stoppedOnNewCharacter = await revealNextPendingNewSpecial(gachaResultState.index);
    if (!stoppedOnNewCharacter) showFinalGachaSummary();
  }

  function skipGachaAnimationToLast() {
    if (gachaAnimationMandatory) return;
    if (gachaResultState?.results?.length > 1) gachaResultState.skipMode = true;
    finishGachaAnimation(gachaResultState?.results?.length > 1 ? 'summary' : 'result');
  }

  async function runTrialGacha(count) {
    if (!gachaTrialEnabled || gachaDrawing) return;
    const cost = count === 10 ? 10 : 1;
    if (missionState.tickets < cost) return;
    if (!gachaPool().length) return;

    gachaDrawing = true;
    closeGachaResult();
    gachaDrawing = true;
    missionState.tickets = Math.max(0, missionState.tickets - cost);
    saveMissionState();
    renderGachaScreen();

    let results = Array.from({length:cost}, (_,index) =>
      drawTrialResult({
        forceItem: cost === 10 && index === 0,
      })
    ).filter(Boolean);

    // Staging QA: guarantee new customization previews and one earned
    // instrument per 10-pull so each approved instrument can be tested.
    if (cost === 10 && results.length >= 5) {
      const qaRewards = [
        ...gachaTrialItems.filter(item => item.kind === 'profileEffect').slice(0,2),
        gachaTrialItems.find(item => item.kind === 'pianoSkin'),
        gachaTrialItems.find(item => item.kind === 'touchEffect'),
        gachaTrialItems.find(item => item.kind === 'pianoBackground'),
      ].filter(Boolean);
      qaRewards.forEach((item, index) => {
        if (index < results.length) results[index] = { ...item };
      });
      const newInstrument = gachaInstrumentRewards.find(item =>
        !gachaInventory.instruments.includes(item.instrumentId));
      const instrumentReward = newInstrument || gachaInstrumentRewards[Math.floor(Math.random()*gachaInstrumentRewards.length)];
      if (instrumentReward && results.length > 5) results[5] = { ...instrumentReward };
    }

    // Staging QA: a 10-pull always contains at least one rainbow character,
    // but its position is random so post-rainbow skip behavior can actually be tested.
    if (cost === 10 && !results.some(result => result?.rarity === 'rainbow')) {
      const pool = gachaPool();
      const character = pool[Math.floor(Math.random() * pool.length)];
      const qaReserved = cost === 10 ? Math.min(6, Math.max(0, results.length - 1)) : 1;
      const rainbowIndex = qaReserved + Math.floor(Math.random() * Math.max(1, results.length - qaReserved));
      if (character && results.length) results[Math.min(rainbowIndex, results.length - 1)] = makeCharacterResult(character);
    }

    results = annotateGachaOwnership(results).map(result => ({
      ...result,
      isNewCharacter: result?.kind === 'character' && result?.isNewReward === true,
    }));

    grantGachaResults(results);

    const resultAssetsReady = Promise.all(results
      .filter(result => result.kind === 'character')
      .map(result => {
        const character = registry?.get?.(result.characterId);
        return character ? window.HP_MOTION_CHARACTER?.preload?.(character).catch?.(() => null) : null;
      }));

    gachaResultState = { results:[...results], index:0, summary:false, skipMode:false, seenNewSpecialIndexes:new Set() };
    gachaTrialState.history.unshift({
      at:new Date().toISOString(),
      count:cost,
      results:results.map(result => ({ kind:result.kind, id:result.id })),
    });
    gachaTrialState.history = gachaTrialState.history.slice(0,100);
    saveGachaTrialState();

    gachaScreen?.classList.add('is-drawing');
    const introStatus = await playGachaIntro(cost);
    if (introStatus === 'summary' || introStatus === 'result') {
      await resultAssetsReady;
      if (introStatus === 'summary') {
        const stoppedOnNewCharacter = await revealNextPendingNewSpecial(-1);
        if (!stoppedOnNewCharacter) showFinalGachaSummary();
      } else {
        gachaResultState.index = 0;
        gachaResultState.summary = false;
        gachaScreen?.classList.remove('is-drawing');
        const resultOverlay = home.querySelector('[data-gacha-result-overlay]');
        if (resultOverlay) resultOverlay.hidden = false;
        renderGachaResultStep();
        gachaDrawing = false;
        renderGachaScreen();
      }
      return;
    }

    // Ten-pull and single-pull both begin from result #1.
    // Ten-pull advances sequentially through all ten results unless the user explicitly presses SKIP.
    const firstStatus = await playGachaDrawReveal(results[0],0,results.length, {
      mandatory: results[0]?.isNewCharacter === true
       || (results[0]?.kind === 'instrument' && results[0]?.isNewReward === true)
    });
    if (firstStatus === 'done' && (results[0]?.isNewCharacter === true
      || (results[0]?.kind === 'instrument' && results[0]?.isNewReward === true))) markNewSpecialRevealSeen(0);
    await resultAssetsReady;
    gachaResultState.index = 0;
    gachaResultState.summary = false;
    gachaScreen?.classList.remove('is-drawing');
    const resultOverlay = home.querySelector('[data-gacha-result-overlay]');
    if (resultOverlay) resultOverlay.hidden = false;
    renderGachaResultStep();
    gachaDrawing = false;
    renderGachaScreen();
  }

  function renderGachaScreen() {
    const toukaTop = home.querySelector('.hp-gacha-touka-card-art');
    if (toukaTop && toukaTop.dataset.gachaFallbackBound !== 'true') {
      toukaTop.dataset.gachaFallbackBound = 'true';
      toukaTop.addEventListener('error', () => {
        toukaTop.src = registry?.get?.('character01')?.profileBackground || defaultProfileImage;
      });
    }
    if (gachaTrialEnabled && missionState.tickets !== gachaTrialTicketCap) {
      missionState.tickets = gachaTrialTicketCap;
      saveMissionState();
    }
    const gachaTicketCount = home.querySelector('[data-gacha-ticket-count]');
    if (gachaTicketCount) gachaTicketCount.textContent = String(missionState.tickets);

    home.querySelectorAll('[data-gacha-character-image]').forEach(image => {
      const character = registry?.get?.(image.dataset.gachaCharacterImage);
      const source = character?.listImage || character?.profileBackground || defaultProfileImage;
      if (image.dataset.gachaResolvedSource !== source) {
        image.dataset.gachaResolvedSource = source;
        image.src = source;
      }
      if (image.dataset.gachaFallbackBound !== 'true') {
        image.dataset.gachaFallbackBound = 'true';
        image.addEventListener('error', () => {
          const fallback = character?.profileBackground || defaultProfileImage;
          if (image.src !== fallback) image.src = fallback;
        });
      }
    });

    home.querySelectorAll('[data-gacha-pull]').forEach(button => {
      const cost = Number(button.dataset.gachaPull) === 10 ? 10 : 1;
      const state = button.querySelector('[data-gacha-button-state]');
      button.disabled = !gachaTrialEnabled || gachaDrawing || missionState.tickets < cost;
      if (state) state.textContent = !gachaTrialEnabled
        ? '準備中'
        : missionState.tickets >= cost ? '引く' : 'チケット不足';
    });
    const note = home.querySelector('[data-gacha-note]');
    if (note && gachaTrialEnabled && !gachaDrawing) {
      note.textContent = 'staging限定｜新しい楽器は獲得後ピアノモードで使用可能（再読み込み後も所持）。背景・フレーム・ボイスなど試作アイテムは再読み込みでリセット。10連で未獲得楽器を1つ確認できます。';
    }
  }

  function openGachaScreen() {
    if (!gachaScreen || !gachaScreen.hidden) return;
    closeHomeDialog();
    if (characterScreen && !characterScreen.hidden) closeCharacterScreen();
    if (missionScreen && !missionScreen.hidden) closeMissionScreen();
    if (rankingScreen && !rankingScreen.hidden) closeRankingScreen();
    renderGachaScreen();
    void prepareHomeTapSound();
    void prepareGachaFlourish();
    for (const character of gachaPool()) {
      void window.HP_MOTION_CHARACTER?.preload?.(character).catch?.(() => {});
    }
    canvas.inert = true;
    gachaScreen.hidden = false;
    stopCharacterVoice();
    syncCharacterVoice();
    gachaScreen.querySelector('[data-home-action="gacha-screen-close"]')?.focus({preventScroll:true});
  }

  function closeGachaScreen() {
    if (!gachaScreen || gachaScreen.hidden) return;
    closeGachaResult();
    finishGachaAnimation();
    gachaScreen.hidden = true;
    canvas.inert = false;
    syncCharacterVoice();
    gachaMenuButton?.focus({preventScroll:true});
  }

  gachaMenuButton?.addEventListener('click', openGachaScreen);
  gachaScreen?.querySelector('[data-home-action="gacha-screen-close"]')?.addEventListener('click', closeGachaScreen);
  home.querySelectorAll('[data-gacha-pull]').forEach(button => button.addEventListener('click', () => {
    void runTrialGacha(Number(button.dataset.gachaPull) === 10 ? 10 : 1);
  }));
  home.querySelectorAll('[data-gacha-result-close]').forEach(button => button.addEventListener('click', closeGachaResult));
  home.querySelector('[data-gacha-result-next]')?.addEventListener('click', advanceGachaResult);
  home.querySelector('[data-gacha-result-skip]')?.addEventListener('click', () => { void skipGachaResultSequence(); });

  const gachaResultOverlay = home.querySelector('[data-gacha-result-overlay]');
  let lastGachaResultPointerActionAt = -Infinity;
  function handleGachaResultSurface(event) {
    const now = performance.now();
    if (event.type === 'click' && now - lastGachaResultPointerActionAt < 700) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!gachaResultOverlay || gachaResultOverlay.hidden || !gachaResultState || gachaResultState.summary) return;
    if (event.target?.closest?.('[data-gacha-result-skip]')) return;
    if (event.type === 'pointerup') {
      if (event.button > 0) return;
      lastGachaResultPointerActionAt = now;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (gachaResultState.results.length > 1) {
      void advanceGachaResult();
    } else {
      closeGachaResult();
    }
  }
  gachaResultOverlay?.addEventListener('pointerup', handleGachaResultSurface, { capture:true });
  gachaResultOverlay?.addEventListener('click', handleGachaResultSurface, { capture:true });
  const gachaAnimationOverlay = home.querySelector('[data-gacha-animation-overlay]');
  gachaAnimationOverlay?.addEventListener('pointerdown', event => {
    if (event.button > 0) return;
    if (gachaAnimationAwaitingTouch && !event.target.closest('[data-gacha-animation-skip]')) {
      touchGachaPiano();
    }
  }, { passive:true });
  gachaAnimationOverlay?.addEventListener('click', event => {
    // Keyboard / assistive-tech fallback. Pointer taps already run on pointerdown.
    if (event.detail === 0 && gachaAnimationAwaitingTouch && !event.target.closest('[data-gacha-animation-skip]')) {
      touchGachaPiano();
    }
  });
  home.querySelector('[data-gacha-animation-skip]')?.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    skipGachaAnimationToLast();
  });

    window.HP_HOME_RANKING = {
    set(data = {}) {
      rankingState = {
        overall: Array.isArray(data.overall) ? data.overall.slice(0,100) : rankingState.overall,
        monthly: Array.isArray(data.monthly) ? data.monthly.slice(0,100) : rankingState.monthly,
        self: data.self && typeof data.self === 'object' ? data.self : rankingState.self,
      };
      try { localStorage.setItem(rankingStateKey, JSON.stringify(rankingState)); } catch (_) {}
      renderRankingScreen();
    },
    clear() {
      rankingState = { overall:[], monthly:[], self:{ overall:null, monthly:null } };
      try { localStorage.removeItem(rankingStateKey); } catch (_) {}
      renderRankingScreen();
    },
  };

  piano.addEventListener('hp-note-on', () => recordMissionStat('notes',1));
  recordMissionStat('homeOpen',1);

    const characterMenuButton = home.querySelector('[data-home-action="characters"]');
  let characterScreenOpener = null;
  function openCharacterScreen() {
    if (!characterScreen || !characterScreen.hidden) return;
    characterScreenOpener = characterMenuButton;
    setCharacterHeaderActionsVisible(false);
    renderCharacterScreen();
    canvas.inert = true;
    characterScreen.hidden = false;
    stopCharacterVoice();
    syncCharacterVoice();
    previewMotion.setActive(false);
    requestAnimationFrame(() => {
      characterScreen.querySelector('[data-home-action="character-screen-close"]')?.focus({ preventScroll:true });
    });
  }
  function closeCharacterScreen() {
    if (!characterScreen || characterScreen.hidden) return;
    characterScreen.hidden = true;
    setCharacterHeaderActionsVisible(false);
    canvas.inert = false;
    previewMotion.setActive(false);
    stopDetailVoice();
    syncCharacterVoice();
    characterScreenOpener?.focus({ preventScroll:true });
    characterScreenOpener = null;
  }
  characterMenuButton?.addEventListener('click', openCharacterScreen);
  characterScreen?.querySelector('[data-home-action="character-screen-close"]')?.addEventListener('click', closeCharacterScreen);

  home.querySelectorAll('[data-home-action="dialog-close"]').forEach(button => button.addEventListener('click', closeHomeDialog));
  homeVolume.addEventListener('input', () => {
    pianoVolume.value = homeVolume.value;
    pianoVolume.dispatchEvent(new Event('input', { bubbles:true }));
  });
  pianoVolume.addEventListener('input', syncHomeVolume);
  home.querySelectorAll('input[type="range"]').forEach(input => {
    let pointer = null, bounds, rotated;
    const update = event => {
      const length = rotated ? bounds.height : bounds.width;
      const position = rotated ? event.clientY - bounds.top : event.clientX - bounds.left;
      const ratio = Math.max(0, Math.min(1, (position - 16) / Math.max(1, length - 32)));
      input.value = Math.round(Number(input.min) + ratio * (Number(input.max) - Number(input.min)));
      input.dispatchEvent(new Event('input', { bubbles:true }));
    };
    input.addEventListener('pointerdown', event => {
      if (event.button > 0 || pointer !== null) return;
      event.preventDefault();
      pointer = event.pointerId; bounds = input.getBoundingClientRect();
      rotated = document.documentElement.dataset.hpRotated === 'true';
      input.focus({ preventScroll:true }); input.setPointerCapture(pointer); update(event);
    }, { passive:false });
    input.addEventListener('pointermove', event => { if (event.pointerId === pointer) { event.preventDefault(); update(event); } }, { passive:false });
    const finish = event => {
      if (event.pointerId !== pointer) return;
      if (event.type === 'pointerup') update(event);
      pointer = null; input.dispatchEvent(new Event('change', { bubbles:true }));
    };
    ['pointerup','pointercancel','lostpointercapture'].forEach(name => input.addEventListener(name, finish));
  });
  home.addEventListener('keydown', event => {
    if (missionScreen && !missionScreen.hidden) {
      if (event.key === 'Escape') { event.preventDefault(); closeMissionScreen(); }
      return;
    }
    if (rankingScreen && !rankingScreen.hidden) {
      if (event.key === 'Escape') { event.preventDefault(); closeRankingScreen(); }
      return;
    }
    if (gachaScreen && !gachaScreen.hidden) {
      if (event.key === 'Escape') { event.preventDefault(); closeGachaScreen(); }
      return;
    }
    if (characterScreen && !characterScreen.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        const detail = home.querySelector('[data-character-screen="detail"]');
        if (detail && !detail.hidden) showCharacterList({ focus:true });
        else closeCharacterScreen();
      }
      return;
    }
    if (dialogOverlay.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeHomeDialog(); }
    if (event.key === 'Tab') {
      const controls = [...dialogOverlay.querySelectorAll('button,input')].filter(el => el.offsetParent !== null && !el.disabled);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  const launchFx = document.createElement('div');
  launchFx.className = 'hp-home-launch-fx';
  launchFx.setAttribute('aria-hidden', 'true');

  const ringA = document.createElement('span');
  ringA.className = 'hp-home-launch-ring ring-a';
  const ringB = document.createElement('span');
  ringB.className = 'hp-home-launch-ring ring-b';
  launchFx.append(ringA, ringB);

  const score = document.createElement('span');
  score.className = 'hp-home-launch-score';
  launchFx.appendChild(score);
  ['♪', '♫', '♬', '♪', '♫', '♪', '♬'].forEach((glyph, index) => {
    const note = document.createElement('span');
    note.className = 'hp-home-launch-particle'; note.textContent = glyph;
    note.style.setProperty('--angle', (-164 + index * 23) + 'deg');
    note.style.setProperty('--distance', (62 + index % 3 * 24) + 'px');
    note.style.setProperty('--delay', (index * .024) + 's');
    launchFx.appendChild(note);
  });
  home.appendChild(launchFx);

  let transitioning = false;
  let launchTimer = 0;
  let gamePreviewTimer = 0;
  const registry = window.HP_CHARACTERS;
  const characterSettings = window.HP_CHARACTER_SETTINGS;
  let homeCharacter = characterSettings.getHomeCharacter();
  let voiceSet = registry.voiceSet(homeCharacter);
  let messages = voiceSet.entries.map(entry => entry.lines);
  let voiceFiles = voiceSet.entries.map(entry => entry.file);
  const homeMotion = new window.HP_MOTION_CHARACTER.MotionCharacter(home.querySelector('[data-home-motion]'));
  const previewMotion = new window.HP_MOTION_CHARACTER.MotionCharacter(home.querySelector('[data-character-preview]'));
  void homeMotion.setCharacter(homeCharacter);
  let previewCharacterId = homeCharacter.id;
  let manualVoicePlays = 0;
  let messageIndex = 0;
  const voiceHistory = [];
  let voiceGraph = null;
  let voiceSource = null;
  let voiceGeneration = 0;
  let voiceUnlocked = false;
  let initialVoicePlayed = false;
  let pageActive = true;
  const voiceBuffers = new Map();

  function canSpeak() {
    return pageActive && !document.hidden && !home.hidden
      && !document.body.classList.contains('hp-booting')
      && !document.documentElement.classList.contains('hp-install-required')
      && dialogOverlay.hidden
      && (!characterScreen || characterScreen.hidden)
      && (!missionScreen || missionScreen.hidden)
      && (!rankingScreen || rankingScreen.hidden)
      && (!gachaScreen || gachaScreen.hidden)
      && !home.classList.contains('hp-piano-launching');
  }

  function ensureVoiceGraph() {
    if (voiceGraph) return voiceGraph;
    const bridge = window.HP_AUDIO_BRIDGE?.get?.();
    if (!bridge) return null;
    const gain = bridge.context.createGain();
    window.HP_SOUND_SETTINGS.bind('voice', gain);
    gain.connect(bridge.output);
    voiceGraph = { context: bridge.context, gain };
    return voiceGraph;
  }

  function prepareVoice(file, set = voiceSet) {
    const entry = set.entries.find(entry => entry.file === file) || (set.rare?.file === file ? set.rare : null);
    if (!entry) return Promise.reject(new Error('Voice not configured'));
    const url = entry.audioPath || set.audioBasePath + '/' + file + '.wav?v=' + encodeURIComponent(set.audioRevision || '1');
    if (!voiceBuffers.has(url)) {
      const graph = ensureVoiceGraph();
      if (!graph) return Promise.reject(new Error('Audio unavailable'));
      const task = fetch(url)
        .then(response => {
          if (!response.ok) throw new Error('Voice download failed');
          return response.arrayBuffer();
        })
        .then(data => graph.context.decodeAudioData(data))
        .catch(error => { voiceBuffers.delete(url); throw error; });
      voiceBuffers.set(url, task);
    }
    return voiceBuffers.get(url);
  }

  function voiceState(playing, speech = {}) {
    home.dataset.voicePlaying = String(playing);
    window.dispatchEvent(new CustomEvent('hp-home-voice-state', {
      detail: { playing, file: home.dataset.voiceFile, characterId: homeCharacter.id, ...speech },
    }));
  }

  function stopCharacterVoice() {
    voiceGeneration++;
    if (voiceSource) {
      const source = voiceSource;
      voiceSource = null;
      source.onended = null;
      try { source.stop(); source.disconnect(); } catch (_) {}
    }
    if (home.dataset.voicePlaying === 'true') voiceState(false);
  }

  function playMessageVoice(manual = false) {
    if (!canSpeak()) return;
    voiceUnlocked = true;
    initialVoicePlayed = true;
    stopCharacterVoice();
    const generation = voiceGeneration;
    const normalIndex = messageIndex;
    const selectedCharacter = homeCharacter, selectedSet = voiceSet;
    const rare = selectedSet.rare;
    const isRare = manual && rare?.interval > 0 && (manualVoicePlays + 1) % rare.interval === 0;
    const entry = isRare ? rare : selectedSet.entries[normalIndex];
    if (!entry?.file) return;
    const file = entry.file;
    try {
      window.HP_AUDIO_BRIDGE?.configureSession?.();
      window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
      const graph = ensureVoiceGraph();
      if (!graph) return;
      void prepareVoice(file, selectedSet).then(buffer => {
        // A late download must never speak an older message or play in PIANO.
        if (generation !== voiceGeneration || selectedCharacter.id !== homeCharacter.id || !canSpeak()) return;
        const source = graph.context.createBufferSource();
        source.buffer = buffer;
        source.connect(graph.gain);
        source.onended = () => {
          source.disconnect();
          if (voiceSource !== source) return;
          voiceSource = null;
          voiceState(false);
        };
        voiceSource = source;
        home.dataset.voiceFile = file;
        const startedAt = graph.context.currentTime;
        source.start(startedAt);
        if (manual) manualVoicePlays++;
        if (!isRare) {
          voiceHistory.unshift(normalIndex);
          voiceHistory.length = Math.min(voiceHistory.length, messages.length);
        }
        renderDialogueLines(entry.lines || messages[normalIndex], isRare);
        voiceState(true, { characterId: selectedCharacter.id, buffer, context: graph.context, startedAt,
          reading: entry.reading, message: (entry.lines || messages[normalIndex] || []).join('') });
      }).catch(() => {});
    } catch (_) {}
  }

  function fitDialogueToCard() {
    if (!dialogue || !dialogue.isConnected) return;
    dialogue.classList.remove('hp-dialogue-long', 'hp-dialogue-extra-long', 'hp-dialogue-fit-small');
    dialogue.style.removeProperty('--dialogue-fit-scale');
    const fits = () => dialogue.scrollHeight <= dialogue.clientHeight + 1 && dialogue.scrollWidth <= dialogue.clientWidth + 1;
    if (fits()) return;
    dialogue.classList.add('hp-dialogue-long');
    if (fits()) return;
    dialogue.classList.add('hp-dialogue-extra-long');
    if (fits()) return;
    let scale = 1;
    for (let attempt = 0; attempt < 10 && !fits(); attempt++) {
      scale -= .055;
      dialogue.style.setProperty('--dialogue-fit-scale', Math.max(.58, scale));
      dialogue.classList.add('hp-dialogue-fit-small');
    }
  }

  function renderDialogueLines(lines, animate = true) {
    if (!dialogue) return;
    dialogue.replaceChildren(...(lines || []).map(line => {
      const span = document.createElement('span');
      span.textContent = line;
      return span;
    }));
    fitDialogueToCard();
    requestAnimationFrame(fitDialogueToCard);
    dialogue.classList.remove('hp-dialogue-changing');
    if (animate) {
      void dialogue.offsetWidth;
      dialogue.classList.add('hp-dialogue-changing');
    }
  }

  function showMessage(index, animate = true) {
    messageIndex = Math.max(0, Math.min(messages.length - 1, index));
    renderDialogueLines(messages[messageIndex], animate);
  }

  function talkToCharacter() {
    if (transitioning || !dialogue || !messages.length) return;
    // Successful voice starts determine recency: exclude the last, then use
    // weights 1, 2, 3, 4 as a message ages. Unplayed messages have full weight.
    const weights = messages.map((_, index) => {
      const age = voiceHistory.indexOf(index);
      return index === messageIndex ? 0 : age < 0 ? 4 : Math.min(age, 4);
    });
    let choice = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    const nextIndex = weights.findIndex(weight => {
      choice -= weight;
      return choice < 0;
    });
    showMessage(nextIndex < 0 ? 0 : nextIndex);
    playMessageVoice(true);
    recordMissionStat('characterTalk',1);
  }

  function syncCharacterVoice() {
    if (home.hidden) {
      manualVoicePlays = 0;
      voiceHistory.length = 0;
    }
    homeMotion.setActive(canSpeak());
    if (!canSpeak()) {
      stopCharacterVoice();
    } else if (voiceUnlocked && !initialVoicePlayed) {
      playMessageVoice();
    }
  }

  window.addEventListener('hp-curtain-start', () => {
    voiceUnlocked = true;
    try {
      window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
      [...voiceFiles, voiceSet.rare?.file].filter(Boolean).forEach(file => { void prepareVoice(file).catch(() => {}); });
    } catch (_) {}
  });
  const voiceObserver = new MutationObserver(syncCharacterVoice);
  voiceObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  voiceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  voiceObserver.observe(home, { attributes: true, attributeFilter: ['hidden'] });
  if (characterScreen) voiceObserver.observe(characterScreen, { attributes:true, attributeFilter:['hidden'] });
  if (missionScreen) voiceObserver.observe(missionScreen, { attributes:true, attributeFilter:['hidden'] });
  if (rankingScreen) voiceObserver.observe(rankingScreen, { attributes:true, attributeFilter:['hidden'] });
  if (gachaScreen) voiceObserver.observe(gachaScreen, { attributes:true, attributeFilter:['hidden'] });
  document.addEventListener('visibilitychange', syncCharacterVoice);
  window.addEventListener('pagehide', () => { pageActive = false; manualVoicePlays = 0; voiceHistory.length = 0; stopCharacterVoice(); });
  window.addEventListener('pageshow', () => { pageActive = true; syncCharacterVoice(); });

  const ownedCharacters = () => registry.ownedList
    ? registry.ownedList()
    : registry.list().filter(character => character.available === true);

  function createCharacterCreditNode(entry, { showCharacter = false } = {}) {
    const article = document.createElement('article');
    article.className = 'hp-character-credit-entry';
    if (showCharacter && entry.characterName) {
      const characterName = document.createElement('small');
      characterName.className = 'hp-character-credit-character';
      characterName.textContent = entry.characterName;
      article.appendChild(characterName);
    }
    const label = document.createElement('span');
    label.className = 'hp-character-credit-label';
    label.textContent = entry.label || '協力';
    const name = document.createElement(entry.url && /^https?:\/\//i.test(entry.url) ? 'a' : 'strong');
    name.className = 'hp-character-credit-name';
    name.textContent = entry.name;
    if (name.tagName === 'A') {
      name.href = entry.url;
      name.target = '_blank';
      name.rel = 'noopener noreferrer';
    }
    article.append(label, name);
    if (entry.note) {
      const note = document.createElement('p');
      note.textContent = entry.note;
      article.appendChild(note);
    }
    return article;
  }

  function renderGlobalCharacterCredits() {
    const panel = home.querySelector('[data-home-character-credits]');
    const list = home.querySelector('[data-home-character-credit-list]');
    if (!panel || !list) return;
    const entries = registry.globalCredits?.() || [];
    list.replaceChildren(...entries.map(entry => createCharacterCreditNode(entry, { showCharacter: true })));
    panel.hidden = entries.length === 0;
  }

  function openCharacterSkillPopup(skillName, effect) {
    const existing = document.querySelector('.hp-character-skill-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'hp-character-skill-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'スキル効果');

    const card = document.createElement('div');
    card.className = 'hp-character-skill-modal-card';
    const sparkle = document.createElement('div');
    sparkle.className = 'hp-character-skill-sparkle';
    sparkle.setAttribute('aria-hidden', 'true');
    sparkle.textContent = '✦  ✧  ✦';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'hp-character-skill-modal-eyebrow';
    eyebrow.textContent = 'PIANIST SKILL';
    const title = document.createElement('h3');
    title.textContent = skillName;
    const divider = document.createElement('div');
    divider.className = 'hp-character-skill-modal-divider';
    const effectLabel = document.createElement('span');
    effectLabel.className = 'hp-character-skill-modal-label';
    effectLabel.textContent = 'SKILL EFFECT';
    const body = document.createElement('p');
    body.textContent = effect;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'hp-character-skill-modal-close';
    close.textContent = '閉じる';

    card.append(sparkle, eyebrow, title, divider, effectLabel, body, close);
    modal.appendChild(card);
    document.body.appendChild(modal);

    // This overlay is UI only. It must not be treated as a home/voice state
    // transition; keep the existing HOME BGM/audio graph untouched.
    const dismiss = () => {
      document.removeEventListener('keydown', onKey);
      modal.remove();
    };
    close.addEventListener('click', dismiss);
    modal.addEventListener('click', event => {
      if (event.target === modal) dismiss();
    });
    function onKey(event) {
      if (event.key === 'Escape') dismiss();
    }
    document.addEventListener('keydown', onKey);
    // Avoid programmatic focus here. On iOS/PWA this can briefly disturb the
    // shared audio session while the character screen is already active.
    requestAnimationFrame(() => card.classList.add('is-open'));
  }

  function renderCharacterCredits(character) {
    const panel = home.querySelector('[data-character-credits]');
    const list = home.querySelector('[data-character-credit-list]');
    if (!panel || !list) return;
    const entries = (registry.creditsFor?.(character) || []).filter(entry => entry.detail !== false);
    list.replaceChildren(...entries.map(entry => createCharacterCreditNode(entry)));
    panel.hidden = entries.length === 0;
  }

  const characterLayout = home.querySelector('.hp-character-layout');
  const characterListScreen = home.querySelector('[data-character-screen="list"]');
  const characterDetailScreen = home.querySelector('[data-character-screen="detail"]');

  function syncCharacterSelection() {
    const current = characterSettings.getHomeCharacterId();
    const selected = registry.get(previewCharacterId);
    const button = home.querySelector('[data-home-action="set-home-character"]');
    button.textContent = current === previewCharacterId ? 'ホームに設定中' : 'ホームに設定';
    button.setAttribute('aria-pressed', String(current === previewCharacterId));
    button.disabled = registry.isOwned ? !registry.isOwned(selected) : !selected?.available;
    home.querySelectorAll('[data-character-choice]').forEach(card => {
      card.setAttribute('aria-pressed', String(card.dataset.characterChoice === previewCharacterId));
      card.querySelector('[data-character-home-badge]').hidden = card.dataset.characterChoice !== current;
    });
  }
  function showCharacterList({ focus = false } = {}) {
    characterLayout.dataset.characterView = 'list';
    characterListScreen.hidden = false;
    characterDetailScreen.hidden = true;
    previewMotion.setActive(false);
    setCharacterHeaderActionsVisible(false);
    if (focus) home.querySelector('[data-character-choice]')?.focus({ preventScroll:true });
  }
  let detailVoiceSource = null;
  let detailVoiceGeneration = 0;
  function stopDetailVoice() {
    detailVoiceGeneration++;
    if (!detailVoiceSource) return;
    const source = detailVoiceSource;
    detailVoiceSource = null;
    source.onended = null;
    try { source.stop(); } catch (_) {}
    try { source.disconnect(); } catch (_) {}
  }
  function renderCharacterVoiceList(character) {
    const list = home.querySelector('[data-character-voice-list]');
    if (!list) return;
    stopDetailVoice();
    const set = registry.voiceSet(character);
    const entries = (set?.entries || []).filter(entry => entry?.file);
    list.replaceChildren(...entries.map((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'hp-character-voice-item';
      const number = document.createElement('b'); number.textContent = String(index + 1).padStart(2, '0');
      const copy = document.createElement('span');
      const voiceRewardId = character.id + ':' + entry.file;
      const gachaOwned = gachaInventory.voices.includes(voiceRewardId);
      copy.textContent = (gachaOwned ? '★ 獲得済み｜' : '') + (entry.lines || []).join(' ');
      if (gachaOwned) button.classList.add('is-gacha-owned');
      const play = document.createElement('i'); play.textContent = '▶ 再生';
      button.append(number, copy, play);
      button.addEventListener('click', async () => {
        stopDetailVoice();
        const generation = detailVoiceGeneration;
        try {
          window.HP_AUDIO_BRIDGE?.configureSession?.();
          window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
          const buffer = await prepareVoice(entry.file, set);
          if (generation !== detailVoiceGeneration) return;
          const graph = ensureVoiceGraph(); if (!graph) return;
          const source = graph.context.createBufferSource(); source.buffer = buffer; source.connect(graph.gain);
          source.onended = () => {
            try { source.disconnect(); } catch (_) {}
            if (detailVoiceSource === source) detailVoiceSource = null;
          };
          detailVoiceSource = source;
          source.start();
        } catch (_) {}
      });
      return button;
    }));
  }
  function setCharacterDetailTab(tab) {
    const voice = tab === 'voices';
    home.querySelectorAll('[data-character-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.characterTab === tab)));
    home.querySelector('[data-character-panel="profile"]').hidden = voice;
    home.querySelector('[data-character-panel="voices"]').hidden = !voice;
    if (!voice) stopDetailVoice();
    const info = home.querySelector('.hp-character-info');
    if (info) info.scrollTop = 0;
  }
  home.querySelectorAll('[data-character-tab]').forEach(button => button.addEventListener('click', () => {
    setCharacterDetailTab(button.dataset.characterTab);
  }));

  function showCharacterDetail(id) {
    const selected = registry.get(id);
    const owned = registry.isOwned ? registry.isOwned(selected) : selected?.available === true;
    if (!selected || !owned) return;
    previewCharacterId = id;
    // Escalate the selected profile artwork immediately on tap. The detail view
    // can render without waiting, while the retained preload prevents a second
    // CSS-background fetch/decode and removes the intermittent blank frame.
    void preloadCharacterArt(selected, 'high');
    home.querySelector('[data-character-name]').textContent = selected.name;
    home.querySelector('[data-character-reading]').textContent = selected.reading ? '（' + selected.reading + '）' : '';
    home.querySelector('[data-character-description]').textContent = selected.description || '';
    const profile = selected.profile || {};
    const profileList = home.querySelector('[data-character-profile-list]');
    const profileFields = registry.profileFields?.() || [];
    if (profileList) {
      profileList.replaceChildren(...profileFields.map(field => {
        const row = document.createElement('div');
        row.className = 'hp-character-profile-row' + (field.wide ? ' is-wide' : '');
        const label = document.createElement('dt');
        label.textContent = field.label;
        const value = document.createElement('dd');
        const profileValue = profile[field.key] || (field.key === 'style' ? selected.description : '');
        value.textContent = profileValue || (field.required ? '未設定' : '—');
        if (field.required && !profileValue) row.dataset.profileMissing = 'true';
        if (field.key === 'skill' && profileValue) {
          row.classList.add('is-skill');
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          row.setAttribute('aria-label', 'スキル「' + profileValue + '」の効果を見る');
          const hint = document.createElement('span');
          hint.className = 'hp-character-skill-hint';
          hint.textContent = '効果を見る';
          value.append(hint);
          const openSkill = () => {
            const effect = profile.skillEffect || 'スキル効果は準備中です。';
            openCharacterSkillPopup(profileValue, effect);
          };
          row.addEventListener('click', openSkill);
          row.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openSkill();
            }
          });
        }
        row.append(label, value);
        return row;
      }));
    }
    renderCharacterCredits(selected);
    const characterPreview = home.querySelector('[data-character-preview]');
    if (characterPreview) {
      if (selected.profileBackground) {
        characterPreview.style.setProperty('--character-profile-bg', 'url("' + selected.profileBackground.replace(/"/g, '%22') + '")');
        characterPreview.dataset.hasProfileBackground = 'true';
      } else {
        characterPreview.style.removeProperty('--character-profile-bg');
        delete characterPreview.dataset.hasProfileBackground;
      }
    }
    home.querySelector('[data-character-status]').textContent = '';
    renderCharacterVoiceList(selected);
    setCharacterDetailTab('profile');
    characterLayout.dataset.characterView = 'detail';
    characterListScreen.hidden = true;
    characterDetailScreen.hidden = false;
    const characterInfo = home.querySelector('.hp-character-info');
    if (characterInfo) {
      characterInfo.scrollTop = 0;
      requestAnimationFrame(() => { characterInfo.scrollTop = 0; });
    }
    setCharacterHeaderActionsVisible(true);
    void previewMotion.setCharacter(selected);
    previewMotion.setActive(true);
    syncCharacterSelection();
    home.querySelector('[data-home-action="character-list-back"]')?.focus({ preventScroll:true });
  }
  // Keep decoded character artwork strongly referenced. iOS Safari can evict an
  // image that was only warmed by a temporary Image object, which made profile
  // CSS backgrounds occasionally appear late or not at all.
  const characterArtPreloads = new Map();
  const characterArtImages = new Map();
  function preloadCharacterArt(character, priority = 'auto') {
    if (!character) return Promise.resolve([]);
    const urls = [character.profileBackground, character.listImage, character.previewImage].filter(Boolean);
    return Promise.all(urls.map(url => {
      if (characterArtPreloads.has(url)) {
        const image = characterArtImages.get(url);
        if (image && priority === 'high') {
          try { image.fetchPriority = 'high'; } catch (_) {}
        }
        return characterArtPreloads.get(url);
      }
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      try { image.fetchPriority = priority; } catch (_) {}
      characterArtImages.set(url, image);
      const task = new Promise(resolve => {
        const finish = () => resolve(image);
        image.onload = () => {
          const decoded = image.decode ? image.decode().catch(() => {}) : Promise.resolve();
          decoded.finally(finish);
        };
        image.onerror = finish;
        image.src = url;
      });
      characterArtPreloads.set(url, task);
      return task;
    }));
  }
  function preloadOwnedCharacterAssets() {
    ownedCharacters().forEach(character => {
      void preloadCharacterArt(character);
      void window.HP_MOTION_CHARACTER?.preload?.(character).catch(() => {});
    });
  }

  function renderCharacterScreen() {
    const list = home.querySelector('[data-character-list]');
    const characters = ownedCharacters();
    characters.forEach(character => { void preloadCharacterArt(character); void window.HP_MOTION_CHARACTER?.preload?.(character).catch(() => {}); });
    home.querySelector('[data-character-owned-count]').textContent = characters.length + '人';
    home.querySelector('[data-character-empty]').hidden = characters.length !== 0;
    list.hidden = characters.length === 0;
    list.replaceChildren(...characters.map(character => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'hp-character-choice';
      button.dataset.characterChoice = character.id; button.setAttribute('aria-label', character.name + 'の詳細を見る');
      const image = document.createElement('img'); image.src = character.listImage || character.previewImage; image.alt = ''; image.loading = 'eager'; image.decoding = 'async';
      const copy = document.createElement('span'); copy.className = 'hp-character-choice-copy';
      const name = document.createElement('strong'); name.textContent = character.name;
      const description = document.createElement('span'); description.textContent = character.description || '';
      copy.append(name, description);
      const badge = document.createElement('small'); badge.dataset.characterHomeBadge = ''; badge.textContent = 'ホームに設定中';
      button.append(image, copy, badge);
      button.addEventListener('click', () => { showCharacterDetail(character.id); });
      return button;
    }));
    const fallback = characters.some(character => character.id === previewCharacterId)
      ? previewCharacterId
      : characters.find(character => character.id === homeCharacter.id)?.id || characters[0]?.id;
    if (fallback) previewCharacterId = fallback;
    showCharacterList();
    syncCharacterSelection();
  }
  home.querySelector('[data-home-action="character-list-back"]').addEventListener('click', () => {
    showCharacterList({ focus: true });
  });
  const setHomeCharacterButton = home.querySelector('[data-home-action="set-home-character"]');
  let setHomeCharacterLocked = false;
  setHomeCharacterButton.addEventListener('click', () => {
    if (setHomeCharacterLocked) return;
    if (characterSettings.getHomeCharacterId() === previewCharacterId) {
      home.querySelector('[data-character-status]').textContent = 'ホームに設定中です。';
      return;
    }
    setHomeCharacterLocked = true;
    const result = characterSettings.setHomeCharacter(previewCharacterId);
    home.querySelector('[data-character-status]').textContent = result.ok ? 'ホームキャラクターを設定しました。' : result.reason;
    syncCharacterSelection();
    setTimeout(() => { setHomeCharacterLocked = false; }, 350);
  });
  characterSettings.subscribe(character => {
    stopCharacterVoice();
    homeCharacter = character; voiceSet = registry.voiceSet(character);
    messages = voiceSet.entries.map(entry => entry.lines); voiceFiles = voiceSet.entries.map(entry => entry.file);
    manualVoicePlays = 0; voiceHistory.length = 0; initialVoicePlayed = false;
    void homeMotion.setCharacter(character);
    showMessage(0, false); syncCharacterSelection(); syncCharacterVoice();
  });
  showMessage(0, false);
  syncCharacterVoice();
  // Warm every owned character's list art, profile background and Motion layers
  // while the home screen is idle, so opening the selector/detail is instant.
  const scheduleCharacterPreload = () => {
    void prioritizeHomeBackground().finally(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(preloadOwnedCharacterAssets, { timeout: 900 });
      else setTimeout(preloadOwnedCharacterAssets, 180);
    });
  };
  scheduleCharacterPreload();
  window.addEventListener('hp-curtain-start', scheduleCharacterPreload, { once: true });

  function clearGamePreview() {
    window.clearTimeout(gamePreviewTimer);
    home.classList.remove('hp-game-previewing');
  }
  function previewGame() {
    if (transitioning || !gameButton) return;
    clearGamePreview();
    syncModeFxCenter(gameButton);
    void home.offsetWidth;
    home.classList.add('hp-game-previewing');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    gamePreviewTimer = window.setTimeout(clearGamePreview, reduced ? 140 : 800);
  }

  // Measure the actual safe area, including the viewport's portrait rotation.
  // Only component dimensions use this unit; the canvas itself is never scaled.
  const safeArea = home.querySelector('.hp-home-safe');
  function syncHomeLayout() {
    if (!safeArea || home.hidden) return;
    const width = safeArea.clientWidth;
    const height = safeArea.clientHeight;
    if (!width || !height) return;
    const unit = Math.min(width / 1536, height / 864, 1.25);
    const widthUnit = Math.min(home.clientWidth / 1536, 1.25);
    home.style.setProperty('--home-unit', unit + 'px');
    home.style.setProperty('--home-width-unit', widthUnit + 'px');
    // Right-side controls anchor to the screen, not to iOS's symmetric inset.
    home.style.setProperty('--home-safe-right', Math.max(0, home.clientWidth - safeArea.offsetLeft - width) + 'px');
    home.dataset.homeCompact = String(width < 740);
    const footer = home.querySelector('.hp-home-footer');
    const topActions = home.querySelector('.hp-home-top-actions');
    if (footer && topActions) {
      const safeBottom = Math.max(0, parseFloat(getComputedStyle(safeArea).bottom) || 0);
      home.style.setProperty('--home-footer-bottom', Math.max(3, 27 * widthUnit - safeBottom) + 'px');
      const gap = Math.max(2, 2 * widthUnit);
      const footerGap = Math.max(4, 8 * widthUnit);
      const footerTop = footer.offsetTop + home.querySelector('.hp-home-bottom').offsetTop;
      const desiredWidth = Math.min(home.clientWidth * .355, 511 * widthUnit);
      // Both buttons share the same 511:236 canvas and scale together.
      const stackRatio = 472 / 511;
      const earliestTop = topActions.offsetTop + topActions.offsetHeight + Math.max(3, 4 * widthUnit);
      const preferredTop = height * (170 / 864);
      const top = Math.max(earliestTop, Math.min(preferredTop, footerTop - footerGap - gap - desiredWidth * stackRatio));
      const available = Math.max(0, footerTop - footerGap - gap - top);
      const modeWidth = Math.min(desiredWidth, available / stackRatio);
      home.style.setProperty('--home-mode-top', top + 'px');
      home.style.setProperty('--home-mode-gap', gap + 'px');
      home.style.setProperty('--home-mode-width', modeWidth + 'px');
      home.style.setProperty('--home-mode-unit', modeWidth / 511 + 'px');
    }
    syncModeFxCenter();
    fitDialogueToCard();
    fitHomePlayerName();
  }
  if (safeArea && 'ResizeObserver' in window) {
    new ResizeObserver(syncHomeLayout).observe(safeArea);
  }

  function syncModeFxCenter(button = home.classList.contains('hp-game-previewing') ? gameButton : pianoButton) {
    if (home.hidden) return;
    // Use layout coordinates so portrait's rotated viewport does not move the
    // sparkle origin away from the tapped button.
    let x = button.offsetWidth / 2;
    let y = button.offsetHeight / 2;
    let node = button;
    while (node && node !== home) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    if (node !== home) return;
    home.style.setProperty('--hp-mode-center-x', x + 'px');
    home.style.setProperty('--hp-mode-center-y', y + 'px');
  }

  function finishTransition() {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('hp-viewport-resize'));
      window.dispatchEvent(new Event('resize'));
      transitioning = false;
    });
  }

  const pianoArtworkUrls = ['palace-hall-v4.jpg','rack-v4.webp','white-key-v4.webp','black-key-v4.webp','footer-v4.webp'];
  let pianoArtworkTask = null;
  // Retain the decoded images, rather than letting hidden CSS backgrounds begin
  // downloading only when the player first enters the piano screen.
  let pianoArtwork = [];
  function preparePianoArtwork() {
    if (pianoArtwork.length === pianoArtworkUrls.length) return Promise.resolve();
    if (pianoArtworkTask) return pianoArtworkTask;
    pianoArtworkTask = Promise.all(pianoArtworkUrls.map(file => new Promise((resolve,reject) => {
      const image = new Image();
      const timeout = setTimeout(() => { image.src = ''; reject(new Error('Piano artwork timed out')); },20000);
      const fail = error => { clearTimeout(timeout); reject(error); };
      image.onerror = fail;
      image.onload = () => {
        const decoded = image.decode ? image.decode() : Promise.resolve();
        decoded.then(() => { clearTimeout(timeout); resolve(image); },fail);
      };
      image.src = '/assets/piano/' + file;
    }))).then(images => { pianoArtwork = images; }).finally(() => { pianoArtworkTask = null; });
    return pianoArtworkTask;
  }
  void preparePianoArtwork().catch(() => {});
  const transitionMessage = document.createElement('p');
  transitionMessage.className = 'hp-home-transition-message';
  transitionMessage.setAttribute('role','status'); transitionMessage.hidden = true;
  home.appendChild(transitionMessage);
  const pianoLoading = document.createElement('div');
  pianoLoading.className = 'hp-home-piano-loading'; pianoLoading.hidden = true;
  pianoLoading.setAttribute('role','status'); pianoLoading.setAttribute('aria-live','polite');
  const loadingKeys = document.createElement('span'); loadingKeys.className = 'hp-loading-keys'; loadingKeys.setAttribute('aria-hidden','true');
  for (let index=0; index<3; index++) loadingKeys.appendChild(document.createElement('i'));
  const loadingText = document.createElement('p'); loadingText.textContent = 'ピアノを準備しています';
  pianoLoading.append(loadingKeys,loadingText); home.appendChild(pianoLoading);
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

  async function showPiano() {
    pianoLoading.hidden = pianoArtwork.length === pianoArtworkUrls.length;
    try { await preparePianoArtwork(); }
    catch (_) {
      pianoLoading.hidden = true;
      canvas.inert = false;
      home.classList.remove('hp-piano-launching');
      transitioning = false;
      transitionMessage.textContent = '画像を読み込めませんでした。もう一度ピアノモードをタップしてください。';
      transitionMessage.hidden = false;
      return;
    }
    piano.classList.add('hp-piano-preparing');
    piano.inert = true;
    piano.setAttribute('aria-hidden','true');
    piano.hidden = false;
    window.dispatchEvent(new Event('hp-viewport-resize'));
    window.dispatchEvent(new Event('hp-piano-prepare'));
    // Allow container layout and the browser's image paint resources to settle
    // under HOME. No frame may expose untextured whites or missing black keys.
    await nextFrame();
    window.dispatchEvent(new Event('hp-piano-prepare'));
    await nextFrame();
    piano.classList.remove('hp-piano-preparing');
    piano.inert = false;
    piano.removeAttribute('aria-hidden');
    pianoLoading.hidden = true;
    canvas.inert = false;
    home.classList.remove('hp-piano-launching');
    home.hidden = true;
    recordMissionStat('pianoEnter',1);
    document.body.classList.add('hp-piano-active');
    finishTransition();
  }

  function enterPiano() {
    if (transitioning) return;
    transitioning = true;
    canvas.inert = true;
    transitionMessage.hidden = true;
    void preparePianoArtwork().catch(() => {});
    stopCharacterVoice();
    clearGamePreview();

    try {
      window.HP_AUDIO_BRIDGE?.configureSession?.();
      const resume = window.HP_AUDIO_BRIDGE?.resume?.();
      if (resume && typeof resume.catch === 'function') resume.catch(() => {});
    } catch (_) {}

    home.classList.remove('hp-piano-launching');
    syncModeFxCenter();
    void home.offsetWidth;
    home.classList.add('hp-piano-launching');

    window.clearTimeout(launchTimer);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    launchTimer = window.setTimeout(showPiano, reduced ? 140 : 800);
  }

  function enterHome() {
    if (transitioning) return;
    transitioning = true;

    window.clearTimeout(launchTimer);
    clearGamePreview();
    home.classList.remove('hp-piano-launching');

    try {
      const activeRecord = piano.querySelector('[data-action="record"][aria-pressed="true"]');
      if (activeRecord && !activeRecord.disabled) activeRecord.click();

      const stopSound = piano.querySelector('[data-action="stop-sound"]');
      if (stopSound && !stopSound.disabled) stopSound.click();

      const settings = piano.querySelector('.hp-settings-overlay');
      const closeSettings = piano.querySelector('[data-action="settings-close"]');
      if (settings && !settings.hidden && closeSettings) closeSettings.click();
    } catch (_) {}

    piano.hidden = true;
    home.hidden = false;
    window.dispatchEvent(new Event('hp-home-enter'));
    document.body.classList.remove('hp-piano-active');
    showMessage(voiceSet.greetingIndex ?? 0, false);
    playMessageVoice();
    requestAnimationFrame(syncHomeLayout);
    finishTransition();
  }

  const onViewportChange = () => {
    syncHomeLayout();
  };

  window.addEventListener('resize', onViewportChange, { passive:true });
  window.addEventListener('hp-viewport-resize', onViewportChange, { passive:true });
  window.addEventListener('orientationchange', () => {
    window.setTimeout(onViewportChange, 60);
    window.setTimeout(onViewportChange, 250);
  }, { passive:true });
  window.visualViewport?.addEventListener('resize', onViewportChange, { passive:true });

  syncHomeLayout();
  requestAnimationFrame(syncHomeLayout);

  gameButton?.addEventListener('click', previewGame);
  characterButton?.addEventListener('click', talkToCharacter);
  home.querySelector('[data-home-action="voice-replay"]')?.addEventListener('click', () => playMessageVoice(true));
  pianoButton.addEventListener('click', enterPiano);
  homeButton.addEventListener('click', enterHome);
})();
