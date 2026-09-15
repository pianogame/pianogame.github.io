(() => {
  const page = document.documentElement;
  let frame = 0, previous='';
  function fitLandscape() {
    frame = 0;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width || window.innerWidth);
    const height = Math.round(viewport?.height || window.innerHeight);
    const signature=width+'x'+height;
    if(signature===previous)return;
    previous=signature;
    page.style.setProperty('--hp-view-width', width + 'px');
    page.style.setProperty('--hp-view-height', height + 'px');
    page.dataset.hpRotated = String(height > width);
    window.dispatchEvent(new Event('hp-viewport-resize'));
  }
  function scheduleFit() {
    if (!frame) frame = requestAnimationFrame(fitLandscape);
  }
  window.addEventListener('resize', scheduleFit);
  window.addEventListener('orientationchange', scheduleFit);
  window.visualViewport?.addEventListener('resize', scheduleFit);
  window.addEventListener('pageshow', scheduleFit);
  fitLandscape();
})();
