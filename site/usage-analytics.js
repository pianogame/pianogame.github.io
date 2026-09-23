(() => {
  'use strict';

  const sent = new Set();
  const pending = new Set();
  const base = '/analytics-event/';

  function isInstalledApp() {
    return navigator.standalone === true ||
      window.matchMedia?.('(display-mode: standalone)')?.matches === true;
  }

  function deliver(name) {
    if (sent.has(name)) return;
    if (!navigator.onLine) {
      pending.add(name);
      return;
    }

    sent.add(name);
    pending.delete(name);

    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.src = base + name + '.html';
    frame.addEventListener('load', () => {
      window.setTimeout(() => frame.remove(), 3000);
    }, { once: true });
    document.body.append(frame);
  }

  window.addEventListener('online', () => {
    for (const name of [...pending]) deliver(name);
  });

  if (isInstalledApp()) deliver('pwa-launch');

  const startButton = document.querySelector('[data-action="start"]');
  if (startButton) {
    const syncPerformanceStart = () => {
      if (startButton.hidden) deliver('performance-start');
    };
    syncPerformanceStart();
    const startObserver = new MutationObserver(syncPerformanceStart);
    startObserver.observe(startButton, { attributes: true, attributeFilter: ['hidden'] });
  }

  const recordButton = document.querySelector('[data-action="record"]');
  if (recordButton) {
    let wasRecording = recordButton.getAttribute('aria-pressed') === 'true';
    const observer = new MutationObserver(() => {
      const isRecording = recordButton.getAttribute('aria-pressed') === 'true';
      if (!wasRecording && isRecording) deliver('recording-start');
      wasRecording = isRecording;
    });
    observer.observe(recordButton, { attributes: true, attributeFilter: ['aria-pressed'] });
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('button[data-export-mix]');
    if (button && !button.disabled) deliver('export-start');
  }, true);
})();
