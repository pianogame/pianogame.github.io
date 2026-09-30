/** Browser regression check for the HOME layout and HOME <-> PIANO navigation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../_site');
const output = path.resolve(process.env.HOME_QA_OUTPUT || 'home-layout-qa');
fs.mkdirSync(output, { recursive: true });
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webmanifest':'application/manifest+json', '.mp3':'audio/mpeg', '.m4a':'audio/mp4', '.wav':'audio/wav' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader'],
  } : {}),
});
const cases = [
  ['reference-16x9',1536,864,{}],
  ['supplied-wide',1536,709,{}],
  ['iphone15pm',932,430,{l:59,r:59,b:21}],
  ['iphone14',844,390,{l:47,r:47,b:21}],
  ['android20x9',915,412,{}],
  ['small-landscape',667,375,{}],
  ['short-landscape',568,320,{}],
  ['portrait-rotation',430,932,{t:59,b:34}],
];
const results = [];
async function inspect(page) {
  return page.evaluate(() => {
    const home = document.querySelector('#hp-home-screen');
    const rect = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}; };
    const overlap = (a,b) => Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
    const failures = [];
    const selectors = ['.hp-home-logo','.hp-home-voice-card','.hp-home-campaign','.hp-home-mode','.hp-home-top-button','.hp-home-bottom-button'];
    const panels = [...home.querySelectorAll(selectors.join(','))].map(el => ({el,r:rect(el),name:el.getAttribute('aria-label')||el.className}));
    for (const {el,r,name} of panels) {
      if (r.x < -1 || r.y < -1 || r.right > innerWidth+1 || r.bottom > innerHeight+1) failures.push('outside screen: '+name);
      if (el.scrollWidth > el.clientWidth+1) failures.push('horizontal overflow: '+name);
      if (el.tagName==='BUTTON' && Math.min(r.w,r.h)<43.5) failures.push('tap target smaller than 44px: '+name);
    }
    for (let i=0;i<panels.length;i++) for (let j=i+1;j<panels.length;j++) {
      if (overlap(panels[i].r,panels[j].r)) failures.push('overlap: '+panels[i].name+' / '+panels[j].name);
    }
    for (const selector of ['.hp-home-voice-card','.hp-home-campaign','.hp-home-hud']) {
      const panel=home.querySelector(selector), bounds=rect(panel);
      for (const el of panel.querySelectorAll('.hp-home-voice-line,.hp-home-campaign-copy,.hp-home-level,.hp-home-player-name,.hp-home-stamina-value')) {
        if (el.scrollWidth>el.clientWidth+1) failures.push('text wider than its own column: '+el.className);
        const range=document.createRange(); range.selectNodeContents(el);
        for (const r of range.getClientRects()) {
          if (r.left<bounds.x-1 || r.right>bounds.right+1 || r.top<Math.max(0,bounds.y)-1 || r.bottom>bounds.bottom+1) failures.push('clipped text: '+el.className);
        }
      }
    }
    for (const img of home.querySelectorAll('img')) {
      if (!img.complete || !img.naturalWidth) failures.push('missing image: '+img.src);
      if (img.classList.contains('hp-home-bg')) continue;
      // offset dimensions stay in layout coordinates when the viewport is rotated.
      if (Math.abs(img.clientWidth / img.clientHeight - img.naturalWidth / img.naturalHeight)>.04) failures.push('distorted image: '+img.src);
    }
    if (document.documentElement.scrollWidth > innerWidth+1) failures.push('document horizontal overflow');
    return {failures,viewport:{width:innerWidth,height:innerHeight},unit:home.style.getPropertyValue('--home-unit'),panels:panels.map(({name,r})=>({name,...r}))};
  });
}
try {
  for (const [name,width,height,insets] of cases) {
    const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:true});
    await context.addInitScript(() => Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>true}));
    const page=await context.newPage(), errors=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, {waitUntil:'networkidle'});
    if (name==='iphone15pm') {
      // Exercise the actual opening flow in one case. Other cases isolate layout.
      const orientation=page.locator('.hp-opening-orientation.hp-ready');
      await orientation.waitFor({state:'visible',timeout:15000});
      await orientation.click();
      await page.waitForFunction(() => document.querySelector('.hp-opening-orientation')?.classList.contains('hp-wave-armed'));
      await page.mouse.move(350,210); await page.mouse.down();
      await page.mouse.move(510,210,{steps:10}); await page.mouse.up();
      await page.locator('.hp-opening-title.hp-show').waitFor({state:'visible'});
      await page.locator('.hp-opening-title').click();
      await page.waitForFunction(() => !document.body.classList.contains('hp-booting'));
      await page.locator('#hp-opening-sequence').waitFor({state:'hidden'});
    } else {
      await page.evaluate(() => { document.body.classList.remove('hp-booting'); document.querySelector('#hp-opening-sequence')?.remove(); });
    }
    await page.locator('#hp-home-screen').evaluate((el,insets) => {
      for (const [side,value] of Object.entries(insets)) el.style.setProperty('--safe-'+side,value+'px');
    }, insets);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const metrics=await inspect(page);
    await page.screenshot({path:path.join(output,name+'.png')});
    metrics.failures.push(...errors);
    results.push({name,...metrics});
    assert.deepEqual(metrics.failures,[],name+': '+metrics.failures.join('; '));
    if (name==='iphone15pm') {
      const oldUnit=metrics.unit;
      await page.getByRole('button',{name:'ピアノモードへ',exact:true}).click();
      await page.locator('#hp-home-screen').waitFor({state:'hidden'});
      await page.locator('#hp-four88').waitFor({state:'visible'});
      await page.getByRole('button',{name:'ホームへ戻る',exact:true}).click();
      await page.locator('#hp-home-screen').waitFor({state:'visible'});
      const returned=await inspect(page);
      assert.equal(returned.unit,oldUnit,'home dimensions changed after returning from piano');
      assert.deepEqual(returned.failures,[],'layout after returning from piano');
      // Desktop Chromium cannot resize a fullscreen window through CDP. A PWA
      // rotates through the OS; restore the test window before emulating that.
      await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
      await page.setViewportSize({width:430,height:932});
      await page.waitForFunction(() => document.documentElement.dataset.hpRotated==='true');
      await page.setViewportSize({width:932,height:430});
      await page.waitForFunction(() => document.documentElement.dataset.hpRotated==='false');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.deepEqual((await inspect(page)).failures,[],'layout after rotation');
      assert.deepEqual(errors,[],'navigation errors');
      console.log('PASS opening -> HOME -> PIANO -> HOME -> rotate -> HOME');
    }
    console.log('PASS '+name+' '+width+'x'+height);
    await context.close();
  }
} finally {
  fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(results,null,2));
  await browser.close(); server.close();
}
