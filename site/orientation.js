(() => {
  const page = document.documentElement;
  let frame = 0, previous = '', forcePending = false, settleTimers = [];

  // Keep the game surface at a fixed browser zoom while preserving ordinary
  // one-finger pointer gestures (tap, flick, swipe, long-press).
  const preventBrowserGesture = event => event.preventDefault();
  document.addEventListener('gesturestart', preventBrowserGesture, { passive:false });
  document.addEventListener('gesturechange', preventBrowserGesture, { passive:false });
  document.addEventListener('gestureend', preventBrowserGesture, { passive:false });
  document.addEventListener('touchmove', event => {
    if (event.touches && event.touches.length > 1) event.preventDefault();
  }, { passive:false });

  function measure() {
    const viewport = window.visualViewport;
    const vw = Math.max(1,Math.round(viewport?.width || window.innerWidth));
    const vh = Math.max(1,Math.round(viewport?.height || window.innerHeight));
    const iw = Math.max(1,Math.round(window.innerWidth || vw));
    const ih = Math.max(1,Math.round(window.innerHeight || vh));
    const viewportPortrait = vh > vw;
    const innerPortrait = ih > iw;
    const agreed = viewportPortrait === innerPortrait;
    let width = agreed ? vw : iw, height = agreed ? vh : ih;
    let rotated = viewportPortrait && innerPortrait;
    // A landscape iOS PWA may retain its previous viewport height at launch.
    // Screen dimensions are reliable only when its width matches this app.
    if (navigator.standalone === true && screen.width && screen.height) {
      const shortSide = Math.min(screen.width, screen.height);
      const longSide = Math.max(screen.width, screen.height);
      if (Math.abs(width - longSide) <= 2) { height = shortSide; rotated = false; }
      else if (Math.abs(width - shortSide) <= 2) { height = longSide; rotated = true; }
    }
    return { width, height, rotated };
  }
  window.HP_VIEWPORT_BOUNDS = measure;

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
