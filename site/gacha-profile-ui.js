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
      display:flex;
      align-items:center;
      gap:12px;
      padding:8px;
      border:1px solid #b89b6170;
      border-radius:10px;
      background:linear-gradient(135deg,#fffdf8e8,#eef3f8d9);
      overflow:hidden;
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
    #hp-home-screen .hp-customization-frame-visual {
      position:relative;
      width:82px;
      height:82px;
      flex:none;
      border-radius:50%;
    }
    #hp-home-screen .hp-customization-frame-visual .hp-customization-frame-avatar {
      position:absolute;
      inset:10%;
      width:80%;
      height:80%;
      object-fit:cover;
      border-radius:50%;
      background:#e9edf2;
    }
    #hp-home-screen .hp-customization-frame-visual .hp-customization-frame-art {
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit:contain;
      z-index:2;
    }
    @container (max-height:520px) {
      #hp-home-screen .hp-customization-preview { padding:5px; gap:8px; }
      #hp-home-screen .hp-customization-preview.is-background > img { width:min(34%,150px); }
      #hp-home-screen .hp-customization-frame-visual { width:62px; height:62px; }
      #hp-home-screen .hp-player-profile-field.has-custom-preview > span { padding-top:6px; }
    }
  `;
  document.head.appendChild(style);

  const profileImage = home.querySelector('[data-profile-preview-image]');
  const backgroundSelect = home.querySelector('[data-profile-home-background]');
  const frameSelect = home.querySelector('[data-profile-frame]');

  function optionName(select) {
    const text = select?.selectedOptions?.[0]?.textContent || '';
    return text.replace(/^所持｜/, '').trim();
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
      preview.innerHTML = '<div class="hp-customization-frame-visual"><img class="hp-customization-frame-avatar" alt="プロフィール画像"><img class="hp-customization-frame-art" alt="" aria-hidden="true" hidden></div><div class="hp-customization-preview-copy"><small>SELECTED FRAME</small><strong></strong></div>';
      select.insertAdjacentElement('afterend', preview);
    }
    return preview;
  }

  const backgroundPreview = buildBackgroundPreview(backgroundSelect);
  const framePreview = buildFramePreview(frameSelect);

  function syncBackgroundPreview() {
    if (!backgroundSelect || !backgroundPreview) return;
    const id = backgroundSelect.value || 'default';
    const img = backgroundPreview.querySelector('img');
    const label = backgroundPreview.querySelector('strong');
    const src = backgroundImages[id] || backgroundImages.default;
    if (img && img.getAttribute('src') !== src) img.src = src;
    if (label) label.textContent = optionName(backgroundSelect) || '標準ホーム';
  }

  function syncFramePreview() {
    if (!frameSelect || !framePreview) return;
    const id = frameSelect.value || 'default';
    const avatar = framePreview.querySelector('.hp-customization-frame-avatar');
    const art = framePreview.querySelector('.hp-customization-frame-art');
    const label = framePreview.querySelector('strong');
    const avatarSource = profileImage?.getAttribute('src') || '/assets/home/profile-default.svg';
    if (avatar && avatar.getAttribute('src') !== avatarSource) avatar.src = avatarSource;
    const frameSource = frameImages[id] || '';
    if (art) {
      art.hidden = !frameSource;
      if (frameSource && art.getAttribute('src') !== frameSource) art.src = frameSource;
      if (!frameSource) art.removeAttribute('src');
    }
    if (label) label.textContent = optionName(frameSelect) || '標準フレーム';
  }

  backgroundSelect?.addEventListener('change', syncBackgroundPreview);
  frameSelect?.addEventListener('change', syncFramePreview);
  syncBackgroundPreview();
  syncFramePreview();

  if (profileImage) {
    new MutationObserver(syncFramePreview).observe(profileImage, { attributes:true, attributeFilter:['src'] });
  }
  const profilePanel = home.querySelector('[data-home-profile]');
  if (profilePanel) {
    new MutationObserver(() => {
      if (!profilePanel.hidden) {
        requestAnimationFrame(() => {
          syncBackgroundPreview();
          syncFramePreview();
        });
      }
    }).observe(profilePanel, { attributes:true, attributeFilter:['hidden'] });
  }

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
      '/assets/gacha/visuals/normal-v1.webp',
      '/assets/gacha/visuals/special-v1.webp',
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

  const resultOverlay = home.querySelector('[data-gacha-result-overlay]');
  let forwardingResultTap = false;
  resultOverlay?.addEventListener('click', event => {
    if (forwardingResultTap || resultOverlay.hidden || resultOverlay.dataset.mode !== 'sequence') return;
    const count = Number(resultOverlay.dataset.count || '1');
    if (count <= 1) return;
    const next = home.querySelector('[data-gacha-result-next]');
    if (!next) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    forwardingResultTap = true;
    try { next.click(); } finally { forwardingResultTap = false; }
  }, { capture:true });
})();
