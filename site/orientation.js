(() => {
  const page = document.documentElement;
  let frame = 0, previous = '', forcePending = false, settleTimers = [];

  function measure() {
    const viewport = window.visualViewport;
    const vw = Math.max(1,Math.round(viewport?.width || window.innerWidth));
    const vh = Math.max(1,Math.round(viewport?.height || window.innerHeight));
    const iw = Math.max(1,Math.round(window.innerWidth || vw));
    const ih = Math.max(1,Math.round(window.innerHeight || vh));
    const viewportPortrait = vh > vw;
    const innerPortrait = ih > iw;
    const agreed = viewportPortrait === innerPortrait;
    return {
      width: agreed ? vw : iw,
      height: agreed ? vh : ih,
      rotated: viewportPortrait && innerPortrait
    };
  }

  function fitLandscape(force = false) {
    frame = 0;
    const {width,height,rotated} = measure();
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
    settleTimers = [80,220,500,900,1400].map(delay => setTimeout(() => scheduleFit(true),delay));
  }

  window.addEventListener('resize', () => scheduleFit(false));
  window.addEventListener('orientationchange', settleFit);
  window.visualViewport?.addEventListener('resize', () => scheduleFit(false));
  window.addEventListener('pageshow', settleFit);
  window.addEventListener('focus', settleFit);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) settleFit(); });
  settleFit();
})();