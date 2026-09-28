(() => {
  const page = document.documentElement;
  let frame = 0, previous = '', forcePending = false, settleTimers = [];

  function portraitState(width,height) {
    const type = window.screen?.orientation?.type || '';
    if (type.startsWith('landscape')) return false;
    if (type.startsWith('portrait')) return true;
    const media = window.matchMedia?.('(orientation: portrait)');
    if (media) return media.matches;
    return height > width;
  }

  function fitLandscape(force = false) {
    frame = 0;
    const viewport = window.visualViewport;
    const width = Math.max(1,Math.round(viewport?.width || window.innerWidth));
    const height = Math.max(1,Math.round(viewport?.height || window.innerHeight));
    const rotated = portraitState(width,height);
    const signature = width + 'x' + height + ':' + rotated;
    if (!force && signature === previous) return;
    previous = signature;
    page.style.setProperty('--hp-view-width', width + 'px');
    page.style.setProperty('--hp-view-height', height + 'px');
    page.dataset.hpRotated = String(rotated);
    window.dispatchEvent(new Event('hp-viewport-resize'));
  }

  function scheduleFit(force = false) {
    forcePending = forcePending || force;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      const shouldForce = forcePending;
      forcePending = false;
      fitLandscape(shouldForce);
    });
  }

  function settleFit() {
    scheduleFit(true);
    settleTimers.forEach(clearTimeout);
    settleTimers = [80,220,500,900].map(delay => setTimeout(() => scheduleFit(true),delay));
  }

  window.addEventListener('resize', () => scheduleFit(false));
  window.addEventListener('orientationchange', settleFit);
  window.visualViewport?.addEventListener('resize', () => scheduleFit(false));
  window.addEventListener('pageshow', settleFit);
  window.addEventListener('focus', settleFit);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) settleFit(); });
  settleFit();
})();