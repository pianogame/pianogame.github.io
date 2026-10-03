(() => {
  'use strict';
  const key = 'hp-home-character-v1';
  const registry = window.HP_CHARACTERS;
  const listeners = new Set();
  const valid = id => registry.get(id)?.available === true;
  const read = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || 'null');
      return valid(stored?.homeCharacterId) ? stored.homeCharacterId : registry.defaultId;
    } catch (_) { return registry.defaultId; }
  };
  let homeCharacterId = read();
  // Persist the first formal HOME choice too, without requiring a selector visit.
  try {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify({ version: 1, homeCharacterId }));
  } catch (_) {}
  function notify() {
    for (const listener of listeners) listener(registry.get(homeCharacterId));
  }
  // All persistence lives behind this adapter; future account sync can replace it.
  window.HP_CHARACTER_SETTINGS = Object.freeze({
    getHomeCharacterId: () => homeCharacterId,
    getHomeCharacter: () => registry.get(homeCharacterId),
    setHomeCharacter(id) {
      if (!valid(id)) return { ok: false, reason: 'このキャラクターは選択できません。' };
      try {
        localStorage.setItem(key, JSON.stringify({ version: 1, homeCharacterId: id }));
      } catch (_) { return { ok: false, reason: '設定を保存できませんでした。端末の空き容量やブラウザ設定をご確認ください。' }; }
      if (homeCharacterId !== id) { homeCharacterId = id; notify(); }
      return { ok: true };
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    const next = read();
    if (next !== homeCharacterId) { homeCharacterId = next; notify(); }
  });
})();
