/** Check actual supplied MP3 playback and HOME audio lifecycle in Chromium. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../_site');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.m4a':'audio/mp4', '.woff':'font/woff' };
const server = http.createServer((req,res) => {
  let file = path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root+path.sep) && file!==root) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {
  executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader'],
} : {})});
try {
  const context=await browser.newContext({viewport:{width:932,height:430},hasTouch:true,timezoneId:'Asia/Tokyo'});
  await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));
  // Chromium cannot emulate the physical iPhone silent switch. Capture session
  // requests to verify every real audio/navigation flow keeps WebKit's ambient
  // policy instead of requesting playback, which overrides that switch.
  await context.addInitScript(()=>{
    let type='auto';
    window.testAudioSessionRequests=[];
    Object.defineProperty(navigator,'audioSession',{configurable:true,value:{
      get type(){return type;},
      set type(value){type=value;window.testAudioSessionRequests.push(value);}
    }});
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-10-01T06:00:00+09:00')});
  await page.goto(base,{waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>navigator.audioSession.type),'transient','initial opening audio must obey the silent switch');
  const music=page.locator('[data-home-bgm]');
  assert.equal(await music.evaluate(el=>el.paused),true,'BGM must not play before opening');
  await page.locator('.hp-opening-orientation.hp-ready').waitFor({state:'visible',timeout:15000});
  await page.locator('.hp-opening-orientation').click();
  await page.waitForFunction(()=>document.querySelector('.hp-opening-orientation')?.classList.contains('hp-wave-armed'));
  await page.mouse.move(350,210); await page.mouse.down();
  await page.mouse.move(510,210,{steps:10}); await page.mouse.up();
  await page.locator('.hp-opening-title.hp-show').waitFor({state:'visible'});
  assert.equal(await music.evaluate(el=>el.paused),true,'opening keeps its own soundtrack');
  await page.locator('.hp-opening-title').click();
  await page.locator('#hp-opening-sequence').waitFor({state:'hidden'});

  async function checkTrack(name) {
    await page.waitForFunction(name=>{
      const el=document.querySelector('[data-home-bgm]');
      return el.currentSrc.includes('/'+name+'.mp3') && !el.paused && el.currentTime>0 && el.readyState>=2;
    },name,{timeout:15000});
    assert.equal(await music.evaluate(el=>el.loop),true,'BGM must loop');
    assert.equal(await music.evaluate(el=>el.error),null,'supplied MP3 must decode');
    const duration=await music.evaluate(el=>el.duration);
    assert.ok(Number.isFinite(duration) && duration>10,'full recording must be loaded');
    // Seek to the actual MP3 ending and observe the native player loop.
    await music.evaluate(el=>{el.currentTime=el.duration-.2;});
    await page.waitForFunction(()=>document.querySelector('[data-home-bgm]').currentTime<2,null,{timeout:5000});
    assert.equal(await music.evaluate(el=>el.paused),false,'loop must continue playing');
    console.log('PASS '+name+' actual MP3 playback and end-to-start loop');
  }
  await checkTrack('asabgm');
  const graphLevels=await page.evaluate(async()=>{
    const {context,output}=window.HP_AUDIO_BRIDGE.get();
    const analyser=context.createAnalyser(); analyser.fftSize=256; output.connect(analyser);
    const values=new Uint8Array(analyser.fftSize);
    const measure=async()=>{
      await new Promise(resolve=>setTimeout(resolve,500));
      analyser.getByteTimeDomainData(values);
      return Math.max(...values.map(value=>Math.abs(value-128)));
    };
    const audible=await measure();
    const volume=document.querySelector('[data-control="volume"]');
    volume.value='0';volume.dispatchEvent(new Event('input',{bubbles:true}));
    const muted=await measure();
    volume.value='75';volume.dispatchEvent(new Event('input',{bubbles:true}));
    output.disconnect(analyser);
    return {audible,muted};
  });
  assert.ok(graphLevels.audible>0,'BGM must reach the shared audio output');
  assert.equal(graphLevels.muted,0,'existing volume zero must mute BGM');

  // The HOME boundary timer itself changes the music, without reload or clicks.
  for (const [hours,name] of [[5,'hirubgm'],[7,'yorubgm'],[11,'asabgm']]) {
    await page.clock.fastForward(hours*3600000);
    await checkTrack(name);
  }
  await page.getByRole('button',{name:'ゲームモード',exact:true}).click();
  assert.equal(await music.evaluate(el=>el.paused),false,'game preview stays on HOME with BGM');
  await page.getByRole('button',{name:'ピアノモードへ',exact:true}).click();
  await page.locator('#hp-four88').waitFor({state:'visible'});
  assert.equal(await music.evaluate(el=>el.paused),true,'piano performance must not have HOME BGM');
  const position=await music.evaluate(el=>el.currentTime);
  await page.getByRole('button',{name:'ホームへ戻る',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-home-bgm]').paused);
  assert.ok(await music.evaluate((el,t)=>el.currentTime>=t,position),'returning HOME resumes the paused recording');
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.testBackground===true});
    window.testBackground=true;document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await music.evaluate(el=>el.paused),true,'background must pause music');
  await page.clock.setSystemTime(new Date('2026-10-02T19:00:00+09:00'));
  await page.evaluate(()=>{window.testBackground=false;document.dispatchEvent(new Event('visibilitychange'));});
  await checkTrack('yorubgm');
  assert.ok(await page.evaluate(()=>window.testAudioSessionRequests.length>0));
  assert.ok(await page.evaluate(()=>window.testAudioSessionRequests.every(type=>type==='transient')),
    'opening, HOME BGM, voice and PIANO must never request playback policy');
  // A restored page must reassert the policy even if the browser changed it.
  await page.evaluate(()=>{
    navigator.audioSession.type='auto';
    window.dispatchEvent(new Event('pageshow'));
  });
  assert.equal(await page.evaluate(()=>navigator.audioSession.type),'transient','restored page must obey the silent switch');
  assert.deepEqual(errors,[],'audio and opening script errors');
  await context.close();

  const blocked=await browser.newContext({viewport:{width:932,height:430}});
  const blockedPage=await blocked.newPage();
  await blocked.addInitScript(()=>Object.defineProperty(navigator,'audioSession',{value:undefined}));
  await blockedPage.goto(base,{waitUntil:'networkidle'});
  assert.equal(await blockedPage.evaluate(()=>window.HP_AUDIO_BRIDGE.configureSession()),'unsupported',
    'browsers without Audio Session API must keep their native audio policy');
  await blockedPage.evaluate(()=>window.dispatchEvent(new Event('hp-curtain-start')));
  assert.equal(await blockedPage.locator('[data-home-bgm]').evaluate(el=>el.paused),true,'install guide must stay silent');
  await blocked.close();
  console.log('PASS curtain -> HOME; shared volume/mute; automatic time changes; HOME/PIANO; background/resume; install gate; silent-switch session policy and unsupported API');
} finally {
  await browser.close();server.close();
}
