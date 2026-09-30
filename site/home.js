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

  home.querySelectorAll('button').forEach((button) => {
    button.addEventListener('pointerdown', playHomeTapSound, { passive:true });
    button.addEventListener('click', (event) => {
      if (event.detail === 0) playHomeTapSound();
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

  const particleAngles = [-172,-151,-132,-111,-88,-66,-42,-19,7,29,52,74,99,123,146,166];
  particleAngles.forEach((angle, index) => {
    const particle = document.createElement('span');
    particle.className = 'hp-home-launch-particle';
    particle.style.setProperty('--angle', angle + 'deg');
    particle.style.setProperty('--distance', (46 + (index % 5) * 13) + 'px');
    particle.style.setProperty('--delay', ((index % 4) * 0.018) + 's');
    launchFx.appendChild(particle);
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
  let messageIndex = 0;
  function talkToCharacter() {
    if (transitioning || !dialogue) return;
    messageIndex = (messageIndex + 1) % messages.length;
    dialogue.replaceChildren(...messages[messageIndex].map(line => {
      const span = document.createElement('span');
      span.textContent = line;
      return span;
    }));
    dialogue.classList.remove('hp-dialogue-changing');
    void dialogue.offsetWidth;
    dialogue.classList.add('hp-dialogue-changing');
  }

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
      // Native sprite heights are 235 and 236 for a shared width of 511.
      const stackRatio = 471 / 511;
      const earliestTop = topActions.offsetTop + topActions.offsetHeight + Math.max(3, 4 * widthUnit);
      const preferredTop = height * (170 / 864);
      const top = Math.max(earliestTop, Math.min(preferredTop, footerTop - footerGap - gap - desiredWidth * stackRatio));
      const available = Math.max(0, footerTop - footerGap - gap - top);
      const modeWidth = Math.min(desiredWidth, available / stackRatio);
      home.style.setProperty('--home-mode-top', top + 'px');
      home.style.setProperty('--home-mode-gap', gap + 'px');
      home.style.setProperty('--home-mode-width', modeWidth + 'px');
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
  pianoButton.addEventListener('click', enterPiano);
  homeButton.addEventListener('click', enterHome);
})();
