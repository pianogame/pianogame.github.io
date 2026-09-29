(() => {
  'use strict';

  const home = document.getElementById('hp-home-screen');
  const piano = document.getElementById('hp-four88');
  if (!home || !piano) return;

  const pianoButton = home.querySelector('[data-home-action="piano"]');
  if (!pianoButton) return;

  let enteringPiano = false;

  function enterPiano() {
    if (enteringPiano) return;
    enteringPiano = true;

    try {
      window.HP_AUDIO_BRIDGE?.configureSession?.();
      const resume = window.HP_AUDIO_BRIDGE?.resume?.();
      if (resume && typeof resume.catch === 'function') resume.catch(() => {});
    } catch (_) {}

    home.hidden = true;
    piano.hidden = false;
    document.body.classList.add('hp-piano-active');

    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('hp-viewport-resize'));
      window.dispatchEvent(new Event('resize'));
      enteringPiano = false;
    });
  }

  pianoButton.addEventListener('click', enterPiano);
})();
