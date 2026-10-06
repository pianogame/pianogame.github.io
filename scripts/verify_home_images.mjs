/** Browser regression: HOME startup, navigation, local artwork and equipped frames. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../_site');
const output = path.resolve(process.env.HOME_QA_OUTPUT || 'home-images-qa');
fs.mkdirSync(output,{recursive:true});
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav'};
const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']} : {})});
const assets = [];
for (const dir of ['backgrounds','frames','visuals']) for (const file of fs.readdirSync(path.join(root,'assets/gacha',dir))) assets.push('/assets/gacha/'+dir+'/'+file);
assets.push('/assets/gacha/touka-top-v2.webp','/characters/character01/list-art.jpg','/characters/character01/list-art-v2.webp');
const backgroundIds = assets.filter(p=>p.includes('/backgrounds/')).map(p=>path.basename(p).replace('-v1.webp',''));
const frameIds = assets.filter(p=>p.includes('/frames/')).map(p=>path.basename(p).replace('-v1.webp',''));
async function openCase(name,width,height,{equipped=false}={}) {
  const context = await browser.newContext({viewport:{width,height},hasTouch:true,deviceScaleFactor:1});
  await context.addInitScript(({equipped,backgroundIds,frameIds})=>{
    Object.defineProperty(navigator,'standalone',{get:()=>true});
    if (equipped) {
      localStorage.setItem('pds-gacha-inventory-v1',JSON.stringify({backgrounds:backgroundIds,frames:frameIds,voices:[],characters:[]}));
      localStorage.setItem('pds-player-profile-v1',JSON.stringify({name:'画像確認',homeBackground:'moonlight',frame:'frame01'}));
    }
  },{equipped,backgroundIds,frameIds});
  const page=await context.newPage(), errors=[], missing=[], externalImages=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*', async route=>{
    const req=route.request(), url=new URL(req.url());
    if (!url.hostname.endsWith('qa.example')) {
      if (req.resourceType()==='image') externalImages.push(url.origin+url.pathname);
      return route.abort();
    }
    if (url.pathname.startsWith('/_vercel/')) return route.fulfill({status:200,contentType:'application/javascript',body:''});
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if (!file.startsWith(root+'/') || !fs.existsSync(file)) {
      if (!url.pathname.includes('live-news')) missing.push(url.pathname);
      return route.fulfill({status:404,body:''});
    }
    return route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  const hostname=equipped?'pds.qa.example':'pds-git-staging-qa.example';
  await page.goto('https://'+hostname+'/',{waitUntil:'load'});
  await page.evaluate(()=>{document.body.classList.remove('hp-booting');document.querySelector('#hp-opening-sequence')?.remove();window.dispatchEvent(new Event('resize'));});
  await page.waitForFunction(()=>parseFloat(document.querySelector('#hp-home-screen').style.getPropertyValue('--home-width-unit'))>0 && parseFloat(document.querySelector('#hp-home-screen').style.getPropertyValue('--home-width-unit'))<1);
  assert.deepEqual(errors,[],name+' startup runtime errors');
  const readImages=()=>page.evaluate(async()=>{
    const imgs=[...document.querySelectorAll('#hp-home-screen img')].filter(img=>img.getBoundingClientRect().width>0 && img.getBoundingClientRect().height>0 && getComputedStyle(img).visibility!=='hidden');
    return await Promise.all(imgs.map(async img=>{try{await img.decode();return null;}catch{return img.getAttribute('src');}})).then(values=>values.filter(Boolean));
  });
  assert.deepEqual(await readImages(),[],name+' HOME image decode');
  const homeBounds=await page.locator('.hp-home-modes').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight};});
  assert.ok(homeBounds.x>=-1 && homeBounds.y>=-1 && homeBounds.right<=homeBounds.w+1 && homeBounds.bottom<=homeBounds.h+1,name+' HOME mode bounds');
  await page.screenshot({path:path.join(output,name+'-home.png')});
  for (const [action,panel] of [['settings','[data-home-settings]'],['characters','[data-character-screen="list"]'],['missions','.hp-mission-screen'],['ranking','.hp-ranking-screen'],['gacha','.hp-gacha-screen']]) {
    await page.locator('[data-home-action="'+action+'"]').click();
    await page.locator(panel).waitFor({state:'visible'});
    assert.deepEqual(await readImages(),[],name+' '+action+' images');
    await page.screenshot({path:path.join(output,name+'-'+action+'.png')});
    if (action === 'gacha' && name === 'iphone-landscape') {
      await page.locator('[data-gacha-pull="1"]').click();
      await page.waitForFunction(()=>document.querySelector('[data-gacha-animation-overlay]').classList.contains('is-awaiting-touch'));
      await page.locator('[data-gacha-piano-touch]').click();
      await page.locator('[data-gacha-result-overlay]').waitFor({state:'visible'});
      assert.equal(await page.locator('.hp-gacha-result-card').count(),1,'single draw shows its image');
      assert.deepEqual(await readImages(),[],'single draw images');
      await page.screenshot({path:path.join(output,name+'-single-result.png')});
      await page.locator('.hp-gacha-result-ok[data-gacha-result-close]').click();
      await page.locator('[data-gacha-pull="10"]').click();
      await page.locator('[data-gacha-animation-skip]').click();
      await page.locator('[data-gacha-result-overlay]').waitFor({state:'visible'});
      for (let i=0;i<12;i++) {
        if (await page.locator('[data-gacha-result-overlay]').getAttribute('data-mode') === 'summary') break;
        assert.deepEqual(await readImages(),[],'ten draw individual result images');
        await page.locator('[data-gacha-result-next]').click();
        await page.locator('[data-gacha-result-overlay]').waitFor({state:'visible'});
      }
      assert.equal(await page.locator('[data-gacha-result-overlay]').getAttribute('data-mode'),'summary');
      assert.equal(await page.locator('.hp-gacha-result-card').count(),10,'ten draw summary has all ten results');
      assert.deepEqual(await readImages(),[],'ten draw summary images');
      await page.screenshot({path:path.join(output,name+'-ten-results.png')});
      await page.locator('.hp-gacha-result-ok[data-gacha-result-close]').click();
    }
    const close = action==='characters'?'[data-home-action="character-screen-close"]':action==='missions'?'[data-home-action="mission-screen-close"]':action==='ranking'?'[data-home-action="ranking-screen-close"]':action==='gacha'?'[data-home-action="gacha-screen-close"]':'.hp-home-dialog-actions [data-home-action="dialog-close"]';
    await page.locator(close).click();
  }
  await page.locator('[data-home-action="piano"]').click();
  await page.locator('#hp-four88').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#hp-home-screen').hidden);
  await page.screenshot({path:path.join(output,name+'-piano.png')});
  await page.locator('[data-home-action="home"]').click();
  await page.locator('#hp-home-screen').waitFor({state:'visible'});
  if (equipped) {
    await page.locator('[data-home-action="profile-open"]').click();
    const profile = page.locator('[data-profile-preview-image]');
    const before = await profile.evaluate(img=>({w:img.offsetWidth,h:img.offsetHeight,parent:img.parentElement.getBoundingClientRect().width,frame:img.dataset.profileFrame}));
    assert.equal(before.frame,'frame01');assert.ok(before.w<=64 && before.h<=64 && before.parent<=64,'frame keeps avatar dimensions');
    assert.equal(await page.locator('.hp-profile-frame-layer').first().getAttribute('src'),'/assets/gacha/frames/frame01-v1.webp');
    for (const id of frameIds) {
      await page.locator('select[data-profile-frame]').selectOption(id);
      await page.locator('.hp-player-profile-save-top').click();
      assert.equal(await profile.getAttribute('data-profile-frame'),id);
      assert.deepEqual(await readImages(),[],id+' frame image');
      const dimensions=await profile.evaluate(img=>({w:img.offsetWidth,h:img.offsetHeight,parent:img.parentElement.getBoundingClientRect().width}));
      assert.deepEqual(dimensions,{w:before.w,h:before.h,parent:before.parent},'equipping '+id+' preserves layout');
    }
    for (const id of backgroundIds) {
      await page.locator('select[data-profile-home-background]').selectOption(id);
      await page.locator('.hp-player-profile-save-top').click();
      assert.equal(await page.locator('.hp-home-bg').getAttribute('src'),'/assets/gacha/backgrounds/'+id+'-v1.webp');
      assert.deepEqual(await readImages(),[],id+' background');
    }
    await page.screenshot({path:path.join(output,name+'-profile-framed.png')});
    await page.locator('select[data-profile-frame]').selectOption('default');
    await page.locator('.hp-player-profile-save-top').click();
    assert.equal(await profile.getAttribute('data-profile-frame'),'default');
    assert.equal(await page.locator('.hp-player-profile-summary .hp-profile-frame-layer').count(),0,'default removes profile frame');
  }
  await page.evaluate(async paths=>{await Promise.all(paths.map(async src=>{const img=new Image();img.src=src;await img.decode();}));},assets);
  assert.deepEqual(externalImages,[],name+' no external image delivery');
  assert.deepEqual(missing,[],name+' no missing assets');
  assert.deepEqual(errors,[],name+' no runtime errors after navigation');
  console.log('PASS',name,'HOME and five screens,',assets.length,'image decodes',equipped?'all 15 equipped frames and 10 backgrounds':'');
  await context.close();
}
try {
  if (!process.env.HOME_QA_CASES || process.env.HOME_QA_CASES.includes('iphone-landscape')) await openCase('iphone-landscape',932,430);
  if (!process.env.HOME_QA_CASES || process.env.HOME_QA_CASES.includes('iphone-portrait')) await openCase('iphone-portrait',430,932);
  if (!process.env.HOME_QA_CASES || process.env.HOME_QA_CASES.includes('owned-customization')) await openCase('owned-customization',932,430,{equipped:true});
} finally {await browser.close();}
