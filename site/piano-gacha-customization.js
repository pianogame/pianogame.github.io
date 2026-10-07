(() => {
  'use strict';

  const root = document.getElementById('hp-four88');
  if (!root) return;

  const inventoryKey = 'pds-gacha-inventory-v1';
  const settingsKey = 'pds-piano-gacha-customization-v1';
  const backgroundSelect = root.querySelector('[data-piano-background]');
  const skinSelect = root.querySelector('[data-piano-skin]');
  const touchSelect = root.querySelector('[data-piano-touch-effect]');
  const catalog = window.HP_GACHA_CUSTOMIZATION_CATALOG || {
    pianoBackgrounds:{default:{name:'標準・コンサートホール'}},
    pianoSkins:{default:{name:'標準・コンサートブラック'}},
    touchEffects:{default:{name:'標準・ゴールドスパーク'}},
  };

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function inventory() {
    const saved = readJson(inventoryKey, {});
    return {
      pianoBackgrounds:Array.from(new Set(['default', ...(Array.isArray(saved.pianoBackgrounds) ? saved.pianoBackgrounds : [])])),
      pianoSkins:Array.from(new Set(['default', ...(Array.isArray(saved.pianoSkins) ? saved.pianoSkins : [])])),
      touchEffects:Array.from(new Set(['default', ...(Array.isArray(saved.touchEffects) ? saved.touchEffects : [])])),
    };
  }

  let selected = {
    pianoBackground:'default',
    pianoSkin:'default',
    touchEffect:'default',
    ...readJson(settingsKey, {}),
  };

  function owned(list, id) {
    return id === 'default' || list.includes(id);
  }

  function fill(select, items, ownedIds, selectedId) {
    if (!select) return 'default';
    const ids = Array.from(new Set(['default', ...ownedIds])).filter(id => items[id]);
    select.replaceChildren(...ids.map(id => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = id === 'default' ? items[id].name : '所持｜' + items[id].name;
      return option;
    }));
    const next = ids.includes(selectedId) ? selectedId : 'default';
    select.value = next;
    return next;
  }

  function apply() {
    root.dataset.pianoBackground = selected.pianoBackground || 'default';
    root.dataset.pianoSkin = selected.pianoSkin || 'default';
    root.dataset.touchEffect = selected.touchEffect || 'default';
    try { localStorage.setItem(settingsKey, JSON.stringify(selected)); } catch (_) {}
  }

  function refresh() {
    const inv = inventory();
    selected.pianoBackground = fill(
      backgroundSelect, catalog.pianoBackgrounds || {}, inv.pianoBackgrounds,
      owned(inv.pianoBackgrounds, selected.pianoBackground) ? selected.pianoBackground : 'default'
    );
    selected.pianoSkin = fill(
      skinSelect, catalog.pianoSkins || {}, inv.pianoSkins,
      owned(inv.pianoSkins, selected.pianoSkin) ? selected.pianoSkin : 'default'
    );
    selected.touchEffect = fill(
      touchSelect, catalog.touchEffects || {}, inv.touchEffects,
      owned(inv.touchEffects, selected.touchEffect) ? selected.touchEffect : 'default'
    );
    apply();
  }

  backgroundSelect?.addEventListener('change', () => {
    selected.pianoBackground = backgroundSelect.value;
    apply();
  });
  skinSelect?.addEventListener('change', () => {
    selected.pianoSkin = skinSelect.value;
    apply();
  });
  touchSelect?.addEventListener('change', () => {
    selected.touchEffect = touchSelect.value;
    apply();
  });

  window.addEventListener('pds-gacha-inventory-change', refresh);
  window.addEventListener('storage', event => {
    if (event.key === inventoryKey) refresh();
  });

  refresh();
})();
