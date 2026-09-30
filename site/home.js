(() => {
  'use strict';

  const home = document.getElementById('hp-home-screen');
  const piano = document.getElementById('hp-four88');
  if (!home || !piano) return;

  const pianoButton = home.querySelector('[data-home-action="piano"]');
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

  // Measure the actual safe area, including the viewport's portrait rotation.
  // Only component dimensions use this unit; the canvas itself is never scaled.
  const safeArea = home.querySelector('.hp-home-safe');
  function syncHomeLayout() {
    if (!safeArea || home.hidden) return;
    const width = safeArea.clientWidth;
    const height = safeArea.clientHeight;
    if (!width || !height) return;
    const unit = Math.min(width / 1536, height / 864, 1.25);
    home.style.setProperty('--home-unit', unit + 'px');
    home.dataset.homeCompact = String(width < 740);
    const footer = home.querySelector('.hp-home-footer');
    if (footer) {
      const top = height * (width < 740 ? .26 : .23);
      const gap = Math.max(10, 26 * unit);
      // Both images keep their native 3:1 ratio. Reserve the footer's measured
      // space before choosing their width, especially on short/small phones.
      const available = footer.offsetTop - top - gap - Math.max(8, 16 * unit);
      const modeWidth = Math.max(0, Math.min(width * .39, 570 * unit, available * 1.5));
      home.style.setProperty('--home-mode-width', modeWidth + 'px');
    }
    syncPianoFxCenter();
  }
  if (safeArea && 'ResizeObserver' in window) {
    new ResizeObserver(syncHomeLayout).observe(safeArea);
  }

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

  pianoButton.addEventListener('click', enterPiano);
  homeButton.addEventListener('click', enterHome);
})();
