/** Exercise the concert-piano skin against actual sampled notes and recording. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../_site');
const output=path.resolve(process.env.VIOLIN_QA_OUTPUT||'violin-qa');
fs.mkdirSync(output,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.woff':'font/woff'};
const server=http.createServer((req,res)=>{
  let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
// Software painting avoids headless SwiftShader tile artifacts in large key grids.
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--disable-gpu'],...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}: {})});
try {
  const context=await browser.newContext({viewport:{width:932,height:430},hasTouch:true,acceptDownloads:true});
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,'standalone',{get:()=>true});
    window.qaSources=[];
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.length>1)window.qaSources.push(this);return start.apply(this,args);};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{document.body.classList.remove('hp-booting');document.querySelector('#hp-opening-sequence')?.remove();});
  await page.getByRole('button',{name:'ピアノモードへ',exact:true}).click();
  await page.evaluate(()=>window.dispatchEvent(new Event('hp-curtain-start')));
  await page.waitForFunction(()=>!document.querySelector('.hp-stage .hp-key').disabled,null,{timeout:30000});
  if(await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-control="instrument"]').selectOption('violin');
  await page.waitForFunction(()=>document.querySelector('#hp-four88').dataset.instrument==='violin'&&!document.querySelector('.hp-stage .hp-key').disabled,null,{timeout:60000});
  assert.equal(await page.locator('.hp-violin-panel').isVisible(),true);
  assert.equal(await page.locator('[data-effects-panel]').isVisible(),false);
  await page.getByLabel('バイオリンのプリセット',{exact:true}).selectOption('dream');
  assert.equal(await page.locator('[data-violin-parameter="articulation"]').inputValue(),'tremolo');
  assert.equal(await page.locator('[data-violin-parameter="reverb"]').inputValue(),'45');
  await page.locator('[data-violin-reset]').click();
  assert.equal(await page.locator('[data-violin-parameter="articulation"]').inputValue(),'arco');
  await page.locator('[data-violin-parameter="brightness"]').evaluate(el=>{el.value=3;el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('.hp-violin-panel h2').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'violin-techniques.png')});
  await page.locator('[data-violin-audition]').scrollIntoViewIfNeeded();
  for(const button of await page.locator('.hp-violin-panel button').all()) {
    const delta=await button.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.querySelector('.hp-control-content').getBoundingClientRect();return Math.max(Math.abs(a.left+a.right-b.left-b.right),Math.abs(a.top+a.bottom-b.top-b.bottom));});
    assert.ok(delta<1,'violin button content is off centre');
  }
  await page.screenshot({path:path.join(output,'violin-settings.png')});
  await page.locator('[data-action="settings-close"]').click();
  const ranges=await page.locator('.hp-stage .hp-key').evaluateAll(keys=>keys.map(k=>Number(k.dataset.midi)));
  assert.equal(Math.min(...ranges),60);assert.equal(Math.max(...ranges),96);
  const dsp=await page.evaluate(async()=>{
    const api=window.HP_VIOLIN,ds=window.HP_VIOLIN_SAMPLES,decode=new AudioContext();
    const cache=new Map();
    for(const d of ds){const b=await decode.decodeAudioData(await (await fetch(d.url)).arrayBuffer());if(b.duration<.1)throw Error('Empty sample '+d.url);cache.set(d.url,b);}
    const counts={};for(const d of ds)counts[d.articulation]=(counts[d.articulation]||0)+1;
    const rms=(data,a,b)=>{let sum=0;for(let i=Math.floor(a*44100);i<Math.min(data.length,b*44100);i++)sum+=data[i]**2;return Math.sqrt(sum/(Math.min(data.length,b*44100)-a*44100));};
    async function render(extra={},held=1,total=4){
      const settings={...api.defaults,reverb:0,...extra},d=api.descriptor(ds,72,settings),ctx=new OfflineAudioContext(2,44100*total,44100);
      const voice=api.createVoice(ctx,api.route(ctx,ctx.destination,settings),d,cache.get(d.url),72,0,settings,.5);voice.release(held,.2);
      const result=await ctx.startRendering();api.disposeTarget(ctx.destination);return result.getChannelData(0);
    }
    const base=await render(),slow=await render({attack:.4}),vib=await render({vibratoDepth:30,vibratoDelay:0}),bright=await render({brightness:8}),wet=await render({reverb:60,decay:4}),held=await render({},10,12),trem=await render({articulation:'tremolo'},10,12);
    const difference=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length);
    const round=[api.descriptor(ds,72,{articulation:'spiccato'}).url,api.descriptor(ds,72,{articulation:'spiccato'}).url];
    await decode.close();
    return {count:cache.size,counts,round,base:rms(base,.02,.07),slow:rms(slow,.02,.07),vibrato:difference(base,vib),brightness:difference(base,bright),dryTail:rms(base,1.6,2),wetTail:rms(wet,1.6,2),held:rms(held,8,9),ended:rms(held,10.5,11),trem:rms(trem,8,9),peak:Math.max(...Array.from(held).filter((_,i)=>i%10===0).map(Math.abs))};
  });
  assert.equal(dsp.count,84);assert.deepEqual(dsp.counts,{arco:15,pizzicato:25,spiccato:30,tremolo:14});
  assert.notEqual(...dsp.round);assert.ok(dsp.base>dsp.slow*2,'attack setting has no audible effect');
  assert.ok(dsp.vibrato>.005&&dsp.brightness>.001,'tone settings have no effect');
  assert.ok(dsp.wetTail>.00001&&dsp.dryTail<.000001,'reverb tail missing');
  assert.ok(dsp.held>.001&&dsp.trem>.001&&dsp.ended<.000001&&dsp.peak<1,'held bow/release failed');
  console.log('PASS 84 real samples, 4 articulations, RR, attack/vibrato/tone/reverb and 10-second sustain',JSON.stringify(dsp));
  const key=page.locator('.hp-stage [data-midi="72"]'),box=await key.boundingBox();
  const point={x:box.x+box.width*.25,y:box.y+box.height*.8};
  const record=page.locator('[data-action="record"]');await record.click();
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();await page.waitForTimeout(400);await record.click();
  const track=await page.evaluate(()=>JSON.parse(localStorage.getItem('piano-palette-multitrack-v1')).tracks.at(-1));
  assert.equal(track.instrument,'violin');assert.equal(track.violin.brightness,3);assert.equal(track.notes[0].violin.articulation,'arco');assert.equal(track.notes[0].midi,72);
  await page.locator('[data-action="settings"]').click();await page.locator('[data-control="instrument"]').selectOption('piano');
  await page.waitForFunction(()=>!document.querySelector('.hp-stage .hp-key').disabled);
  assert.equal(await page.locator('.hp-violin-panel').isVisible(),false);
  await page.locator('[data-action="settings-close"]').click();
  const before=await page.evaluate(()=>window.qaSources.length);await page.locator('[data-action="play"]').click();
  await page.waitForFunction(n=>window.qaSources.length>n,before);
  assert.ok(await page.evaluate(n=>window.qaSources.slice(n).some(s=>s.loop),before),'recorded arco became current piano instrument');
  await page.locator('[data-action="play"]').click();
  await page.getByRole('button',{name:'録音一覧',exact:false}).click();
  const downloadPromise=page.waitForEvent('download');await page.locator('[data-export-mix]').click();
  const download=await downloadPromise,file=path.join(output,'violin-recording.wav');await download.saveAs(file);
  const wav=fs.readFileSync(file);assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.equal(wav.subarray(8,12).toString(),'WAVE');
  let peak=0;for(let i=44;i+1<wav.length;i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i)));assert.ok(peak>100&&peak<32767,'export is silent or clipped');
  await page.reload();await page.evaluate(()=>{document.body.classList.remove('hp-booting');document.querySelector('#hp-opening-sequence')?.remove();});
  assert.equal(await page.evaluate(()=>window.HP_VIOLIN.snapshot().brightness),3,'violin settings lost after reload');
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('piano-palette-multitrack-v1')).tracks.at(-1));assert.equal(restored.notes[0].violin.articulation,'arco');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify({dsp,track,wavBytes:wav.length,peak},null,2));
  console.log('PASS violin presets/reset/persistence, C4–C7, recording with saved tone, playback after switching to piano, non-silent WAV export');
  await context.close();
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
