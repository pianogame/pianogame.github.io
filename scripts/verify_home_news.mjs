/** External notices lifecycle and actual rapid-touch audio regression. */
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
try{
  if(process.env.NEWS_QA_LIVE_ONLY!=='1'){
  const context=await browser.newContext({viewport:{width:932,height:430},hasTouch:true,reducedMotion:'reduce'});
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,'standalone',{get:()=>true});
    window.taps=[];window.activeTaps=new Set();window.peakTaps=0;window.mediaTaps=0;
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(...args){if(this.src.includes('home-button-tap'))window.mediaTaps++;return play.apply(this,args);};
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      if(this.buffer?.duration>.5&&this.buffer.duration<.7){
        window.taps.push({at:performance.now(),when:args[0]||0,now:this.context.currentTime,source:this});
        window.activeTaps.add(this);window.peakTaps=Math.max(window.peakTaps,window.activeTaps.size);
        this.addEventListener('ended',()=>window.activeTaps.delete(this),{once:true});
      }
      return start.apply(this,args);
    };
  });
  let feed={version:1,items:[{id:'one',title:'外部お知らせ1',body:'詳細\n2行目',tag:'追加予定'}]};
  let offline=false, requests=0;
  await context.route('https://raw.githubusercontent.com/**/news-feed/news.json*',async route=>{
    requests++;
    if(offline)return route.abort('internetdisconnected');
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(feed)});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(()=>{document.querySelector('#hp-opening-sequence')?.remove();document.body.classList.remove('hp-booting');});
  await page.waitForFunction(()=>document.querySelector('[data-home-notices] h3')?.textContent==='外部お知らせ1');
  const badge=page.locator('.hp-home-notice-badge'), notice=page.locator('[data-home-action="notice"]'), close=page.locator('[data-home-action="dialog-close"]').filter({ hasText: '閉じる' });
  assert.equal(await badge.isVisible(),true,'new external item is unread');
  await notice.tap();await page.waitForFunction(()=>document.querySelector('.hp-home-notice-badge').hidden);
  assert.equal(await page.locator('[data-home-notices] p').textContent(),'詳細\n2行目');
  await close.tap();await page.reload({waitUntil:'networkidle'});
  await page.evaluate(()=>{document.querySelector('#hp-opening-sequence')?.remove();document.body.classList.remove('hp-booting');});
  assert.equal(await badge.isVisible(),false,'read state survives restart');
  feed.items.push({id:'two',title:'ホーム復帰で追加',body:'<img src=x onerror=alert(1)>',tag:'更新'});
  const before=requests;
  await page.locator('[data-home-action="piano"]').tap();await page.waitForFunction(()=>document.querySelector('#hp-home-screen').hidden);
  await page.locator('#hp-four88 [data-home-action="home"]').tap();
  await page.waitForFunction(()=>document.querySelectorAll('[data-home-notices] article').length===2);
  assert.ok(requests>before,'returning HOME fetches news without rebuilding');assert.equal(await badge.isVisible(),true);
  await notice.tap();await page.waitForFunction(()=>document.querySelector('.hp-home-notice-badge').hidden);
  assert.equal(await page.locator('[data-home-notices] img').count(),0,'external content is text, never HTML');
  await close.tap();
  feed.items[0].title='内容を更新';
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
  await page.waitForFunction(()=>document.querySelector('[data-home-notices] h3').textContent==='内容を更新');
  assert.equal(await badge.isVisible(),true,'editing existing item also becomes unread');
  offline=true;await page.reload({waitUntil:'networkidle'});
  await page.evaluate(()=>{document.querySelector('#hp-opening-sequence')?.remove();document.body.classList.remove('hp-booting');});
  assert.equal(await page.locator('[data-home-notices] h3').first().textContent(),'内容を更新','offline displays last valid content');
  offline=false;feed={version:1,items:[{id:'bad',title:17}]};
  await notice.tap();await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-home-notices] article').count(),2,'invalid feed does not erase valid content');await close.tap();
  feed={version:1,items:[]};await notice.tap();await page.waitForFunction(()=>document.querySelectorAll('[data-home-notices] article').length===0);
  assert.match(await page.locator('[data-home-notices]').textContent(),/現在、新しいお知らせはありません/);await close.tap();
  assert.equal(await badge.isVisible(),false,'empty feed has no badge');
  console.log('PASS external startup/return/resume/reload news, unread persistence, edits, offline, invalid/empty feeds, safe text');
  assert.equal(await page.locator('#hp-four88 [data-sound-control]').count(),0,'HOME volumes excluded from PIANO settings');

  // Each real pointerdown starts immediately; click must not start a second sound.
  await page.waitForTimeout(700);await page.evaluate(()=>{window.taps=[];window.peakTaps=0;});
  const mission=page.getByRole('button',{name:'ミッション',exact:true});
  const box=await mission.boundingBox();
  for(let i=0;i<12;i++){
    const count=await page.evaluate(()=>window.taps.length);
    await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
    assert.equal(await page.evaluate(()=>window.taps.length),count+1,'one immediate audio source per light touch');
    await page.waitForTimeout(25);
  }
  const tapStats=await page.evaluate(()=>({count:window.taps.length,media:window.mediaTaps,peak:window.peakTaps,delays:window.taps.map(t=>Math.max(0,t.when-t.now)),duration:window.taps[0]?.source.buffer.duration}));
  assert.equal(tapStats.count,12);assert.equal(tapStats.media,0,'tap audio never uses asynchronous media play/seek');
  assert.ok(tapStats.peak<=2,'crossfade is bounded to old/new sound');assert.ok(tapStats.delays.every(x=>x<.001),'audio begins at current time');
  assert.ok(tapStats.duration>.5&&tapStats.duration<.7,'original supplied sound decoded intact');
  await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>window.activeTaps.size),0,'no delayed sound queue remains');
  const taps=await page.evaluate(()=>window.taps.length);
  await page.getByRole('button',{name:'キャラクターと話す',exact:true}).tap();
  assert.equal(await page.evaluate(()=>window.taps.length),taps,'character tap remains silent');
  assert.deepEqual(errors,[]);console.log('PASS 12 real rapid/light taps: synchronous source starts, bounded crossfade, no duplicate or late audio; silent character');
  await context.close();
  }
  if(process.env.NEWS_QA_LIVE==='1'){
    const proxy=process.env.HTTPS_PROXY||process.env.https_proxy;
    const live=await browser.newContext({viewport:{width:932,height:430},hasTouch:true,ignoreHTTPSErrors:true,...(proxy?{proxy:{server:proxy,bypass:'127.0.0.1,localhost'}}:{})});
    await live.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));
    const actual=await live.newPage();
    actual.on('requestfailed',request=>{if(request.url().includes('/news-feed/'))console.log('Live feed network failure:',request.failure()?.errorText);});
    await actual.goto(base,{waitUntil:'networkidle'});
    await actual.waitForFunction(()=>JSON.parse(localStorage.getItem('hp-news-cache-v1')||'null')?.items.some(item=>item.id==='planned-game'),null,{timeout:25000});
    await actual.evaluate(()=>{document.querySelector('#hp-opening-sequence')?.remove();document.body.classList.remove('hp-booting');});
    await actual.locator('[data-home-action="notice"]').tap();
    assert.equal(await actual.locator('[data-home-notices] article').count(),3);
    assert.match(await actual.locator('[data-home-notices]').textContent(),/初期選択の2人のみ/);
    if(process.env.NEWS_QA_OUTPUT){fs.mkdirSync(process.env.NEWS_QA_OUTPUT,{recursive:true});await actual.screenshot({path:path.join(process.env.NEWS_QA_OUTPUT,'live-news.png')});}
    await live.close();console.log('PASS actual GitHub feed fetched cross-origin by the app and displayed as three cards');
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
