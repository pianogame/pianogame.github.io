(() => {
  'use strict';

  const home = document.getElementById('hp-home-screen');
  const piano = document.getElementById('hp-four88');
  if (!home || !piano) return;

  const safeFrame = home.querySelector('.hp-home-safe');
  const homeCanvas = home.querySelector('[data-home-canvas]');
  const pianoButton = home.querySelector('[data-home-action="piano"]');
  const homeButton = piano.querySelector('[data-home-action="home"]');
  if (!safeFrame || !homeCanvas || !pianoButton || !homeButton) return;

  const HOME_BASE_WIDTH = 1536;
  const HOME_BASE_HEIGHT = 864;

  function layoutHomeCanvas() {
    if (home.hidden) return;
    const rect = safeFrame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // Native-game style reference canvas:
    // preserve the 1536-wide design size, then use top/bottom/left/right anchors
    // instead of shrinking the whole 16:9 UI into a letterboxed rectangle.
    // A 680px logical-height floor prevents overlap on unusually wide devices.
    const widthScale = rect.width / HOME_BASE_WIDTH;
    const minimumLogicalHeight = 680;
    const scale = Math.min(widthScale, rect.height / minimumLogicalHeight);
    const logicalHeight = rect.height / scale;

    if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(logicalHeight)) return;
    homeCanvas.style.setProperty('--hp-home-scale', scale.toFixed(6));
    homeCanvas.style.setProperty('--hp-home-logical-height', logicalHeight.toFixed(3) + 'px');
    home.classList.add('hp-home-layout-ready');
    requestAnimationFrame(syncPianoFxCenter);
  }

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

  function syncPianoFxCenter() {
    if (home.hidden) return;
    const homeRect = home.getBoundingClientRect();
    const rect = pianoButton.getBoundingClientRect();
    if (!homeRect.width || !homeRect.height || !rect.width || !rect.height) return;
    home.style.setProperty('--hp-piano-center-x', (rect.left - homeRect.left + rect.width / 2) + 'px');
    home.style.setProperty('--hp-piano-center-y', (rect.top - homeRect.top + rect.height / 2) + 'px');
  }

  function finishTransition() {
    requestAnimationFrame(() => {
      if (!home.hidden) layoutHomeCanvas();
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

    try {
      window.HP_AUDIO_BRIDGE?.configureSession?.();
      const resume = window.HP_AUDIO_BRIDGE?.resume?.();
      if (resume && typeof resume.catch === 'function') resume.catch(() => {});
    } catch (_) {}

    home.classList.remove('hp-piano-launching');
    syncPianoFxCenter();
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
    layoutHomeCanvas();
    finishTransition();
  }

  const onViewportChange = () => {
    layoutHomeCanvas();
    syncPianoFxCenter();
  };

  window.addEventListener('resize', onViewportChange, { passive:true });
  window.addEventListener('orientationchange', () => {
    window.setTimeout(onViewportChange, 60);
    window.setTimeout(onViewportChange, 250);
  }, { passive:true });
  window.visualViewport?.addEventListener('resize', onViewportChange, { passive:true });

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(onViewportChange);
    resizeObserver.observe(safeFrame);
  }

  layoutHomeCanvas();
  syncPianoFxCenter();

  pianoButton.addEventListener('click', enterPiano);
  homeButton.addEventListener('click', enterHome);
})();
