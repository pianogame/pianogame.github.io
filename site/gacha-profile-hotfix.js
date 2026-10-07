(() => {
  'use strict';

  const home = document.getElementById('hp-home-screen');
  if (!home) return;

  const frameImages = Object.fromEntries(
    Array.from({ length: 15 }, (_, index) => {
      const id = String(index + 1).padStart(2, '0');
      return ['frame' + id, '/assets/gacha/frames/frame' + id + '-v1.webp'];
    })
  );

  const style = document.createElement('style');
  style.dataset.pdsGachaProfileHotfix = '';
  style.textContent = `
    #hp-home-screen .hp-player-profile-field.has-custom-preview {
      grid-template-columns:112px minmax(0,1fr);
      align-items:start;
    }
    #hp-home-screen .hp-player-profile-field.has-custom-preview > span {
      grid-column:1;
      grid-row:1 / span 3;
      padding-top:10px;
    }
    #hp-home-screen .hp-player-profile-field.has-custom-preview > select,
    #hp-home-screen .hp-player-profile-field.has-custom-preview > .hp-customization-preview,
    #hp-home-screen .hp-player-profile-field.has-custom-preview > small {
      grid-column:2;
    }
    #hp-home-screen .hp-player-profile-field.has-custom-preview > small { white-space:normal; }
    #hp-home-screen .hp-customization-preview.is-frame {
      min-width:0;
      min-height:100px;
      display:flex !important;
      align-items:center;
      gap:12px;
      padding:8px;
      border:1px solid #b89b6170;
      border-radius:10px;
      background:linear-gradient(135deg,#fffdf8e8,#eef3f8d9);
      overflow:visible;
    }
    #hp-home-screen .hp-customization-frame-visual {
      position:relative;
      width:84px;
      height:84px;
      flex:0 0 84px;
      border-radius:50%;
      background:radial-gradient(circle,#f7f8fb 0 58%,#dce3ea 59% 100%);
    }
    #hp-home-screen .hp-customization-frame-avatar {
      position:absolute;
      inset:13%;
      width:74%;
      height:74%;
      object-fit:cover;
      border-radius:50%;
      background:#e9edf2;
    }
    #hp-home-screen .hp-customization-frame-art {
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit:contain;
      z-index:3;
      display:block !important;
    }
    #hp-home-screen .hp-customization-frame-art[hidden] { display:none !important; }
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
      font:700 12px/1.35 "Hiragino Sans","Yu Gothic",sans-serif;
      overflow-wrap:anywhere;
    }
    @container (max-height:520px) {
      #hp-home-screen .hp-customization-preview.is-frame { min-height:76px; padding:5px; gap:8px; }
      #hp-home-screen .hp-customization-frame-visual { width:62px; height:62px; flex-basis:62px; }
    }
  `;
  document.head.appendChild(style);

  const backgroundSelect = home.querySelector('[data-profile-home-background]');
  const frameSelect = home.querySelector('[data-profile-frame]');
  const profileImage = home.querySelector('[data-profile-preview-image]');

  function cleanOwnedPrefix(select) {
    if (!select) return;
    for (const option of select.options) {
      const next = (option.textContent || '').replace(/^\s*所持\s*[｜:：]\s*/, '');
      if (option.textContent !== next) option.textContent = next;
    }
  }

  function selectedLabel(select, fallback) {
    cleanOwnedPrefix(select);
    return (select?.selectedOptions?.[0]?.textContent || fallback || '').trim();
  }

  function ensureFramePreview() {
    if (!frameSelect) return null;
    const field = frameSelect.closest('.hp-player-profile-field') || frameSelect.parentElement;
    if (!field) return null;
    field.classList.add('has-custom-preview');
    let preview = field.querySelector('[data-profile-frame-preview]');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'hp-customization-preview is-frame';
      preview.dataset.profileFramePreview = '';
      preview.innerHTML = '<div class="hp-customization-frame-visual"><img class="hp-customization-frame-avatar" alt="プロフィール画像"><img class="hp-customization-frame-art" alt="" aria-hidden="true"></div><div class="hp-customization-preview-copy"><small>SELECTED FRAME</small><strong></strong></div>';
      frameSelect.insertAdjacentElement('afterend', preview);
    }
    return preview;
  }

  function syncFramePreview() {
    cleanOwnedPrefix(backgroundSelect);
    cleanOwnedPrefix(frameSelect);
    const preview = ensureFramePreview();
    if (!preview || !frameSelect) return;

    const id = frameSelect.value || 'default';
    const avatar = preview.querySelector('.hp-customization-frame-avatar');
    const art = preview.querySelector('.hp-customization-frame-art');
    const label = preview.querySelector('.hp-customization-preview-copy strong');

    const avatarSource = profileImage?.currentSrc || profileImage?.getAttribute('src') || '/assets/home/profile-default.svg';
    if (avatar && avatar.getAttribute('src') !== avatarSource) avatar.src = avatarSource;

    const frameSource = frameImages[id] || '';
    if (art) {
      if (frameSource) {
        art.hidden = false;
        if (art.getAttribute('src') !== frameSource) art.src = frameSource;
      } else {
        art.hidden = true;
        art.removeAttribute('src');
      }
    }
    if (label) label.textContent = selectedLabel(frameSelect, '標準フレーム');
  }

  cleanOwnedPrefix(backgroundSelect);
  cleanOwnedPrefix(frameSelect);
  syncFramePreview();

  backgroundSelect?.addEventListener('change', () => cleanOwnedPrefix(backgroundSelect));
  frameSelect?.addEventListener('change', syncFramePreview);

  for (const select of [backgroundSelect, frameSelect]) {
    if (!select) continue;
    new MutationObserver(() => {
      cleanOwnedPrefix(select);
      if (select === frameSelect) syncFramePreview();
    }).observe(select, { childList:true, subtree:true, characterData:true });
  }

  if (profileImage) {
    new MutationObserver(syncFramePreview).observe(profileImage, { attributes:true, attributeFilter:['src'] });
  }

  const profilePanel = home.querySelector('[data-home-profile]');
  if (profilePanel) {
    new MutationObserver(() => {
      if (!profilePanel.hidden) requestAnimationFrame(syncFramePreview);
    }).observe(profilePanel, { attributes:true, attributeFilter:['hidden'] });
  }

  const resultOverlay = home.querySelector('[data-gacha-result-overlay]');
  let forwardingSingleTap = false;
  resultOverlay?.addEventListener('click', event => {
    if (forwardingSingleTap || resultOverlay.hidden || resultOverlay.dataset.mode !== 'sequence') return;
    const count = Number(resultOverlay.dataset.count || '1');
    if (count > 1) return;
    const ok = home.querySelector('.hp-gacha-result-ok');
    if (!ok) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    forwardingSingleTap = true;
    try { ok.click(); } finally { forwardingSingleTap = false; }
  }, { capture:true });
})();
