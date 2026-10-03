(() => {
  'use strict';
  const assets = new Map();
  const mouthKeys = ['closed', 'a', 'i', 'u', 'e', 'o'];
  const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const canvas = (width, height) => { const node = document.createElement('canvas'); node.width = width; node.height = height; return node; };
  function bounds(data, width, height, region = { x: 0, y: 0, width, height }, threshold = 64) {
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = Math.max(0, Math.floor(region.y)); y < Math.min(height, Math.ceil(region.y + region.height)); y++) {
      for (let x = Math.max(0, Math.floor(region.x)); x < Math.min(width, Math.ceil(region.x + region.width)); x++) {
        if (data[(y * width + x) * 4 + 3] <= threshold) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    return right < left ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  }
  function inspect(image) {
    const node = canvas(image.naturalWidth, image.naturalHeight), ctx = node.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, node.width, node.height).data;
    return { image, data, width: node.width, height: node.height, bounds: bounds(data, node.width, node.height) };
  }
  function crop(image, rect) {
    const node = canvas(rect.width, rect.height);
    node.getContext('2d').drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    return node;
  }
  // Same local eyelid fallback as Layer Motion Maker; no flattened iris.
  // An optional files.closedEyes full-canvas asset takes precedence.
  function closedEye(open) {
    const w = open.width, h = open.height, src = open.getContext('2d').getImageData(0, 0, w, h);
    const skin = [], ink = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (src.data[i + 3] < 128) continue;
      const rgb = Array.from(src.data.subarray(i, i + 3)), light = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114;
      if (light > 140 && rgb[0] > rgb[2] * 1.06 && (y < h * .27 || y > h * .8 || x < w * .1 || x > w * .9)) skin.push({ rgb, light });
      if (light < 115 && y < h * .7) ink.push({ rgb, light });
    }
    const median = (list, fallback) => { list.sort((a, b) => a.light - b.light); return list[Math.floor(list.length * .4)]?.rgb || fallback; };
    const color = median(skin, [243, 202, 185]), line = median(ink, [63, 39, 53]);
    const out = canvas(w, h), ctx = out.getContext('2d'), pixels = ctx.createImageData(w, h);
    for (let i = 0; i < src.data.length; i += 4) { pixels.data.set(color, i); pixels.data[i + 3] = src.data[i + 3]; }
    ctx.putImageData(pixels, 0, 0);
    const edge = left => {
      let sum = 0, mass = 0;
      for (let x = Math.floor(w * (left ? .08 : .72)); x < w * (left ? .28 : .92); x++) for (let y = 0; y < h * .8; y++) {
        const i = (y * w + x) * 4, light = src.data[i] * .299 + src.data[i + 1] * .587 + src.data[i + 2] * .114;
        if (src.data[i + 3] > 128 && light < 110) { const weight = 110 - light; sum += y * weight; mass += weight; }
      }
      return mass ? sum / mass : h * .5;
    };
    const tilt = clamp(edge(false) - edge(true), -h * .28, h * .28), left = h * .49 - tilt / 2, right = h * .49 + tilt / 2;
    ctx.strokeStyle = 'rgb(' + line.join(',') + ')'; ctx.lineWidth = Math.max(1, w * .023); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w * .055, left); ctx.bezierCurveTo(w * .28, left + h * .2, w * .72, right + h * .2, w * .945, right); ctx.stroke();
    ctx.lineWidth = Math.max(1, w * .014);
    for (const [x, y, direction] of [[w * .08, left, -1], [w * .92, right, 1]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + direction * w * .045, y - h * .07); ctx.stroke(); }
    return out;
  }
  function prepareEyes(asset) {
    const { data, width, height, bounds: rect, image } = asset;
    if (!rect) return [];
    const mid = rect.x + rect.width / 2;
    let split = Math.round(mid), best = Infinity;
    for (let x = Math.floor(rect.x + rect.width * .25); x < rect.x + rect.width * .75; x++) {
      let mass = 0;
      for (let y = rect.y; y < rect.y + rect.height; y++) mass += data[(y * width + x) * 4 + 3] > 64 ? 1 : 0;
      const score = mass * width + Math.abs(x - mid);
      if (score < best) { best = score; split = x; }
    }
    return [
      bounds(data, width, height, { ...rect, width: split - rect.x }),
      bounds(data, width, height, { ...rect, x: split, width: rect.x + rect.width - split }),
    ].filter(Boolean).map(rect => { const open = crop(image, rect); return { rect, open, closed: closedEye(open) }; });
  }
  function prepareMouth(asset) {
    const { image, data, width, height } = asset, cw = width / 2, ch = height / 3;
    const cells = mouthKeys.map((key, index) => {
      const region = { x: index % 2 * cw, y: Math.floor(index / 2) * ch, width: cw, height: ch };
      const rect = bounds(data, width, height, region);
      if (!rect) return { key, rect: null };
      return { key, image: crop(image, rect), rect: { ...rect, x: rect.x - region.x, y: rect.y - region.y } };
    });
    const anchor = cells[0].rect || cells.find(cell => cell.rect)?.rect;
    for (const cell of cells) cell.offset = anchor && cell.rect ? {
      x: (anchor.x + anchor.width / 2 - cell.rect.x - cell.rect.width / 2) / cw * 100,
      y: (anchor.y + anchor.height / 2 - cell.rect.y - cell.rect.height / 2) / ch * 100,
    } : { x: 0, y: 0 };
    return { cells, cw, ch };
  }
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('キャラクター画像を読み込めませんでした。')); image.src = url;
    });
  }
  async function load(path) {
    if (assets.has(path)) return assets.get(path);
    const task = (async () => {
      const response = await fetch(path + '/manifest.json');
      if (!response.ok) throw new Error('キャラクターデータを読み込めませんでした。');
      const manifest = await response.json();
      if (manifest.format !== 'layer-motion-complete' || manifest.version !== 1 || !manifest.canvas?.width || !manifest.canvas?.height || !Array.isArray(manifest.layerOrder)) throw new Error('キャラクターデータの形式を確認してください。');
      const layers = {};
      await Promise.all(manifest.layerOrder.map(async key => {
        const image = await loadImage(path + '/' + manifest.files[key]);
        const asset = inspect(image);
        if (key === 'eyes') asset.eyes = prepareEyes(asset);
        if (key === 'mouth') {
          if (asset.width % 2 || asset.height % 3) throw new Error('口形データのサイズが正しくありません。');
          asset.mouth = prepareMouth(asset);
        }
        // Pixel arrays are only needed for the one-time geometry inspection.
        delete asset.data; layers[key] = asset;
      }));
      const closedEyes = manifest.files.closedEyes ? await loadImage(path + '/' + manifest.files.closedEyes) : null;
      return { manifest, layers, closedEyes };
    })().catch(error => { assets.delete(path); throw error; });
    assets.set(path, task); return task;
  }
  const around = (ctx, x, y, action) => { ctx.translate(x, y); action(); ctx.translate(-x, -y); };
  class MotionCharacter {
    constructor(root) {
      this.root = root; this.active = false; this.generation = 0; this.time = 0; this.frame = 0;
      this.lips = new window.HP_CHARACTER_LIPSYNC.LipSync();
      this.canvas = document.createElement('canvas'); this.canvas.setAttribute('aria-hidden', 'true');
      this.fallback = document.createElement('img'); this.fallback.alt = ''; this.fallback.hidden = true;
      root.replaceChildren(this.canvas);
      root.dataset.mouthShape = 'closed';
      this.onVoice = event => {
        if (event.detail.playing && event.detail.characterId === this.character?.id) this.lips.start(event.detail);
        else this.lips.stop();
        if (!event.detail.playing) { root.dataset.mouthShape = 'closed'; if (this.data) this.draw(); }
      };
      this.onVisibility = () => this.schedule();
      window.addEventListener('hp-home-voice-state', this.onVoice);
      document.addEventListener('visibilitychange', this.onVisibility);
      window.addEventListener('pagehide', this.onVisibility);
      this.resize = new ResizeObserver(() => { if (this.data) this.draw(); }); this.resize.observe(root);
    }
    async setCharacter(character) {
      const generation = ++this.generation;
      this.character = character; this.data = null; this.lips.stop(); this.time = 0;
      this.root.dataset.characterId = character.id; this.root.dataset.motionReady = 'false'; this.root.dataset.mouthShape = 'closed';
      this.canvas.hidden = true; this.fallback.remove(); this.fallback.hidden = true;
      try {
        const data = await load(character.motionDataPath);
        if (generation !== this.generation) return;
        this.data = data; this.root.style.setProperty('--motion-aspect', data.manifest.canvas.width + ' / ' + data.manifest.canvas.height);
        this.root.dataset.motionReady = 'true'; this.canvas.hidden = false; this.root.removeAttribute('data-motion-error'); this.draw(); this.schedule();
      } catch (error) {
        if (generation !== this.generation) return;
        this.fallback.src = character.previewImage; this.root.appendChild(this.fallback); this.fallback.hidden = false; this.root.dataset.motionError = error.message;
      }
    }
    setActive(active) { this.active = active; if (!active) this.lips.stop(); this.schedule(); }
    schedule() {
      cancelAnimationFrame(this.frame); this.frame = 0; this.previous = 0;
      if (!this.active || document.hidden || !this.data) return;
      const tick = now => {
        if (!this.active || document.hidden || !this.data) { this.frame = 0; return; }
        if (!this.previous || now - this.previous >= 1000 / 30) {
          if (this.previous) this.time += Math.min(.1, (now - this.previous) / 1000);
          this.previous = now; this.draw();
        }
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    }
    draw() {
      const { manifest, layers, closedEyes } = this.data, { width: w, height: h } = manifest.canvas;
      const target = Math.min(1536, Math.max(512, this.root.clientHeight * Math.min(devicePixelRatio || 1, 2)));
      const scale = target / h, cw = Math.round(w * scale), ch = Math.round(h * scale);
      if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
      const ctx = this.canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch); ctx.scale(cw / w, ch / h);
      const motion = manifest.motion || {}, time = this.time, ratio = clamp(number(motion.intensity, 25), 0, 100) / 100;
      const idle = (1 - Math.cos(time / 4.8 * Math.PI * 2)) / 2;
      around(ctx, w * .5, h * .6, () => {
        ctx.translate(0, -(.35 + ratio * 1.35) * idle); ctx.rotate(-(.2 + ratio * .7) * Math.cos(time / 4.8 * Math.PI * 2) * Math.PI / 180); ctx.scale(1, 1 + ratio * .009 * idle);
      });
      const shape = motion.mouthMotion === false ? 'closed' : this.lips.sample(this.character.id);
      this.root.dataset.mouthShape = shape;
      const phase = time % 5.2 / 5.2;
      const blink = motion.blink ? clamp(Math.min((phase - .43) / .012, (.47 - phase) / .014), 0, 1) : 0;
      this.root.dataset.blink = blink > .5 ? 'closed' : 'open';
      for (const key of manifest.layerOrder) {
        const asset = layers[key]; if (!asset || manifest.visibility?.[key] === false) continue;
        ctx.save();
        const transform = manifest.transforms?.[key] || {};
        ctx.translate(w * .5 + w * number(transform.x) / 100, h * .5 + h * number(transform.y) / 100);
        ctx.rotate(number(transform.rotation) * Math.PI / 180); ctx.scale(number(transform.scaleX, 100) / 100, number(transform.scaleY, 100) / 100); ctx.translate(-w * .5, -h * .5);
        const rect = asset.bounds, pivotX = rect ? (rect.x + rect.width / 2) / asset.width * w : w / 2, pivotY = rect ? (rect.y + rect.height * .06) / asset.height * h : h * .1;
        if (['back_hair', 'front_hair'].includes(key) && motion.hairMotion) around(ctx, pivotX, pivotY, () => {
          const period = key === 'back_hair' ? 3.6 : 3.15, amplitude = (.45 + ratio * 1.9) * (key === 'back_hair' ? .75 : .45);
          ctx.rotate(-amplitude * Math.cos(time / period * Math.PI * 2) * Math.PI / 180);
        });
        if (key === 'bust' && motion.bustMotion) around(ctx, pivotX, pivotY, () => {
          const strength = clamp(number(motion.bustStrength, 28), 0, 100) / 100;
          const slow = (100 - clamp(number(motion.bustSpeed, 58), 1, 100)) / 99, period = .75 + 11.25 * slow ** 3;
          const wave = Math.sin(time / period * Math.PI * 2);
          ctx.translate(strength * .00025 * w * wave, strength * .0022 * h * wave); ctx.rotate(strength * .12 * wave * Math.PI / 180); ctx.scale(1 + strength * .006 * wave, 1 - strength * .008 * wave);
        });
        if (key === 'mouth') {
          const cell = asset.mouth.cells[mouthKeys.indexOf(shape)];
          if (cell.rect) {
            const automatic = motion.mouthAutoAlign ? cell.offset : { x: 0, y: 0 }, manual = motion.mouthOffsets?.[shape] || {};
            ctx.translate((automatic.x + number(manual.x)) / 100 * w, (automatic.y + number(manual.y)) / 100 * h);
            const { rect } = cell; ctx.drawImage(cell.image, rect.x / asset.mouth.cw * w, rect.y / asset.mouth.ch * h, rect.width / asset.mouth.cw * w, rect.height / asset.mouth.ch * h);
          }
        } else if (key === 'eyes') {
          for (const eye of asset.eyes) {
            const rect = eye.rect, x = rect.x / asset.width * w, y = rect.y / asset.height * h, width = rect.width / asset.width * w, height = rect.height / asset.height * h;
            ctx.globalAlpha = 1 - blink; ctx.drawImage(eye.open, x, y, width, height);
            if (!closedEyes && blink) { ctx.globalAlpha = blink; ctx.drawImage(eye.closed, x, y, width, height); }
          }
          if (closedEyes && blink) { ctx.globalAlpha = blink; ctx.drawImage(closedEyes, 0, 0, w, h); }
        } else ctx.drawImage(asset.image, 0, 0, w, h);
        ctx.restore();
      }
    }
    destroy() {
      this.generation++; this.active = false; cancelAnimationFrame(this.frame); this.lips.stop(); this.resize.disconnect();
      window.removeEventListener('hp-home-voice-state', this.onVoice); document.removeEventListener('visibilitychange', this.onVisibility); window.removeEventListener('pagehide', this.onVisibility);
    }
  }
  window.HP_MOTION_CHARACTER = Object.freeze({ MotionCharacter, preload: character => load(character.motionDataPath) });
})();
