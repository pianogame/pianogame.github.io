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
const requestedCases=process.env.HOME_QA_CASES?.split(',');
const cases = [
  ['reference-16x9',1536,864,{}],
  ['supplied-wide',1536,709,{}],
  ['iphone15pm',932,430,{l:59,r:59,b:21}],
  ['iphone14',844,390,{l:47,r:47,b:21}],
  ['android20x9',915,412,{}],
  ['small-landscape',667,375,{}],
  ['short-landscape',568,320,{}],
  ['portrait-rotation',430,932,{t:59,b:34}],
].filter(([name])=>!requestedCases||requestedCases.includes(name));
const results = [];
// Pixel measurements from the user-supplied 1536x864 concept, including the
// outer ornament padding. This catches undersized 3:1 replacement artwork.
const referenceBounds = {
  '.hp-home-game-image': [1009,170,511,236],
  '.hp-home-piano-image': [1009,408,511,236],
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
    const modes=[...home.querySelectorAll('.hp-home-mode')];
    if (Math.abs(modes[0].offsetWidth-modes[1].offsetWidth)>0 || Math.abs(modes[0].offsetHeight-modes[1].offsetHeight)>0) failures.push('game and piano buttons have different sizes');
    for (const mode of modes) {
      const copy=mode.querySelector('.hp-home-mode-copy');
      // offset coordinates remain valid when the entire app rotates.
      if (Math.abs(copy.offsetTop-mode.clientHeight/2)>1) failures.push('mode text is not vertically centered');
      if (copy.scrollWidth>copy.clientWidth+1) failures.push('mode text overflows its column');
      if (copy.offsetHeight>mode.clientHeight*.83) failures.push('mode text touches the frame');
    }
    const menus=[...home.querySelectorAll('.hp-home-bottom-button')];
    const gaps=menus.slice(1).map((el,i)=>el.offsetLeft-menus[i].offsetLeft-menus[i].offsetWidth);
    if (Math.max(...menus.map(el=>el.offsetWidth))-Math.min(...menus.map(el=>el.offsetWidth))>1 || Math.abs(gaps[0]-gaps[1])>1) failures.push('bottom menus are not equal columns with equal gaps');
    if (Math.max(...menus.map(el=>el.offsetHeight))-Math.min(...menus.map(el=>el.offsetHeight))>1 || Math.max(...menus.map(el=>el.offsetTop))-Math.min(...menus.map(el=>el.offsetTop))>1) failures.push('bottom menus have different heights or vertical positions');
    for (const menu of menus) {
      const art=menu.querySelector('.hp-home-reference-art');
      const image=art.querySelector('image');
      const bounds=art.querySelector('clipPath path').getBBox();
      const matrix=art.getScreenCTM().inverse().multiply(image.getScreenCTM());
      const start=new DOMPoint(bounds.x,bounds.y).matrixTransform(matrix);
      const end=new DOMPoint(bounds.x+bounds.width,bounds.y+bounds.height).matrixTransform(matrix);
      if (Math.abs(start.x-3)>.01 || Math.abs(start.y-2)>.01 || Math.abs(end.x-280)>.01 || Math.abs(end.y-149)>.01) failures.push('bottom menu painted frame differs: '+menu.getAttribute('aria-label'));
    }
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
    if (name==='android20x9') {
      // Fullscreen manifest launch is different from navigator.standalone on iOS.
      await context.addInitScript(() => {
        const native=window.matchMedia.bind(window);
        window.matchMedia=query=>{
          const media=native(query);
          if(query==='(display-mode: fullscreen)') Object.defineProperty(media,'matches',{get:()=>true});
          return media;
        };
      });
    } else {
      await context.addInitScript(() => Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>true}));
    }
    await context.addInitScript(() => {
      window.homeTapPlays = 0;
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function(...args) {
        if (this.src.includes('home-button-tap.mp3')) window.homeTapPlays++;
        return play.apply(this,args);
      };
    });
    const page=await context.newPage(), errors=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, {waitUntil:'networkidle'});
    if (name==='iphone15pm' || name==='portrait-rotation') {
      // The first white screen is outside the rotated HOME viewport.
      await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerdown',{clientX:80,clientY:120,button:0,bubbles:true})));
      const openingTouch=await page.locator('.hp-opening-touch-layer .hp-home-touch-effect').last().evaluate(el=>({
        x:parseFloat(el.style.left),y:parseFloat(el.style.top),light:el.classList.contains('hp-touch-on-light'),
        parent:el.parentElement.parentElement.tagName,position:getComputedStyle(el.parentElement).position,
        z:Number(getComputedStyle(el.parentElement).zIndex),openingZ:Number(getComputedStyle(document.querySelector('#hp-opening-sequence')).zIndex),
        pointerEvents:getComputedStyle(el.parentElement).pointerEvents
      }));
      assert.deepEqual([openingTouch.x,openingTouch.y],[80,120],'opening ripple must follow screen coordinates');
      assert.equal(openingTouch.light,true,'white-screen notes must use a visible gold color');
      assert.equal(openingTouch.parent,'BODY');
      assert.equal(openingTouch.position,'fixed');
      assert.ok(openingTouch.z>openingTouch.openingZ,'opening ripple must appear above the white cover');
      assert.equal(openingTouch.pointerEvents,'none','effects must not intercept the opening gesture');
      await page.waitForTimeout(90);
      await page.screenshot({path:path.join(output,name+'-white-touch-effect.png')});
    }
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
      const pendingCoverRule=await page.evaluate(()=>{
        const opening=document.querySelector('#hp-opening-sequence');
        const inner=opening.querySelector('.hp-opening-orientation-inner');
        opening.classList.add('hp-layout-pending');
        const opacity=getComputedStyle(inner).opacity;
        opening.classList.remove('hp-layout-pending');
        return opacity;
      });
      assert.equal(pendingCoverRule,'0','startup white cover must hide orientation content while viewport settles');
      const openingBounds=await page.locator('#hp-opening-sequence').evaluate(el=>{
        const r=el.getBoundingClientRect(), style=getComputedStyle(el);
        return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,parent:el.parentElement?.tagName,position:style.position};
      });
      assert.equal(openingBounds.parent,'BODY','opening orientation must stay outside the rotated app viewport');
      assert.equal(openingBounds.position,'fixed','opening must be viewport-fixed');
      assert.ok(openingBounds.left<=.5 && openingBounds.top<=.5 && openingBounds.right>=openingBounds.width-.5 && openingBounds.bottom>=openingBounds.height-.5,'opening does not cover viewport');
      const bootState=await page.evaluate(()=>({
        booting:document.body.classList.contains('hp-booting'),
        orientationBg:document.documentElement.classList.contains('hp-opening-orientation-bg'),
        viewportVisibility:getComputedStyle(document.querySelector('#hp-viewport')).visibility,
        openingVisibility:getComputedStyle(document.querySelector('#hp-opening-sequence')).visibility,
        rootBackground:getComputedStyle(document.documentElement).backgroundColor,
        bodyBackground:getComputedStyle(document.body).backgroundColor
      }));
      assert.equal(bootState.booting,true,'boot guard must remain active before the curtain finishes');
      assert.equal(bootState.orientationBg,true,'portrait opening background class must exist before first curtain paint');
      assert.equal(bootState.viewportVisibility,'hidden','HOME must stay hidden behind the opening during boot');
      assert.equal(bootState.openingVisibility,'visible','opening must remain visible while HOME is hidden');
      assert.equal(bootState.rootBackground,'rgb(255, 255, 255)','portrait orientation root background must stay white');
      assert.equal(bootState.bodyBackground,'rgb(255, 255, 255)','portrait orientation body background must stay white');
      await page.waitForFunction(() => document.querySelector('#hp-opening-sequence')?.dataset.layoutStable==='true',{timeout:3000});
      assert.equal(await page.locator('#hp-opening-sequence').evaluate(el=>el.classList.contains('hp-layout-pending')),false,'startup layout gate did not release');
      const orientation=page.locator('.hp-opening-orientation.hp-ready');
      await orientation.waitFor({state:'visible',timeout:15000});
      await orientation.click();
      await page.waitForFunction(() => document.querySelector('.hp-opening-orientation')?.classList.contains('hp-wave-armed'));
      await page.mouse.move(350,210); await page.mouse.down();
      await page.mouse.move(510,210,{steps:10}); await page.mouse.up();
      await page.locator('.hp-opening-title.hp-show').waitFor({state:'visible'});
      assert.deepEqual(await page.evaluate(()=>({
        orientation:document.documentElement.classList.contains('hp-opening-orientation-bg'),
        curtain:document.documentElement.classList.contains('hp-opening-curtain-bg')
      })),{orientation:false,curtain:true},'opening phase background did not switch to curtain');
      // Reproduce a landscape PWA cold launch retaining the pre-launch height.
      // The installed screen remains 932x430 while all viewport height reports
      // briefly say 371px; the curtain must still paint the whole screen.
      for(const staleHeight of [371,932]) {
        const coldLaunch=await page.evaluate(staleHeight=>{
          const opening=document.querySelector('#hp-opening-sequence');
          const restore=[];
          for(const [object,key] of [[window,'innerHeight'],[document.documentElement,'clientHeight'],[visualViewport,'height']]) {
            const descriptor=Object.getOwnPropertyDescriptor(object,key);
            Object.defineProperty(object,key,{configurable:true,get:()=>staleHeight});
            restore.push(()=>descriptor?Object.defineProperty(object,key,descriptor):delete object[key]);
          }
          opening.style.setProperty('--hp-opening-height',staleHeight+'px');
          window.dispatchEvent(new Event('pageshow'));
          const curtain=opening.querySelector('.hp-opening-title'),bounds=curtain.getBoundingClientRect();
          const result={bottom:bounds.bottom,cover:opening.getBoundingClientRect().bottom,
            panelHeight:parseFloat(getComputedStyle(curtain,'::before').height),screenHeight:Math.min(screen.width,screen.height)};
          restore.forEach(fn=>fn());window.dispatchEvent(new Event('resize'));return result;
        },staleHeight);
        assert.ok(coldLaunch.cover>=height-.5&&coldLaunch.bottom>=height-.5,'cold landscape launch leaves a dark bottom band');
        assert.ok(coldLaunch.panelHeight>=height-.5,'curtain fabric does not cover the full screen');
        assert.ok(coldLaunch.bottom<=height+.5,'stale portrait height pushed the curtain content off screen');
      }
      await page.screenshot({path:path.join(output,'landscape-cold-launch-curtain.png')});
      await page.locator('.hp-opening-title').click();
      await page.waitForFunction(() => !document.body.classList.contains('hp-booting'));
      assert.equal(await page.locator('#hp-viewport').evaluate(el=>getComputedStyle(el).visibility),'visible','HOME must become visible after boot guard is removed');
      await page.locator('#hp-opening-sequence').waitFor({state:'hidden'});
    } else {
      await page.evaluate(() => { document.body.classList.remove('hp-booting'); document.querySelector('#hp-opening-sequence')?.remove(); });
    }
    if (name==='android20x9') {
      assert.equal(await page.locator('.hp-install-gate').evaluate(el=>el.hidden),true,'installed Android launch must bypass install guide');
      // The curtain's user gesture requests DOM fullscreen through piano.js.
      await page.evaluate(() => document.documentElement.requestFullscreen());
      await page.waitForFunction(()=>!!document.fullscreenElement);
      await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
      assert.equal(await page.locator('.hp-install-gate').evaluate(el=>el.hidden),true,'DOM fullscreen after curtain must not reopen install guide');
      assert.equal(await page.locator('#hp-viewport').evaluate(el=>el.inert),false,'installed Android viewport must remain interactive');
      await page.evaluate(() => document.exitFullscreen());
      assert.equal(await page.locator('.hp-install-gate').evaluate(el=>el.hidden),true,'exiting fullscreen must retain installed launch');
      console.log('PASS Android fullscreen PWA launch -> DOM fullscreen -> HOME remains interactive');
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
      // All three menus acknowledge touch and confirmation without navigation.
      const menuUrl=page.url();
      for (const label of ['ミッション','ランキング','キャラクター']) {
        const button=page.getByRole('button',{name:label,exact:true});
        const box=await button.boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
        await page.mouse.down();
        assert.equal(await button.evaluate(el=>el.classList.contains('hp-home-is-pressed')),true,'menu press acknowledgement');
        assert.notEqual(await button.evaluate(el=>getComputedStyle(el).transform),'none','menu must visibly depress');
        await page.mouse.up();
        assert.equal(await button.evaluate(el=>el.classList.contains('hp-home-confirmed')),true,'menu release must glow');
        assert.equal(page.url(),menuUrl,'menu feedback must not add navigation');
      }
      await page.waitForTimeout(100);
      await page.screenshot({path:path.join(output,'menu-touch-effect.png')});
      await page.waitForFunction(()=>!document.querySelector('.hp-home-bottom-button.hp-home-confirmed'));
      const soundBeforeVoice=await page.evaluate(()=>window.homeTapPlays);
      // Real pointer taps must reach the character and change the live text.
      const dialogue=page.locator('[data-home-dialogue]');
      const first=await dialogue.textContent(), messages=new Set([first]);
      await page.evaluate(()=>{window.qaOriginalRandom=Math.random;});
      for (const value of [.99,.75,.25,.25]) {
        const previous=await dialogue.textContent();
        await page.evaluate(random=>{Math.random=()=>random;},value);
        await page.getByRole('button',{name:'キャラクターと話す',exact:true}).click();
        assert.notEqual(await dialogue.textContent(),previous,'random dialogue must not repeat consecutively');
        messages.add(await dialogue.textContent());
        assert.deepEqual((await inspect(page)).failures,[],'dialogue overflow');
      }
      assert.equal(messages.size,5,'expected five distinct character messages');
      assert.equal(await page.evaluate(()=>window.homeTapPlays),soundBeforeVoice,'character touches must have no tap sound');
      await page.getByRole('button',{name:'メッセージのボイスを再生',exact:true}).click();
      assert.equal(await page.evaluate(()=>window.homeTapPlays),soundBeforeVoice,'voice replay must have no tap sound');
      await dialogue.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      await page.screenshot({path:path.join(output,'character-message.png')});
      await page.evaluate(()=>{Math.random=()=>0;});
      await page.getByRole('button',{name:'キャラクターと話す',exact:true}).click();
      assert.equal(await dialogue.textContent(),first,'random selection must use the chosen message');
      await page.evaluate(()=>{Math.random=window.qaOriginalRandom;delete window.qaOriginalRandom;});
      // Blank HOME space also responds; effects must remain bounded and clear.
      await page.mouse.click(20,240);
      const touch=await page.locator('.hp-home-touch-effect').last().evaluate(el=>[parseFloat(el.style.left),parseFloat(el.style.top)]);
      assert.deepEqual(touch,[20,240],'touch ripple must follow the finger');
      await page.waitForTimeout(90);
      await page.screenshot({path:path.join(output,'home-touch-notes.png')});
      await page.evaluate(()=>{
        const home=document.querySelector('#hp-home-screen');
        for(let i=0;i<30;i++) home.dispatchEvent(new PointerEvent('pointerdown',{clientX:250+i,clientY:240,button:0,bubbles:true}));
      });
      assert.equal(await page.locator('.hp-home-touch-effect').count(),10,'rapid-touch effects must be bounded');
      await page.waitForFunction(()=>document.querySelector('.hp-home-touch-layer').childElementCount===0);
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
      const rotatedTouch=await page.locator('.hp-home-touch-effect').last().evaluate(el=>[parseFloat(el.style.left),parseFloat(el.style.top)]);
      assert.ok(rotatedTouch.every((v,i)=>Math.abs(v-rotatedOrigin.expected[i])<1.5),'rotated musical ripple must follow the button');
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
  const browserContext=await browser.newContext({viewport:{width:915,height:412}});
  const browserPage=await browserContext.newPage();
  await browserPage.goto(base,{waitUntil:'networkidle'});
  assert.equal(await browserPage.locator('.hp-install-gate').evaluate(el=>el.hidden),false,'regular browser must retain install guide');
  await browserPage.evaluate(()=>document.documentElement.requestFullscreen());
  await browserPage.waitForFunction(()=>!!document.fullscreenElement);
  assert.equal(await browserPage.locator('.hp-install-gate').evaluate(el=>el.hidden),false,'DOM fullscreen alone is not an installed launch');
  await browserContext.close();
  console.log('PASS regular browser retains installation guidance during DOM fullscreen');
} finally {
  fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(results,null,2));
  await browser.close(); server.close();
}
