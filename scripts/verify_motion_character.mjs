/** HOME character replacement, audio clock lip-sync, persistence and extensibility. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../_site');
const output = path.resolve(process.env.MOTION_QA_OUTPUT || '../motion-character-qa');
fs.mkdirSync(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff': 'font/woff' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.MOTION_QA_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args: ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
} : {}) });
async function openHome(page) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.hp-opening-orientation.hp-ready').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('.hp-opening-orientation').click();
  await page.waitForFunction(() => document.querySelector('.hp-opening-orientation')?.classList.contains('hp-wave-armed'));
  const box = await page.locator('.hp-opening-orientation').boundingBox();
  await page.mouse.move(box.x + box.width * .3, box.y + box.height * .5); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .5, { steps: 12 }); await page.mouse.up();
  await page.locator('.hp-opening-title.hp-show').waitFor({ state: 'visible' }); await page.locator('.hp-opening-title').click();
  await page.locator('#hp-opening-sequence').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('[data-home-motion]').dataset.motionReady === 'true', null, { timeout: 20000 });
}
async function contextWithSpeech() {
  const context = await browser.newContext({ viewport: { width: 932, height: 430 }, hasTouch: true });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { get: () => true });
    window.speeches = []; window.mouthSamples = []; window.blinkStates = new Set();
    window.addEventListener('hp-home-voice-state', event => {
      if (event.detail.playing) { window.speech = event.detail; window.speeches.push({ file: event.detail.file, characterId: event.detail.characterId }); }
      else window.speech = null;
    });
    setInterval(() => {
      const root = document.querySelector('[data-home-motion]'); if (!root || document.hidden || document.querySelector('#hp-home-screen').hidden) return;
      window.blinkStates.add(root.dataset.blink);
      if (window.speech) {
        const { context, startedAt, buffer } = window.speech;
        const analysis = window.HP_CHARACTER_LIPSYNC.analyze(buffer), frame = Math.floor((context.currentTime - startedAt) / analysis.step);
        const silent = [-2, -1, 0, 1, 2].every(offset => !analysis.audible[frame + offset]);
        window.mouthSamples.push({ shape: root.dataset.mouthShape, silent });
      }
    }, 20);
  });
  return context;
}
try {
  const context = await contextWithSpeech(); const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openHome(page);
  assert.equal(await page.locator('[data-home-motion]').getAttribute('data-character-id'), 'character01');
  assert.equal(await page.locator('img.hp-home-character').count(), 0, 'old character removed');
  assert.equal(await page.locator('img[src*="29613917"]').count(), 0, 'no hidden old character image');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hp-home-character-v1')).homeCharacterId), 'character01', 'initial formal choice is persisted');
  await page.screenshot({ path: path.join(output, 'home-iphone.png') });
  await page.waitForFunction(() => document.querySelector('#hp-home-screen').dataset.voicePlaying === 'false', null, { timeout: 12000 });
  const speech = await page.evaluate(() => ({ samples: window.mouthSamples, blink: [...window.blinkStates], starts: window.speeches }));
  assert.ok(new Set(speech.samples.map(sample => sample.shape)).size >= 4, 'several speech vowel shapes');
  assert.ok(speech.samples.filter(sample => sample.silent).length > 5, 'actual waveform silence checked');
  assert.ok(speech.samples.filter(sample => sample.silent).every(sample => sample.shape === 'closed'), 'silence closes the mouth');
  assert.deepEqual(new Set(speech.blink.filter(Boolean)), new Set(['open', 'closed']));
  assert.equal(await page.locator('[data-home-motion]').getAttribute('data-mouth-shape'), 'closed');
  assert.deepEqual(await page.evaluate(() => HP_CHARACTER_LIPSYNC.vowels('キャットコーヒー')), ['a', 'closed', 'o', 'o', 'o', 'i', 'i']);
  await page.getByRole('button', { name: 'キャラクター', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-character-preview]').dataset.motionReady === 'true');
  assert.equal(await page.locator('[data-character-choice]').count(), 1);
  const setButton = page.locator('[data-home-action="set-home-character"]');
  for (let i = 0; i < 3; i++) await setButton.click();
  assert.equal(await setButton.textContent(), 'ホームに設定中');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hp-home-character-v1')).homeCharacterId), 'character01');
  await page.screenshot({ path: path.join(output, 'characters-iphone.png') });
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  // Returning from the selector must leave the same renderer usable immediately.
  await page.getByRole('button', { name: 'キャラクターと話す', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-home-motion]').dataset.mouthShape !== 'closed');
  await page.getByRole('button', { name: 'キャラクター', exact: true }).click();
  assert.equal(await page.locator('[data-home-motion]').getAttribute('data-mouth-shape'), 'closed');
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await openHome(page);
  assert.equal(await page.evaluate(() => HP_CHARACTER_SETTINGS.getHomeCharacterId()), 'character01');
  const storage = await context.storageState(); await context.close();
  const restarted = await browser.newContext({ viewport: { width: 932, height: 430 }, storageState: storage });
  await restarted.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
  const fresh = await restarted.newPage(); await openHome(fresh);
  assert.equal(await fresh.evaluate(() => HP_CHARACTER_SETTINGS.getHomeCharacterId()), 'character01');
  for (const [name, width, height] of [['android', 915, 412], ['small', 568, 320], ['desktop', 1536, 864], ['portrait', 430, 932]]) {
    await fresh.setViewportSize({ width, height });
    await fresh.waitForTimeout(350);
    await fresh.getByRole('button', { name: 'キャラクター', exact: true }).click();
    const layout = await fresh.locator('.hp-home-dialog').evaluate(el => ({ overflow: el.scrollWidth > el.clientWidth + 1 }));
    assert.equal(layout.overflow, false, name + ' dialog horizontal overflow');
    await fresh.screenshot({ path: path.join(output, 'characters-' + name + '.png') });
    await fresh.getByRole('button', { name: '閉じる', exact: true }).click();
  }
  await restarted.close(); assert.deepEqual(errors, []);
  console.log('PASS official character: replacement, actual audio vowels/silence/end, blinking, selector, repeated save, reload/new context, phone/desktop/rotation');

  if (!process.env.MOTION_QA_URL) {
    // Fixtures exist only in intercepted test responses, never in the shipped registry.
    // Character02/03 require definitions only, and share the same production renderer.
    const multi = await contextWithSpeech();
    await multi.route('**/characters.js*', route => {
      let source = fs.readFileSync(path.join(root, 'characters.js'), 'utf8');
      source = source.replace("  const defaultId = 'character01';", `  voiceSets.test02 = { entries: [{ file: 'okaeri', lines: ['2人目のメッセージ'], reading: 'おかえりなさい' }], audioBasePath: '/audio' };
  characters.push({ ...characters[0], id: 'character02', name: 'テスト02', voiceSetId: 'test02' });
  characters.push({ ...characters[0], id: 'character03', name: 'テスト03' });
  const defaultId = 'character01';`);
      return route.fulfill({ contentType: 'text/javascript', body: source });
    });
    const test = await multi.newPage(); await openHome(test);
    await test.getByRole('button', { name: 'キャラクター', exact: true }).click();
    assert.equal(await test.locator('[data-character-choice]').count(), 3);
    await test.getByRole('button', { name: 'テスト02', exact: true }).click();
    await test.locator('[data-home-action="set-home-character"]').click();
    assert.equal(await test.evaluate(() => HP_CHARACTER_SETTINGS.getHomeCharacterId()), 'character02');
    await test.getByRole('button', { name: '閉じる', exact: true }).click();
    await test.waitForFunction(() => document.querySelector('[data-home-motion]').dataset.characterId === 'character02' && document.querySelector('[data-home-motion]').dataset.motionReady === 'true');
    await test.waitForFunction(() => window.speeches.at(-1)?.characterId === 'character02');
    assert.equal(await test.locator('[data-home-dialogue]').textContent(), '2人目のメッセージ');
    assert.equal(await test.evaluate(() => window.speeches.at(-1).file), 'okaeri');
    await test.waitForFunction(() => document.querySelector('[data-home-motion]').dataset.mouthShape !== 'closed');
    await openHome(test);
    assert.equal(await test.evaluate(() => HP_CHARACTER_SETTINGS.getHomeCharacterId()), 'character02', 'non-default selection persists');
    await test.getByRole('button', { name: 'キャラクター', exact: true }).click();
    await test.getByRole('button', { name: 'テスト03', exact: true }).click();
    await test.evaluate(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) { if (key === 'hp-home-character-v1') throw new Error('quota'); return set.call(this, key, value); };
    });
    await test.locator('[data-home-action="set-home-character"]').click();
    assert.match(await test.locator('[data-character-status]').textContent(), /保存できません/);
    assert.equal(await test.evaluate(() => HP_CHARACTER_SETTINGS.getHomeCharacterId()), 'character02', 'failed save does not replace active character');
    const status = await test.evaluate(() => HP_CHARACTER_SETTINGS.setHomeCharacter('missing'));
    assert.equal(status.ok, false);
    const motion = await test.evaluate(async () => {
      const root = document.createElement('div'); root.style.cssText = 'position:absolute;width:512px;height:768px';
      document.body.appendChild(root);
      const renderer = new HP_MOTION_CHARACTER.MotionCharacter(root);
      await renderer.setCharacter(HP_CHARACTERS.get('character01'));
      const settings = renderer.data.manifest.motion;
      const initialHair = settings.hairMotion;
      renderer.time = 1;
      settings.hairMotion = true; renderer.draw(); const moving = renderer.canvas.toDataURL();
      settings.hairMotion = false; renderer.draw(); const still = renderer.canvas.toDataURL();
      settings.hairMotion = initialHair;
      renderer.destroy(); root.remove();
      return moving !== still;
    });
    assert.equal(motion, true, 'hair motion actually changes rendered pixels');
    // Waveform rather than visible text controls silence; a zero buffer is silent throughout.
    assert.equal(await test.evaluate(() => {
      const buffer = new AudioBuffer({ length: 48000, sampleRate: 48000 });
      const analysis = HP_CHARACTER_LIPSYNC.analyze(buffer); return analysis.audible.some(Boolean);
    }), false);
    await multi.close();
    console.log('PASS definition-only character02/03: dynamic list, immediate switch, character-specific voice/message/lips, non-default persistence, failed/invalid saves, silent waveform, rendered hair motion');
  }
} finally { await browser.close(); server.close(); }
