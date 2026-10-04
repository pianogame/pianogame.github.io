(() => {
  'use strict';
  const categories = ['effects', 'voice'];
  const values = {}, bindings = new Set();
  const read = category => {
    try {
      const stored = localStorage.getItem('hp-sound-' + category);
      const value = stored === null ? 1 : Number(stored);
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
    } catch (_) { return 1; }
  };
  categories.forEach(category => { values[category] = read(category); });
  function render(category) {
    document.querySelectorAll('[data-sound-control="' + category + '"]').forEach(input => { input.value = Math.round(values[category] * 100); });
    document.querySelectorAll('[data-sound-output="' + category + '"]').forEach(output => { output.textContent = Math.round(values[category] * 100) + '%'; });
    for (const binding of bindings) {
      if (binding.category !== category) continue;
      const { node, base } = binding, now = node.context.currentTime;
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(values[category] * base, now, .03);
    }
  }
  window.HP_SOUND_SETTINGS = {
    get: category => values[category] ?? 1,
    bind(category, node, base = 1) {
      node.gain.value = (values[category] ?? 1) * base;
      const binding = { category, node, base }; bindings.add(binding);
      return () => bindings.delete(binding);
    },
    set(category, value) {
      if (!categories.includes(category) || !Number.isFinite(value)) return;
      values[category] = Math.max(0, Math.min(1, value));
      try { localStorage.setItem('hp-sound-' + category, String(values[category])); } catch (_) {}
      render(category);
    },
  };
  document.querySelectorAll('[data-sound-control]').forEach(input => {
    input.addEventListener('input', () => window.HP_SOUND_SETTINGS.set(input.dataset.soundControl, Number(input.value) / 100));
  });
  categories.forEach(render);
  window.addEventListener('storage', event => {
    for (const category of categories) if (event.key === 'hp-sound-' + category || event.key === null) { values[category] = read(category); render(category); }
  });
})();
