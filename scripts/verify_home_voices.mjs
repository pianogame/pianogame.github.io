/** Check supplied character WAVs and their HOME lifecycle in Chromium. */
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
  const context=await browser.newContext({viewport:{width:932,height:430},hasTouch:true,reducedMotion:'reduce'});
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,'standalone',{get:()=>true});
    Math.random=()=>.5;
    window.voiceStarts=[];window.activeVoices=new Set();window.maxVoices=0;
    const connect=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(destination,...rest){
      if(this instanceof MediaElementAudioSourceNode) window.bgmGain=destination;
      return connect.call(this,destination,...rest);
    };
    const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start=function(...args){
      const file=document.querySelector('#hp-home-screen')?.dataset.voiceFile;
      if(file && this.buffer?.duration>=4 && this.buffer.duration<9 && !this.loop){
        window.voiceStarts.push({file,duration:this.buffer.duration});
        window.activeVoices.add(this);window.maxVoices=Math.max(window.maxVoices,window.activeVoices.size);
        this.addEventListener('ended',()=>window.activeVoices.delete(this),{once:true});
      }
      return start.apply(this,args);
    };
    AudioBufferSourceNode.prototype.stop=function(...args){window.activeVoices.delete(this);return stop.apply(this,args);};
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>window.voiceStarts.length),0,'no voice before HOME');
  await page.locator('.hp-opening-orientation.hp-ready').waitFor({state:'visible',timeout:15000});
  await page.locator('.hp-opening-orientation').click();
  await page.waitForFunction(()=>document.querySelector('.hp-opening-orientation')?.classList.contains('hp-wave-armed'));
  await page.mouse.move(350,210);await page.mouse.down();await page.mouse.move(510,210,{steps:10});await page.mouse.up();
  await page.locator('.hp-opening-title.hp-show').waitFor({state:'visible'});
  await page.locator('.hp-opening-title').click();
  await page.locator('#hp-opening-sequence').waitFor({state:'hidden'});
  const voice=async(file)=>{
    await page.waitForFunction(file=>{
      const home=document.querySelector('#hp-home-screen');
      return home.dataset.voiceFile===file && home.dataset.voicePlaying==='true' && window.activeVoices.size===1;
    },file,{timeout:10000});
    const actual=await page.evaluate(()=>window.voiceStarts.at(-1));
    assert.equal(actual.file,file);
    const expected={konnani:4.226031746,okaeri:4.876190476,anatano:5.944308390,anatanorare:8.266303855,sukositukare:6.965986395,tuginoition:4.690430839};
    assert.ok(Math.abs(actual.duration-expected[file])<.001,'actual supplied WAV must be decoded: '+file);
    console.log('PASS '+file+' actual WAV source playback');
  };
  await voice('konnani');
  assert.ok(await page.evaluate(()=>window.bgmGain.gain.value<.25),'BGM must duck during voice');
  const character=page.getByRole('button',{name:'キャラクターと話す',exact:true});
  const replay=page.getByRole('button',{name:'メッセージのボイスを再生',exact:true});
  // At the second tap the recent greeting has only 1/13 probability, so .08
  // selects okaeri instead. Later, an older message recovers its weight.
  for(const [random,file,text] of [[.99,'tuginoition','次の一音'],[.08,'okaeri','おかえり'],[.5,'anatano','あなたの'],[.5,'sukositukare','少し疲れ'],[0,'konnani','こんなに'],[.35,'anatano','あなたの'],[.5,'sukositukare','少し疲れ'],[.59,'anatano','あなたの']]){
    const previous=await page.evaluate(()=>window.voiceStarts.at(-1).file);
    await page.evaluate(value=>{Math.random=()=>value;},random);
    await character.click();await voice(file);
    assert.notEqual(file,previous,'random dialogue must exclude the previous voice, even with identical random values');
    assert.ok((await page.locator('[data-home-dialogue]').textContent()).startsWith(text),'voice and visible message must agree');
  }
  await replay.click();await voice('anatano');
  for(let count=10;count<=41;count++){
    if(count%20===0){
      await page.evaluate(value=>{Math.random=()=>value;},count===20?0:.99);
      await character.click();
    }else if(count===21||count===22){
      await page.evaluate(random=>{Math.random=()=>random;},count===21?.5:.65);
      await character.click();
    }else await replay.click();
    await voice(count%20===0?'anatanorare':count===21?'sukositukare':'anatano');
    assert.ok((await page.locator('[data-home-dialogue]').textContent()).startsWith(count===21?'少し疲れ':'あなたの'),'rare and normal voices must use their matching dialogue');
  }
  assert.deepEqual(await page.evaluate(()=>window.voiceStarts.slice(1).flatMap((v,i)=>v.file==='anatanorare'?[i+1]:[])),[20,40],'only every twentieth manual play is rare, excluding the greeting');
  assert.doesNotMatch(await page.locator('#hp-home-screen').textContent(),/20回|レア|rare/i,'hidden bonus must not be advertised');
  assert.equal(await page.evaluate(()=>window.maxVoices),1,'rapid taps must never overlap voices');
  await page.waitForFunction(()=>document.querySelector('#hp-home-screen').dataset.voicePlaying==='false',null,{timeout:10000});
  assert.equal(await page.evaluate(()=>window.activeVoices.size),0,'natural ending must release the voice');
  await page.waitForFunction(()=>window.bgmGain.gain.value>.45);
  await replay.click();await voice('anatano');
  await page.getByRole('button',{name:'ピアノモードへ',exact:true}).click();
  await page.locator('#hp-four88').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.activeVoices.size),0,'PIANO must stop character voice');
  await page.getByRole('button',{name:'ホームへ戻る',exact:true}).click();
  await voice('okaeri');
  assert.ok((await page.locator('[data-home-dialogue]').textContent()).startsWith('おかえり'),'return HOME greeting');
  for(let count=1;count<=20;count++){
    if(count===1){
      await page.evaluate(()=>{Math.random=()=>0;});
      await character.click();
    }else await replay.click();
    await voice(count===20?'anatanorare':'konnani');
  }
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.evaluate(()=>window.activeVoices.size),0,'background must stop voice');
  assert.equal(await page.locator('[data-home-bgm]').evaluate(el=>el.paused),true,'background must pause BGM');
  assert.deepEqual(errors,[],'voice browser errors');
  const race=await context.newPage();
  const raceErrors=[];race.on('pageerror',error=>raceErrors.push(error.message));
  let release;
  const held=new Promise(resolve=>{release=resolve;});
  await race.route('**/tuginoition.wav*',async route=>{await held;await route.continue();});
  await race.goto(base,{waitUntil:'networkidle'});
  await race.evaluate(()=>{document.body.classList.remove('hp-booting');document.querySelector('#hp-opening-sequence')?.remove();});
  const raceCharacter=race.getByRole('button',{name:'キャラクターと話す',exact:true});
  for(const value of [.99,0]){
    await race.evaluate(random=>{Math.random=()=>random;},value);
    await raceCharacter.click();
  }
  await race.waitForFunction(()=>document.querySelector('#hp-home-screen').dataset.voiceFile==='konnani' && window.activeVoices.size===1);
  const finished=race.waitForResponse(response=>response.url().includes('/tuginoition.wav'));
  release();await (await finished).finished();await race.waitForTimeout(400);
  assert.equal(await race.evaluate(()=>window.voiceStarts.some(v=>v.file==='tuginoition')),false,'late download must not replace a newer voice');
  assert.equal(await race.evaluate(()=>window.maxVoices),1,'cold downloads must never overlap');
  // Cancelled downloads do not count; a failed twentieth play must remain due.
  const raceReplay=race.getByRole('button',{name:'メッセージのボイスを再生',exact:true});
  for(let count=await race.evaluate(()=>window.voiceStarts.length);count<19;count++){
    await raceReplay.click();
    await race.waitForFunction(n=>window.voiceStarts.length===n,count+1);
    assert.equal(await race.evaluate(()=>window.voiceStarts.at(-1).file),'konnani');
  }
  let failRare=true;
  await race.route('**/anatanorare.wav*',route=>{
    if(failRare){failRare=false;return route.fulfill({status:503,body:'Temporary download failure'});}
    return route.continue();
  });
  const failedRare=race.waitForResponse(r=>r.url().includes('/anatanorare.wav')&&r.status()===503);
  await raceReplay.click();await (await failedRare).finished();await race.waitForTimeout(100);
  assert.equal(await race.evaluate(()=>window.voiceStarts.length),19,'failed voice advanced the bonus counter');
  await raceReplay.click();
  await race.waitForFunction(()=>window.voiceStarts.length===20&&window.voiceStarts.at(-1).file==='anatanorare');
  assert.ok((await race.locator('[data-home-dialogue]').textContent()).startsWith('あなたの'));
  await raceReplay.click();
  await race.waitForFunction(()=>window.voiceStarts.length===21&&window.voiceStarts.at(-1).file==='anatano');
  assert.deepEqual(raceErrors,[],'cold-load voice errors');
  await context.close();
  console.log('PASS late WAV download cannot interrupt newer dialogue');
  console.log('PASS initial HOME; five weighted random messages; recent dialogue suppressed and older dialogue recovers; no consecutive repeats; rare/return greeting excluded from next random selection; replay; hidden twentieth/fortieth rare; navigation reset; failed/cancelled downloads excluded; no overlap; natural ending; PIANO stop; return greeting; background');
} finally {
  await browser.close();server.close();
}
