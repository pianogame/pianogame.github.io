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
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webmanifest':'application/manifest+json', '.mp3':'audio/mpeg', '.m4a':'audio/mp4', '.wav':'audio/wav' };
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
// Pixel measurements from the user-supplied 1536x864 concept, including the
// outer ornament padding. This catches undersized 3:1 replacement artwork.
const referenceBounds = {
  '.hp-home-game-image': [1009,170,511,235],
  '.hp-home-piano-image': [1009,407,511,236],
  '.hp-home-voice-card': [364,293,282,154],
  '.hp-home-campaign': [18,663,382,174],
  '.hp-home-logo': [20,88.3125,490,163.3333],
};
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
      for (const el of panel.querySelectorAll('.hp-home-dialogue span,.hp-home-voice-line,.hp-home-campaign-copy,.hp-home-level,.hp-home-player-name,.hp-home-stamina-value')) {
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
    for (const art of home.querySelectorAll('.hp-home-reference-art')) {
      const vb=art.viewBox.baseVal;
      if (Math.abs(art.clientWidth / art.clientHeight - vb.width / vb.height)>.025) failures.push('distorted reference sprite: '+art.parentElement.getAttribute('aria-label'));
      if (!art.querySelector('image')?.href.baseVal.includes('home-reference-v1.jpg')) failures.push('reference sprite source missing');
    }
    const menus=[...home.querySelectorAll('.hp-home-bottom-button')];
    const gaps=menus.slice(1).map((el,i)=>el.offsetLeft-menus[i].offsetLeft-menus[i].offsetWidth);
    if (Math.max(...menus.map(el=>el.offsetWidth))-Math.min(...menus.map(el=>el.offsetWidth))>1 || Math.abs(gaps[0]-gaps[1])>1) failures.push('bottom menus are not equal columns with equal gaps');
    const safe=home.querySelector('.hp-home-safe');
    const expectedRight=16*parseFloat(home.style.getPropertyValue('--home-width-unit'));
    for (const selector of ['.hp-home-modes','.hp-home-top-actions']) {
      const el=home.querySelector(selector);
      const right=home.clientWidth-safe.offsetLeft-el.offsetLeft-el.offsetWidth;
      if (Math.abs(right-expectedRight)>1.5) failures.push('right controls are inset from the screen edge: '+selector);
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
      const viewportPolicy=await page.locator('meta[name="viewport"]').getAttribute('content');
      assert.match(viewportPolicy,/maximum-scale=1/);
      assert.match(viewportPolicy,/user-scalable=no/);
      const zoomGuards=await page.evaluate(() => {
        const gesture=new Event('gesturestart',{bubbles:true,cancelable:true});
        document.dispatchEvent(gesture);
        const multi=new Event('touchmove',{bubbles:true,cancelable:true});
        Object.defineProperty(multi,'touches',{value:[{},{}]});
        document.dispatchEvent(multi);
        return {gesture:gesture.defaultPrevented,multi:multi.defaultPrevented};
      });
      assert.deepEqual(zoomGuards,{gesture:true,multi:true},'browser zoom guards');
      const openingBounds=await page.locator('#hp-opening-sequence').evaluate(el=>{
        const r=el.getBoundingClientRect();
        return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight};
      });
      assert.ok(openingBounds.left<=.5 && openingBounds.top<=.5 && openingBounds.right>=openingBounds.width-.5 && openingBounds.bottom>=openingBounds.height-.5,'opening does not cover viewport');
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
    // SVG image loading is independent of the HTMLImageElement checks below.
    await page.evaluate(async () => {
      const src=document.querySelector('.hp-home-reference-art image').href.baseVal;
      const img=new Image(); img.src=src; await img.decode();
      if (img.naturalWidth!==1536 || img.naturalHeight!==864) throw new Error('reference atlas dimensions changed');
    });
    const metrics=await inspect(page);
    if (name==='reference-16x9') {
      const measured=await page.evaluate((bounds) => Object.entries(bounds).map(([selector,target]) => {
        const r=document.querySelector(selector).getBoundingClientRect();
        return {selector,target,actual:[r.x,r.y,r.width,r.height]};
      }),referenceBounds);
      metrics.reference=measured;
      for (const {selector,target,actual} of measured) {
        if (actual.some((value,i)=>Math.abs(value-target[i])>1)) metrics.failures.push('reference size/position mismatch: '+selector+' '+JSON.stringify(actual));
      }
      const typography=await page.evaluate(() => ['.hp-home-level','.hp-home-stamina-value'].map(s=> {
        const el=document.querySelector(s),r=el.getBoundingClientRect(),c=getComputedStyle(el);
        return {selector:s,size:parseFloat(c.fontSize),weight:c.fontWeight,style:c.fontStyle,center:[r.x+r.width/2,r.y+r.height/2]};
      }));
      metrics.typography=typography;
      for (const t of typography) if (t.weight!=='400') metrics.failures.push('reference numbers too bold: '+t.selector);
      if (typography[0].size>29 || typography[1].size>23) metrics.failures.push('reference numbers too large');
      if (typography[1].style!=='normal') metrics.failures.push('stamina should use upright reference numerals');
      const playerCenter=await page.locator('.hp-home-player-name').evaluate(el=>el.offsetTop+el.offsetHeight/2);
      const hudHeight=await page.locator('.hp-home-hud').evaluate(el=>el.clientHeight);
      if (Math.abs(playerCenter-hudHeight*.36)>1) metrics.failures.push('player name not centered in upper half of HUD');
      for (const [i,target] of [[0,[645,60]],[1,[859,69]]]) if (typography[i].center.some((v,j)=>Math.abs(v-target[j])>2)) metrics.failures.push('reference number position mismatch: '+typography[i].selector);
    }
    await page.screenshot({path:path.join(output,name+'.png')});
    metrics.failures.push(...errors);
    results.push({name,...metrics});
    assert.deepEqual(metrics.failures,[],name+': '+metrics.failures.join('; '));
    if (name==='iphone15pm') {
      const oldUnit=metrics.unit;
      // Real pointer taps must reach the character and change the live text.
      const dialogue=page.locator('[data-home-dialogue]');
      const first=await dialogue.textContent(), messages=new Set([first]);
      for (let i=0;i<4;i++) {
        await page.getByRole('button',{name:'キャラクターと話す',exact:true}).click();
        messages.add(await dialogue.textContent());
        assert.deepEqual((await inspect(page)).failures,[],'dialogue overflow');
      }
      assert.equal(messages.size,5,'expected five distinct character messages');
      await dialogue.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      await page.screenshot({path:path.join(output,'character-message.png')});
      await page.getByRole('button',{name:'キャラクターと話す',exact:true}).click();
      assert.equal(await dialogue.textContent(),first,'character messages should cycle');
      const beforeUrl=page.url();
      const game=page.getByRole('button',{name:'ゲームモード',exact:true});
      await game.click();
      await page.waitForFunction(()=>document.querySelector('#hp-home-screen').classList.contains('hp-game-previewing'));
      await page.waitForTimeout(160);
      assert.ok(await page.locator('.hp-home-launch-fx').evaluate(el=>parseFloat(getComputedStyle(el).opacity)>.1),'game effect did not become visible');
      await page.screenshot({path:path.join(output,'game-tap-effect.png')});
      await page.waitForFunction(()=>!document.querySelector('#hp-home-screen').classList.contains('hp-game-previewing'));
      assert.equal(page.url(),beforeUrl,'game preview must not navigate');
      assert.ok(await page.locator('#hp-home-screen').isVisible(),'game preview must stay on HOME');
      assert.ok(await page.locator('#hp-four88').isHidden(),'game preview must not open PIANO');
      assert.equal(await page.locator('.hp-home-launch-fx').evaluate(el=>getComputedStyle(el).opacity),'0','game effect did not clear');
      // A piano tap can interrupt an in-flight game preview safely.
      await game.click();
      await game.click();
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
      await game.click();
      const rotatedOrigin=await page.evaluate(() => {
        const home=document.querySelector('#hp-home-screen'),button=document.querySelector('[data-home-action="game"]');
        const safe=home.querySelector('.hp-home-safe'),stack=button.offsetParent;
        return {actual:[parseFloat(home.style.getPropertyValue('--hp-mode-center-x')),parseFloat(home.style.getPropertyValue('--hp-mode-center-y'))],expected:[safe.offsetLeft+stack.offsetLeft+button.offsetLeft+button.offsetWidth/2,safe.offsetTop+stack.offsetTop+button.offsetTop+button.offsetHeight/2]};
      });
      assert.deepEqual(rotatedOrigin.actual,rotatedOrigin.expected,'rotated game sparkle origin');
      await page.waitForFunction(()=>!document.querySelector('#hp-home-screen').classList.contains('hp-game-previewing'));
      await page.setViewportSize({width:932,height:430});
      await page.waitForFunction(() => document.documentElement.dataset.hpRotated==='false');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.deepEqual((await inspect(page)).failures,[],'layout after rotation');
      assert.deepEqual(errors,[],'navigation errors');
      await page.emulateMedia({reducedMotion:'reduce'});
      await game.click();
      await page.waitForFunction(()=>!document.querySelector('#hp-home-screen').classList.contains('hp-game-previewing'));
      assert.ok(await page.locator('#hp-home-screen').isVisible(),'reduced-motion game preview changed screen');
      assert.equal(await page.locator('.hp-home-launch-fx').evaluate(el=>getComputedStyle(el).opacity),'0');
      console.log('PASS five dialogues; repeat game preview; reduced motion; opening -> HOME -> PIANO -> HOME -> rotate -> HOME');
    }
    console.log('PASS '+name+' '+width+'x'+height);
    await context.close();
  }
} finally {
  fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(results,null,2));
  await browser.close(); server.close();
}
