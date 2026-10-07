(() => {
  'use strict';

  const home = document.getElementById('hp-home-screen');
  if (!home) return;

  const select = home.querySelector('[data-profile-frame]');
  const preview = home.querySelector('[data-profile-frame-preview]');
  const art = home.querySelector('[data-profile-frame-preview-image]');
  const defaultRing = home.querySelector('[data-profile-frame-default-ring]');
  const name = home.querySelector('[data-profile-frame-preview-name]');
  if (!select || !preview || !art || !defaultRing || !name) return;

  const frameImages = Object.fromEntries(
    Array.from({ length: 15 }, (_, index) => {
      const id = String(index + 1).padStart(2, '0');
      return ['frame' + id, '/assets/gacha/frames/frame' + id + '-v1.webp'];
    })
  );
  const frameNames = {
    default:'標準フレーム',
    starlight:'スターライトフレーム',
    frame01:'星空ゴールド',
    frame02:'ロイヤルブルー',
    frame03:'クリスタルシルバー',
    frame04:'ローズゴールド',
    frame05:'エメラルド',
    frame06:'アメジスト',
    frame07:'サファイア',
    frame08:'ルビー',
    frame09:'ムーンライト',
    frame10:'フェアリー',
    frame11:'クラシック',
    frame12:'オーロラ',
    frame13:'スノークリスタル',
    frame14:'ノクターン',
    frame15:'セレブレーション',
  };

  const style = document.createElement('style');
  style.dataset.pdsFrameOnlyPreview = '';
  style.textContent = `
    #hp-home-screen [data-profile-frame-preview] {
      grid-column:2 !important;
      min-height:116px !important;
      display:flex !important;
      align-items:center !important;
      justify-content:flex-start !important;
      gap:14px !important;
      padding:10px 16px !important;
      overflow:visible !important;
      border:1px solid #b89b6170 !important;
      border-radius:10px !important;
      background:linear-gradient(135deg,#fffdf8e8,#eef3f8d9) !important;
    }
    #hp-home-screen .hp-frame-only-stage {
      position:relative;
      width:96px;
      height:96px;
      flex:0 0 96px;
      display:grid;
      place-items:center;
      overflow:visible;
    }
    #hp-home-screen .hp-frame-only-copy {
      min-width:0;
      display:flex;
      flex-direction:column;
      justify-content:center;
      gap:3px;
      color:#263c53;
      text-align:left;
    }
    #hp-home-screen .hp-frame-only-copy small {
      color:#90723c;
      font:700 10px/1.2 "Hiragino Sans","Yu Gothic",sans-serif;
      letter-spacing:.08em;
    }
    #hp-home-screen .hp-frame-only-copy strong {
      font:700 13px/1.35 "Hiragino Sans","Yu Gothic",sans-serif;
      overflow-wrap:anywhere;
    }
    #hp-home-screen [data-profile-frame-preview-image] {
      position:absolute;
      inset:0;
      width:100% !important;
      height:100% !important;
      max-width:none !important;
      max-height:none !important;
      object-fit:contain !important;
      object-position:center !important;
      display:block;
      visibility:visible;
      opacity:1;
      pointer-events:none;
    }
    #hp-home-screen [data-profile-frame-preview-image][hidden] {
      display:none !important;
    }
    #hp-home-screen [data-profile-frame-default-ring] {
      width:80px;
      height:80px;
      border-radius:50%;
      border:5px double #b89b61;
      box-shadow:0 0 0 3px #eef2f5,0 3px 10px #20344d33;
      display:block;
    }
    #hp-home-screen [data-profile-frame-default-ring][hidden] {
      display:none !important;
    }
    @container (max-height:520px) {
      #hp-home-screen [data-profile-frame-preview] { min-height:84px !important; padding:6px !important; }
      #hp-home-screen .hp-frame-only-stage { width:68px; height:68px; }
      #hp-home-screen [data-profile-frame-default-ring] { width:56px; height:56px; border-width:4px; }
    }
  `;
  document.head.appendChild(style);

  let lastValue = null;

  function render(force = false) {
    const id = select.value || 'default';
    if (!force && id === lastValue) return;
    lastValue = id;

    const src = frameImages[id] || '';
    preview.hidden = false;
    preview.style.display = 'flex';
    preview.dataset.frameId = id;
    name.textContent = frameNames[id] || select.selectedOptions?.[0]?.textContent?.replace(/^\s*所持\s*[｜|:：]\s*/, '') || '標準フレーム';

    if (src) {
      defaultRing.hidden = true;
      art.hidden = false;
      art.style.display = 'block';
      art.style.visibility = 'visible';
      art.style.opacity = '1';
      if (art.getAttribute('src') !== src) art.setAttribute('src', src);
    } else {
      art.hidden = true;
      art.removeAttribute('src');
      defaultRing.hidden = false;
    }
  }

  const onSelect = () => {
    lastValue = null;
    render(true);
    requestAnimationFrame(() => render(true));
    setTimeout(() => render(true), 80);
  };

  select.addEventListener('input', onSelect);
  select.addEventListener('change', onSelect);
  select.addEventListener('blur', onSelect);
  home.addEventListener('change', event => {
    if (event.target === select) onSelect();
  }, true);

  new MutationObserver(() => onSelect()).observe(select, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['value']
  });

  const panel = home.querySelector('[data-home-profile]');
  if (panel) {
    new MutationObserver(() => {
      if (!panel.hidden) onSelect();
    }).observe(panel, { attributes:true, attributeFilter:['hidden'] });
  }

  window.addEventListener('pageshow', onSelect);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) onSelect();
  });

  // iOS select controls can commit the displayed value after their event queue.
  // While the profile panel is open, verify the value cheaply so preview cannot stay stale.
  setInterval(() => {
    if (document.hidden || panel?.hidden) return;
    if ((select.value || 'default') !== lastValue) render(true);
  }, 180);

  onSelect();
})();