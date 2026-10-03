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
    try {
      if (!homeTapBuffer) { void prepareHomeTapSound(); return; }
      window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
      stopHomeTapSound();
      const { context } = homeTapGraph;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = homeTapBuffer;
      source.connect(gain); gain.connect(homeTapGraph.gain);
      const current = { source, gain };
      homeTapCurrent = current;
      source.onended = () => {
        source.disconnect(); gain.disconnect();
        if (homeTapCurrent === current) homeTapCurrent = null;
      };
      // Start in the gesture itself: no asynchronous play/seek queue on rapid taps.
      source.start();
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
    // The two voice actions remain silent so their speech is unobstructed.
    const voiceAction = ['character-talk', 'voice-replay'].includes(button.dataset.homeAction);
    if (!voiceAction) button.addEventListener('pointerdown', event => {
      if (event.button === 0) playHomeTapSound();
    }, { passive:true });
    button.addEventListener('click', (event) => {
      if (event.detail === 0) {
        if (!voiceAction) playHomeTapSound();
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

  const dialogOverlay = home.querySelector('.hp-home-dialog-overlay');
  const canvas = home.querySelector('[data-home-canvas]');
  const homeVolume = home.querySelector('[data-home-volume]');
  const pianoVolume = piano.querySelector('[data-control="volume"]');
  let dialogOpener = null;
  const syncHomeVolume = () => {
    homeVolume.value = pianoVolume.value;
    home.querySelector('[data-home-volume-output]').textContent = pianoVolume.value + '%';
  };
  function closeHomeDialog() {
    if (dialogOverlay.hidden) return;
    dialogOverlay.hidden = true;
    canvas.inert = false;
    dialogOpener?.focus({ preventScroll:true });
    dialogOpener = null;
    previewMotion.setActive(false);
    syncCharacterVoice();
  }
  for (const action of ['notice', 'settings', 'characters']) {
    const button = home.querySelector('[data-home-action="' + action + '"]');
    button.addEventListener('click', () => {
      dialogOpener = button;
      home.querySelector('#hp-home-dialog-title').textContent = { notice: 'お知らせ', settings: '設定', characters: 'キャラクター' }[action];
      home.querySelector('[data-home-dialog-kicker]').textContent = { notice: 'INFORMATION', settings: 'SOUND SETTINGS', characters: 'CHARACTERS' }[action];
      home.querySelector('[data-home-notices]').hidden = action !== 'notice';
      home.querySelector('[data-home-settings]').hidden = action !== 'settings';
      home.querySelector('[data-home-characters]').hidden = action !== 'characters';
      dialogOverlay.dataset.screen = action;
      if (action === 'characters') renderCharacterScreen();
      if (action === 'settings') renderGlobalCharacterCredits();
      syncHomeVolume();
      canvas.inert = true;
      dialogOverlay.hidden = false;
      syncCharacterVoice();
      previewMotion.setActive(action === 'characters' && home.querySelector('[data-character-screen="detail"]')?.hidden === false);
      dialogOverlay.querySelector('.hp-home-dialog-button').focus({ preventScroll:true });
    });
  }
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
      && dialogOverlay.hidden && !home.classList.contains('hp-piano-launching');
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
    const url = entry.audioPath || set.audioBasePath + '/' + file + '.wav?v=1';
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
        voiceHistory.unshift(isRare ? rare.messageIndex : normalIndex);
        voiceHistory.length = Math.min(voiceHistory.length, messages.length);
        if (isRare) showMessage(rare.messageIndex);
        voiceState(true, { characterId: selectedCharacter.id, buffer, context: graph.context, startedAt,
          reading: entry.reading, message: messages[messageIndex]?.join('') });
      }).catch(() => {});
    } catch (_) {}
  }

  function showMessage(index, animate = true) {
    messageIndex = Math.max(0, Math.min(messages.length - 1, index));
    if (!dialogue) return;
    dialogue.replaceChildren(...(messages[messageIndex] || []).map(line => {
      const span = document.createElement('span');
      span.textContent = line;
      return span;
    }));
    dialogue.classList.remove('hp-dialogue-changing');
    if (animate) {
      void dialogue.offsetWidth;
      dialogue.classList.add('hp-dialogue-changing');
    }
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
    if (focus) home.querySelector('[data-character-choice]')?.focus({ preventScroll:true });
  }
  function showCharacterDetail(id) {
    const selected = registry.get(id);
    const owned = registry.isOwned ? registry.isOwned(selected) : selected?.available === true;
    if (!selected || !owned) return;
    previewCharacterId = id;
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
    characterLayout.dataset.characterView = 'detail';
    characterListScreen.hidden = true;
    characterDetailScreen.hidden = false;
    void previewMotion.setCharacter(selected);
    previewMotion.setActive(true);
    syncCharacterSelection();
    home.querySelector('[data-home-action="character-list-back"]')?.focus({ preventScroll:true });
  }
  function renderCharacterScreen() {
    const list = home.querySelector('[data-character-list]');
    const characters = ownedCharacters();
    home.querySelector('[data-character-owned-count]').textContent = characters.length + '人';
    home.querySelector('[data-character-empty]').hidden = characters.length !== 0;
    list.hidden = characters.length === 0;
    list.replaceChildren(...characters.map(character => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'hp-character-choice';
      button.dataset.characterChoice = character.id; button.setAttribute('aria-label', character.name + 'の詳細を見る');
      const image = document.createElement('img'); image.src = character.listImage || character.previewImage; image.alt = ''; image.loading = 'lazy';
      const copy = document.createElement('span'); copy.className = 'hp-character-choice-copy';
      const name = document.createElement('strong'); name.textContent = character.name;
      const description = document.createElement('span'); description.textContent = character.description || '';
      copy.append(name, description);
      const badge = document.createElement('small'); badge.dataset.characterHomeBadge = ''; badge.textContent = 'ホームに設定中';
      button.append(image, copy, badge);
      button.addEventListener('pointerdown', event => { if (event.button === 0) playHomeTapSound(); }, { passive: true });
      button.addEventListener('click', event => { if (event.detail === 0) playHomeTapSound(); showCharacterDetail(character.id); });
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
    playHomeTapSound();
    showCharacterList({ focus: true });
  });
  home.querySelector('[data-home-action="set-home-character"]').addEventListener('click', () => {
    const result = characterSettings.setHomeCharacter(previewCharacterId);
    home.querySelector('[data-character-status]').textContent = result.ok ? 'ホームキャラクターを設定しました。' : result.reason;
    syncCharacterSelection();
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
