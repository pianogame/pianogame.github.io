(() => {
  'use strict';

  const home = document.getElementById('hp-home-screen');
  if (!home) return;

  const backgroundImages = {
    default: '/assets/home/background/528030FF-B2C0-40B1-AA18-0B5410044B05.png?v=3',
    crystal: '/assets/home/character-screen-bg-20261006.svg',
    celestial: '/assets/gacha/backgrounds/celestial-v1.webp',
    moonlight: '/assets/gacha/backgrounds/moonlight-v1.webp',
    sunset: '/assets/gacha/backgrounds/sunset-v1.webp',
    dreamroom: '/assets/gacha/backgrounds/dreamroom-v1.webp',
    stardome: '/assets/gacha/backgrounds/stardome-v1.webp',
    icepalace: '/assets/gacha/backgrounds/icepalace-v1.webp',
    roseterrace: '/assets/gacha/backgrounds/roseterrace-v1.webp',
    neon: '/assets/gacha/backgrounds/neon-v1.webp',
    undersea: '/assets/gacha/backgrounds/undersea-v1.webp',
    rainbow: '/assets/gacha/backgrounds/rainbow-v1.webp',
  };

  const frameImages = Object.fromEntries(
    Array.from({ length: 15 }, (_, index) => {
      const id = String(index + 1).padStart(2, '0');
      return ['frame' + id, '/assets/gacha/frames/frame' + id + '-v1.webp'];
    })
  );

  const style = document.createElement('style');
  style.dataset.pdsGachaProfileUi = '';
  style.textContent = `
    #hp-home-screen [data-gacha-result-next],
    #hp-home-screen [data-gacha-result-skip] { display:none !important; }
    #hp-home-screen .hp-gacha-result-overlay[data-mode="sequence"] .hp-gacha-result-actions { display:none !important; }
    #hp-home-screen .hp-gacha-result-overlay[data-mode="sequence"] .hp-gacha-result-panel,
    #hp-home-screen .hp-gacha-result-overlay[data-mode="sequence"] .hp-gacha-result-backdrop { cursor:pointer; }

    #hp-home-screen .hp-player-profile-field.has-custom-preview {
      grid-template-columns:112px minmax(0,1fr);
      align-items:start;
    }
    #hp-home-screen .hp-player-profile-field.has-custom-preview > span { grid-column:1; grid-row:1 / span 3; padding-top:10px; }
    #hp-home-screen .hp-player-profile-field.has-custom-preview > select,
    #hp-home-screen .hp-player-profile-field.has-custom-preview > .hp-customization-preview,
    #hp-home-screen .hp-player-profile-field.has-custom-preview > small { grid-column:2; }
    #hp-home-screen .hp-player-profile-field.has-custom-preview > small { white-space:normal; }
    #hp-home-screen .hp-customization-preview {
      min-width:0;
      display:flex !important;
      align-items:center;
      gap:12px;
      padding:8px;
      border:1px solid #b89b6170;
      border-radius:10px;
      background:linear-gradient(135deg,#fffdf8e8,#eef3f8d9);
      overflow:visible;
    }
    #hp-home-screen .hp-customization-preview-copy {
      min-width:0;
      display:flex;
      flex-direction:column;
      gap:2px;
      color:#263c53;
    }
    #hp-home-screen .hp-customization-preview-copy small {
      color:#90723c;
      font:700 9px/1.2 "Hiragino Sans","Yu Gothic",sans-serif;
      letter-spacing:.08em;
    }
    #hp-home-screen .hp-customization-preview-copy strong {
      min-width:0;
      font:700 12px/1.35 "Hiragino Sans","Yu Gothic",sans-serif;
      overflow-wrap:anywhere;
    }
    #hp-home-screen .hp-customization-preview.is-background > img {
      width:min(42%,220px);
      aspect-ratio:16/9;
      flex:none;
      object-fit:cover;
      border-radius:7px;
      border:1px solid #ad8f55;
      box-shadow:0 2px 8px #15253b2b;
    }
    #hp-home-screen .hp-customization-preview.is-frame {
      min-height:104px;
      display:flex !important;
      visibility:visible !important;
      opacity:1 !important;
    }
    #hp-home-screen .hp-customization-frame-visual {
      position:relative;
      width:94px;
      height:94px;
      flex:0 0 94px;
      overflow:visible;
      border-radius:50%;
      background:
        radial-gradient(circle at 50% 50%,#f7f8fb 0 54%,#dce3ea 55% 65%,#263a55 66% 69%,#eef2f5 70% 100%);
      box-shadow:0 2px 8px #15253b2b;
    }
    #hp-home-screen .hp-customization-frame-visual .hp-customization-frame-avatar {
      position:absolute;
      inset:14%;
      width:72%;
      height:72%;
      object-fit:cover;
      border-radius:50%;
      background:#e9edf2;
      z-index:1;
    }
    #hp-home-screen .hp-customization-frame-visual .hp-customization-frame-art {
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      max-width:none;
      max-height:none;
      object-fit:contain;
      object-position:center;
      z-index:3;
      opacity:1 !important;
      visibility:visible !important;
      display:block !important;
      pointer-events:none;
    }
    #hp-home-screen .hp-customization-frame-visual .hp-customization-frame-art[hidden] { display:none !important; }
    @container (max-height:520px) {
      #hp-home-screen .hp-customization-preview { padding:5px; gap:8px; }
      #hp-home-screen .hp-customization-preview.is-background > img { width:min(34%,150px); }
      #hp-home-screen .hp-customization-preview.is-frame { min-height:78px; }
      #hp-home-screen .hp-customization-frame-visual { width:68px; height:68px; flex-basis:68px; }
      #hp-home-screen .hp-player-profile-field.has-custom-preview > span { padding-top:6px; }
    }
  `;
  document.head.appendChild(style);

  const profileImage = home.querySelector('[data-profile-preview-image]');
  const backgroundSelect = home.querySelector('[data-profile-home-background]');
  const frameSelect = home.querySelector('[data-profile-frame]');

  function cleanOwnedPrefix(select) {
    if (!select) return;
    for (const option of select.options) {
      const cleaned = (option.textContent || '').replace(/^\s*所持\s*[｜|:：]\s*/, '');
      if (option.textContent !== cleaned) option.textContent = cleaned;
    }
  }

  function optionName(select) {
    cleanOwnedPrefix(select);
    return (select?.selectedOptions?.[0]?.textContent || '').trim();
  }

  function buildBackgroundPreview(select) {
    const field = select?.closest('.hp-player-profile-field');
    if (!field) return null;
    field.classList.add('has-custom-preview');
    let preview = field.querySelector('[data-profile-background-preview]');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'hp-customization-preview is-background';
      preview.dataset.profileBackgroundPreview = '';
      preview.innerHTML = '<img alt="選択中のホーム背景"><div class="hp-customization-preview-copy"><small>SELECTED BACKGROUND</small><strong></strong></div>';
      select.insertAdjacentElement('afterend', preview);
    }
    preview.style.display = 'flex';
    preview.style.gridColumn = '2';
    return preview;
  }

  function buildFramePreview(select) {
    const field = select?.closest('.hp-player-profile-field');
    if (!field) return null;
    field.classList.add('has-custom-preview');
    let preview = field.querySelector('[data-profile-frame-preview]');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'hp-customization-preview is-frame';
      preview.dataset.profileFramePreview = '';
      preview.innerHTML = '<div class="hp-customization-frame-visual"><img class="hp-customization-frame-avatar" alt="プロフィール画像"><img class="hp-customization-frame-art" alt="" aria-hidden="true"></div><div class="hp-customization-preview-copy"><small>SELECTED FRAME</small><strong></strong></div>';
      select.insertAdjacentElement('afterend', preview);
    }
    preview.hidden = false;
    preview.style.display = 'flex';
    preview.style.gridColumn = '2';
    preview.style.minHeight = '94px';
    return preview;
  }

  let backgroundPreview = buildBackgroundPreview(backgroundSelect);
  let framePreview = buildFramePreview(frameSelect);

  function syncBackgroundPreview() {
    backgroundPreview = buildBackgroundPreview(backgroundSelect) || backgroundPreview;
    if (!backgroundSelect || !backgroundPreview) return;
    cleanOwnedPrefix(backgroundSelect);
    const id = backgroundSelect.value || 'default';
    const img = backgroundPreview.querySelector('img');
    const label = backgroundPreview.querySelector('strong');
    const src = backgroundImages[id] || backgroundImages.default;
    if (img && img.getAttribute('src') !== src) img.src = src;
    if (label) label.textContent = optionName(backgroundSelect) || '標準ホーム';
  }

  function syncFramePreview() {
    framePreview = buildFramePreview(frameSelect) || framePreview;
    if (!frameSelect || !framePreview) return;
    cleanOwnedPrefix(frameSelect);
    const id = frameSelect.value || 'default';
    const avatar = framePreview.querySelector('.hp-customization-frame-avatar');
    const art = framePreview.querySelector('.hp-customization-frame-art');
    const label = framePreview.querySelector('strong');
    const avatarSource = profileImage?.currentSrc || profileImage?.getAttribute('src') || '/assets/home/profile-default.svg';
    if (avatar) {
      avatar.hidden = false;
      if (avatar.getAttribute('src') !== avatarSource) avatar.src = avatarSource;
    }
    const frameSource = frameImages[id] || '';
    if (art) {
      if (frameSource) {
        art.hidden = false;
        art.style.removeProperty('display');
        art.style.removeProperty('visibility');
        art.style.removeProperty('opacity');
        if (art.getAttribute('src') !== frameSource) art.src = frameSource;
      } else {
        art.hidden = true;
        art.removeAttribute('src');
      }
    }
    framePreview.hidden = false;
    framePreview.style.display = 'flex';
    framePreview.style.visibility = 'visible';
    framePreview.style.opacity = '1';
    if (label) label.textContent = optionName(frameSelect) || '標準フレーム';
  }

  backgroundSelect?.addEventListener('input', syncBackgroundPreview);
  backgroundSelect?.addEventListener('change', syncBackgroundPreview);
  frameSelect?.addEventListener('input', syncFramePreview);
  frameSelect?.addEventListener('change', syncFramePreview);
  syncBackgroundPreview();
  syncFramePreview();

  for (const select of [backgroundSelect, frameSelect]) {
    if (!select) continue;
    new MutationObserver(() => {
      cleanOwnedPrefix(select);
      if (select === backgroundSelect) syncBackgroundPreview();
      if (select === frameSelect) syncFramePreview();
    }).observe(select, { childList:true, subtree:true, characterData:true });
  }

  if (profileImage) {
    new MutationObserver(syncFramePreview).observe(profileImage, { attributes:true, attributeFilter:['src'] });
  }
  const profilePanel = home.querySelector('[data-home-profile]');
  function refreshCustomizationPreviews() {
    requestAnimationFrame(() => {
      syncBackgroundPreview();
      syncFramePreview();
      setTimeout(() => {
        syncBackgroundPreview();
        syncFramePreview();
      }, 80);
    });
  }
  if (profilePanel) {
    new MutationObserver(() => {
      if (!profilePanel.hidden) refreshCustomizationPreviews();
    }).observe(profilePanel, { attributes:true, attributeFilter:['hidden'] });
  }
  home.querySelector('[data-home-action="profile-settings"]')?.addEventListener('click', refreshCustomizationPreviews, { capture:true });
  window.addEventListener('pageshow', refreshCustomizationPreviews);

  const preloaded = new Map();
  function preloadImage(src, priority = 'low') {
    if (!src) return Promise.resolve();
    if (preloaded.has(src)) return preloaded.get(src);
    const promise = new Promise(resolve => {
      const img = new Image();
      img.decoding = 'async';
      try { img.fetchPriority = priority; } catch (_) {}
      img.onload = () => {
        const decoded = typeof img.decode === 'function' ? img.decode().catch(() => {}) : null;
        Promise.resolve(decoded).finally(resolve);
      };
      img.onerror = resolve;
      img.src = src;
    });
    preloaded.set(src, promise);
    return promise;
  }

  let warmedGachaAssets = false;
  async function warmGachaAssets() {
    if (warmedGachaAssets) return;
    warmedGachaAssets = true;
    const common = [
      '/assets/gacha/visuals/piano-v1.webp',
      '/assets/gacha/visuals/result-normal-v2.webp?v=21',
      '/assets/gacha/visuals/result-character-v2.webp?v=21',
      '/assets/gacha/visuals/ticket-v1.webp',
    ];
    await Promise.all(common.map(src => preloadImage(src, 'high')));
    const rewards = [
      ...Object.values(backgroundImages).filter(src => src.includes('/assets/gacha/')),
      ...Object.values(frameImages),
    ];
    let cursor = 0;
    const workers = Array.from({ length:4 }, async () => {
      while (cursor < rewards.length) {
        const src = rewards[cursor++];
        await preloadImage(src, 'low');
      }
    });
    await Promise.all(workers);
  }

  home.querySelector('[data-home-action="gacha"]')?.addEventListener('click', () => {
    void warmGachaAssets();
  }, { capture:true });

})();
