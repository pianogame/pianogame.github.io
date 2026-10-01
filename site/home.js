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

  const homeTapAudio = new Audio('/audio/home-button-tap.mp3?v=1');
  homeTapAudio.preload = 'auto';
  homeTapAudio.load();

  function playHomeTapSound() {
    try {
      homeTapAudio.pause();
      homeTapAudio.currentTime = 0;
      const playback = homeTapAudio.play();
      if (playback && typeof playback.catch === 'function') playback.catch(() => {});
    } catch (_) {}
  }

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
    if (!voiceAction) button.addEventListener('pointerdown', playHomeTapSound, { passive:true });
    button.addEventListener('click', (event) => {
      if (event.detail === 0) {
        if (!voiceAction) playHomeTapSound();
        const bounds = button.getBoundingClientRect();
        showTouchEffect(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      }
    });
  });
  const menuTimers = new WeakMap();
  home.querySelectorAll('.hp-home-bottom-button').forEach(button => {
    button.addEventListener('pointerdown', () => button.classList.add('hp-home-is-pressed'), { passive:true });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(name => {
      button.addEventListener(name, () => button.classList.remove('hp-home-is-pressed'));
    });
    button.addEventListener('click', () => {
      clearTimeout(menuTimers.get(button));
      button.classList.remove('hp-home-confirmed');
      void button.offsetWidth;
      button.classList.add('hp-home-confirmed');
      menuTimers.set(button, setTimeout(() => button.classList.remove('hp-home-confirmed'), 560));
    });
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
  const messages = [
    ['こんなに美しい音楽と', 'すごせる毎日…', '……ふふっ♪'],
    ['おかえりなさい。', '今日はどんな曲を', '一緒に奏でようか？'],
    ['あなたの音を聴くと、', '自然と笑顔になるの。', '……不思議だね♪'],
    ['少し疲れちゃった？', 'ゆっくりで大丈夫。', '私もそばにいるよ。'],
    ['次の一音に、', '気持ちをこめて。', '一緒に奏でよう♪'],
  ];
  const voiceFiles = ['konnani', 'okaeri', 'anatano', 'sukositukare', 'tuginoition'];
  const rareVoiceChance = .05;
  let messageIndex = 0;
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
      && !home.classList.contains('hp-piano-launching');
  }

  function ensureVoiceGraph() {
    if (voiceGraph) return voiceGraph;
    const bridge = window.HP_AUDIO_BRIDGE?.get?.();
    if (!bridge) return null;
    const gain = bridge.context.createGain();
    gain.gain.value = 1;
    gain.connect(bridge.output);
    voiceGraph = { context: bridge.context, gain };
    return voiceGraph;
  }

  function prepareVoice(file) {
    if (!voiceBuffers.has(file)) {
      const graph = ensureVoiceGraph();
      if (!graph) return Promise.reject(new Error('Audio unavailable'));
      const task = fetch('/audio/' + file + '.wav?v=1')
        .then(response => {
          if (!response.ok) throw new Error('Voice download failed');
          return response.arrayBuffer();
        })
        .then(data => graph.context.decodeAudioData(data))
        .catch(error => { voiceBuffers.delete(file); throw error; });
      voiceBuffers.set(file, task);
    }
    return voiceBuffers.get(file);
  }

  function voiceState(playing) {
    home.dataset.voicePlaying = String(playing);
    window.dispatchEvent(new CustomEvent('hp-home-voice-state', {
      detail: { playing, file: home.dataset.voiceFile },
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

  function playMessageVoice(allowRare = false) {
    if (!canSpeak()) return;
    voiceUnlocked = true;
    initialVoicePlayed = true;
    stopCharacterVoice();
    const generation = voiceGeneration;
    const normal = voiceFiles[messageIndex];
    const file = allowRare && normal === 'anatano' && Math.random() < rareVoiceChance
      ? 'anatanorare' : normal;
    try {
      window.HP_AUDIO_BRIDGE?.configureSession?.();
      window.HP_AUDIO_BRIDGE?.resume?.()?.catch(() => {});
      const graph = ensureVoiceGraph();
      if (!graph) return;
      void prepareVoice(file).then(buffer => {
        // A late download must never speak an older message or play in PIANO.
        if (generation !== voiceGeneration || !canSpeak()) return;
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
        source.start();
        voiceState(true);
      }).catch(() => {});
    } catch (_) {}
  }

  function showMessage(index, animate = true) {
    messageIndex = index;
    if (!dialogue) return;
    dialogue.replaceChildren(...messages[messageIndex].map(line => {
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
    if (transitioning || !dialogue) return;
    showMessage((messageIndex + 1) % messages.length);
    playMessageVoice(true);
  }

  function syncCharacterVoice() {
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
      [...voiceFiles, 'anatanorare'].forEach(file => { void prepareVoice(file).catch(() => {}); });
    } catch (_) {}
  });
  const voiceObserver = new MutationObserver(syncCharacterVoice);
  voiceObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  voiceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  voiceObserver.observe(home, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', syncCharacterVoice);
  window.addEventListener('pagehide', () => { pageActive = false; stopCharacterVoice(); });
  window.addEventListener('pageshow', () => { pageActive = true; syncCharacterVoice(); });

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

  function showPiano() {
    home.classList.remove('hp-piano-launching');
    home.hidden = true;
    piano.hidden = false;
    document.body.classList.add('hp-piano-active');
    finishTransition();
  }

  function enterPiano() {
    if (transitioning) return;
    transitioning = true;
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
    showMessage(1, false);
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
