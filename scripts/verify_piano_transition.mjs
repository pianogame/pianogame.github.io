/** No partial keyboard frames during cold/slow HOME to PIANO navigation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../_site');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.mp3':'audio/mpeg','.wav':'audio/wav','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']}: {})});
try {
  const files=['palace-hall-v4.jpg','rack-v4.webp','white-key-v4.webp','black-key-v4.webp','footer-v4.webp'];
  const output=process.env.TRANSITION_QA_OUTPUT;
  if(output)fs.mkdirSync(output,{recursive:true});
  for(const [name,width,height] of [['landscape',932,430],['rotated',430,932]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});
    await context.addInitScript(()=>{
      Object.defineProperty(navigator,'standalone',{get:()=>true});
      window.pianoDecoded=new Set();window.visibleFrames=[];
      const decode=HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode=function(...args){return decode.apply(this,args).then(result=>{if(this.src.includes('/assets/piano/'))window.pianoDecoded.add(this.src.split('/').at(-1));return result;});};
      const inspect=()=>{
        const root=document.querySelector('#hp-four88');
        if(root&&!root.hidden&&getComputedStyle(root).visibility==='visible'){
          const black=root.querySelector('.hp-stage .hp-sharp'),row=root.querySelector('.hp-stage .hp-register-section');
          window.visibleFrames.push({decoded:[...window.pianoDecoded],blackHeight:black.offsetHeight,rowHeight:row.offsetHeight,whiteWidth:root.querySelector('.hp-stage .hp-key:not(.hp-sharp)').offsetWidth,preparing:root.classList.contains('hp-piano-preparing')});
        }
        requestAnimationFrame(inspect);
      };requestAnimationFrame(inspect);
    });
    let release=false,waiting=[];
    await context.route('**/assets/piano/*',async route=>{
      if(files.includes(new URL(route.request().url()).pathname.split('/').at(-1))&&!release){await new Promise(resolve=>waiting.push(resolve));}
      await route.continue();
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{document.querySelector('#hp-opening-sequence')?.remove();document.body.classList.remove('hp-booting');});
    await page.getByRole('button',{name:'ピアノモードへ',exact:true}).tap();
    await page.waitForTimeout(700);
    assert.equal(await page.locator('#hp-home-screen').isVisible(),true,'HOME covers incomplete PIANO while artwork is delayed');
    assert.equal(await page.locator('.hp-home-piano-loading').isVisible(),true,'slow images show the loading screen');
    if(output)await page.screenshot({path:path.join(output,name+'-loading.png')});
    assert.equal(await page.locator('[data-home-canvas]').evaluate(el=>el.inert),true,'HOME controls do not remain interactive underneath loading');
    assert.equal(await page.locator('#hp-four88').isVisible(),false,'no flat white keys or incomplete PIANO frame is exposed');
    assert.equal(await page.evaluate(()=>window.visibleFrames.length),0);
    assert.ok(waiting.length>=5,'all five art parts are requested eagerly while PIANO is hidden');
    release=true;waiting.forEach(resolve=>resolve());
    await page.waitForFunction(()=>document.querySelector('#hp-home-screen').hidden);
    await page.waitForFunction(()=>window.visibleFrames.length>2);
    assert.equal(await page.locator('.hp-home-piano-loading').isVisible(),false,'loading screen disappears with the complete piano');
    const frames=await page.evaluate(()=>window.visibleFrames);
    assert.ok(frames.every(frame=>files.every(file=>frame.decoded.includes(file))&&frame.blackHeight>20&&frame.rowHeight>50&&frame.whiteWidth>40&&!frame.preparing),'every visible frame has decoded artwork and fully sized black/white keys');
    if(output)await page.screenshot({path:path.join(output,name+'-first-piano.png')});
    await page.getByRole('button',{name:'ホームへ戻る',exact:true}).tap();
    await page.waitForFunction(()=>!document.querySelector('#hp-home-screen').hidden);
    await page.locator('[data-home-action="notice"]').tap();
    if(output)await page.screenshot({path:path.join(output,name+'-silver-notices.png')});
    for(const card of await page.locator('[data-home-notices] article').all()){
      const css=await card.evaluate(el=>({background:getComputedStyle(el).backgroundImage,color:getComputedStyle(el).color}));
      assert.match(css.background,/238, 242, 247/);assert.equal(css.color,'rgb(37, 48, 68)');
    }
    await page.locator('.hp-home-dialog-button').tap();await page.locator('[data-home-action="settings"]').tap();
    if(output)await page.screenshot({path:path.join(output,name+'-silver-settings.png')});
    assert.equal(await page.locator('.hp-home-sound-card').count(),3);
    await page.locator('.hp-home-dialog-button').tap();
    await page.evaluate(()=>{window.visibleFrames=[];window.warmLoadingShown=false;window.watchWarm=true;const watch=()=>{if(window.watchWarm&&!document.querySelector('.hp-home-piano-loading').hidden)window.warmLoadingShown=true;requestAnimationFrame(watch);};requestAnimationFrame(watch);});
    await page.getByRole('button',{name:'ピアノモードへ',exact:true}).tap();
    await page.waitForFunction(()=>document.querySelector('#hp-home-screen').hidden);
    assert.equal(await page.evaluate(()=>window.warmLoadingShown),false,'decoded images do not show an unnecessary loading screen on return');
    await page.evaluate(()=>window.watchWarm=false);
    assert.deepEqual(errors,[]);await context.close();
    console.log('PASS '+name+': held cold-image requests reveal no partial keyboard; first painted keys sized and decoded; silver notice/settings cards');
  }
  const context=await browser.newContext({viewport:{width:932,height:430},hasTouch:true,reducedMotion:'reduce'});
  await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));
  let fail=true;
  await context.route('**/assets/piano/black-key-v4.webp',route=>fail?route.abort():route.continue());
  const page=await context.newPage();await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(()=>{document.querySelector('#hp-opening-sequence')?.remove();document.body.classList.remove('hp-booting');});
  await page.getByRole('button',{name:'ピアノモードへ',exact:true}).tap();
  await page.locator('.hp-home-transition-message').waitFor({state:'visible'});
  assert.equal(await page.locator('#hp-home-screen').isVisible(),true,'failed art retains HOME rather than incomplete piano');
  fail=false;await page.getByRole('button',{name:'ピアノモードへ',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('#hp-home-screen').hidden);
  assert.equal(await page.locator('.hp-home-transition-message').isVisible(),false);
  await context.close();console.log('PASS failed artwork keeps HOME usable and a later tap retries successfully');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
