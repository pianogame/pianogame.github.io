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
const output=path.resolve(process.env.PIANO_QA_OUTPUT||'piano-palace-qa');
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
const requested=process.env.PIANO_QA_CASES?.split(',');
const cases=[['reference',1536,864],['wide',1536,709],['iphone15pm',932,430,{left:59,right:59,bottom:21}],['iphone14',844,390,{left:47,right:47,bottom:21}],['android',915,412],['small',667,375],['short',568,320],['rotated',430,932,{top:59,bottom:34}]].filter(([name])=>!requested||requested.includes(name));
const metrics=[];
async function inspect(page,layout='37'){
  const result=await page.evaluate(layout=>{
    const root=document.querySelector('#hp-four88'),stage=root.querySelector(layout==='37'?'.hp-stage':'.hp-scroll-window');
    const failures=[],keyData=[];
    const rows=[...stage.querySelectorAll('.hp-register-section')].filter(row=>{const r=row.getBoundingClientRect();const s=stage.getBoundingClientRect();return Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top)>5;});
    const rotated=document.documentElement.dataset.hpRotated==='true';
    for(const row of rows){
      const white=[...row.querySelectorAll('.hp-key:not(.hp-sharp)')];
      if(Math.max(...white.map(k=>k.offsetWidth))-Math.min(...white.map(k=>k.offsetWidth))>1)failures.push('white key widths differ');
      for(let i=1;i<white.length;i++) {
        const gap=(white[i].offsetLeft-white[i].offsetWidth/2)-(white[i-1].offsetLeft+white[i-1].offsetWidth/2);
        // offsetLeft/offsetWidth round independently to whole CSS pixels.
        if(gap<0||gap>3.5)failures.push('white key gap exceeds reference');
      }
      const mids=white.map(k=>Number(k.dataset.midi));
      if(new Set(mids).size!==mids.length)failures.push('duplicate white notes');
      for(const key of row.querySelectorAll('.hp-key')){
        if(key.offsetLeft-key.offsetWidth/2<-.5||key.offsetLeft+key.offsetWidth/2>row.clientWidth+.5)failures.push('key outside row');
        if(key.offsetTop<0||key.offsetTop+key.offsetHeight+8>row.clientHeight+1)failures.push('key depth outside row');
        const sharp=key.classList.contains('hp-sharp');
        const pitch=Number(key.dataset.midi)%12;
        if(sharp&&![1,3,6,8,10].includes(pitch))failures.push('black key between E/F or B/C');
        if(sharp&&Number(getComputedStyle(key).zIndex)<20)failures.push('black key behind white');
        if(!sharp) {
          const face=key.querySelector('.hp-key-face');
          if(getComputedStyle(face).overflow!=='hidden'||getComputedStyle(face).backgroundColor==='rgba(0, 0, 0, 0)')failures.push('white key silhouette is not rectangular');
          if(getComputedStyle(key.querySelector('.hp-digit')).display!=='none')failures.push('numeric label outside white key');
        }
        keyData.push({midi:Number(key.dataset.midi),w:key.offsetWidth,h:key.offsetHeight,sharp,labelSize:sharp?null:getComputedStyle(key.querySelector('.hp-syllable')).fontSize});
      }
    }
    const header=root.querySelector('.hp-header');
    const footer=root.querySelector('.hp-footer'),footerBox=footer.getBoundingClientRect();
    for(const el of footer.querySelectorAll('.hp-status,[data-output="instrument-label"]')) {
      const box=el.getBoundingClientRect();
      const start=rotated?box.top-footerBox.top:box.left-footerBox.left;
      const end=rotated?box.bottom-footerBox.top:box.right-footerBox.left;
      if(start<footer.clientWidth*.06||end>footer.clientWidth*.94)failures.push('footer text overlaps corner ornament');
      if(el.classList.contains('hp-status')&&end>footer.clientWidth*.48)failures.push('footer text overlaps centre ornament');
    }
    if(header.scrollWidth>header.clientWidth+1)failures.push('header overflow');
    for(const el of header.querySelectorAll('button,select')){
      if(el.hidden||el.offsetParent===null)continue;
      const r=el.getBoundingClientRect();
      if(r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5)failures.push('control clipped: '+el.textContent);
      if(Math.min(r.width,r.height)<43.5)failures.push('control smaller than 44px');
    }
    for(const el of root.querySelectorAll('.hp-header button,.hp-scroll-tools button,.hp-layout-centred')) {
      if(el.offsetParent===null)continue;
      const content=el.querySelector('.hp-control-content')||el.querySelector('.hp-layout-content');
      if(!content){failures.push('control has no centred content');continue;}
      const r=el.getBoundingClientRect(),c=content.getBoundingClientRect();
      if(Math.abs((r.left+r.right)-(c.left+c.right))>1||Math.abs((r.top+r.bottom)-(c.top+c.bottom))>1)failures.push('control content is off centre: '+el.textContent);
      const label=content.querySelector('.hp-control-label'),symbol=content.querySelector('svg');
      if(symbol&&getComputedStyle(symbol).display!=='none') {
        const a=label.getBoundingClientRect(),b=symbol.getBoundingClientRect();
        const difference=rotated?(a.left+a.right)-(b.left+b.right):(a.top+a.bottom)-(b.top+b.bottom);
        if(Math.abs(difference)>1)failures.push('symbol and label centres differ');
      }
    }
    if(layout==='37'&&rows.length!==3)failures.push('not three keyboard rows');
    if(document.documentElement.scrollWidth>innerWidth+1)failures.push('horizontal document overflow');
    return {failures,rotated,rows:rows.map(r=>({w:r.clientWidth,h:r.clientHeight})),keys:keyData,background:getComputedStyle(root.querySelector('.hp-surface')).backgroundImage};
  },layout);
  if(result.failures.length)await page.screenshot({path:path.join(output,'failure.png')});
  assert.deepEqual(result.failures,[],`piano ${layout}: ${JSON.stringify(result)}`);
  return result;
}
try{
  for(const [name,width,height,insets={}] of cases){
    const context=await browser.newContext({viewport:{width,height},hasTouch:true,deviceScaleFactor:1});
    await context.addInitScript(name=>{
      if(name==='wide')localStorage.setItem('hp-wallpaper','night');
      if(name==='android')localStorage.setItem('hp-wallpaper','blue');
      Object.defineProperty(navigator,'standalone',{get:()=>true});
      window.sampleStarts=0;window.sampleSources=[];
      const start=AudioBufferSourceNode.prototype.start;
      const stop=AudioBufferSourceNode.prototype.stop;
      AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer&&this.buffer.length>1&&!this.loop){window.sampleStarts++;window.sampleSources.push(this);}return start.apply(this,args);};
      AudioBufferSourceNode.prototype.stop=function(...args){this.qaStops=(this.qaStops||0)+1;return stop.apply(this,args);};
    },name);
    const page=await context.newPage(),errors=[],missing=[];
    await page.route('**/*.css*',route=>{
      const file=path.join(root,new URL(route.request().url()).pathname);
      const css=fs.readFileSync(file,'utf8').replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g,(_,side)=>(insets[side]||0)+'px');
      return route.fulfill({contentType:'text/css',body:css});
    });
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().includes('/assets/piano/')&&r.status()!==200)missing.push(r.url());});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{document.body.classList.remove('hp-booting');document.querySelector('#hp-opening-sequence')?.remove();});
    await page.getByRole('button',{name:'ピアノモードへ',exact:true}).click();
    await page.locator('#hp-four88').waitFor({state:'visible'});
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(async()=>{const image=new Image();image.src='/assets/piano/palace-hall-v4.jpg';await image.decode();});
    await page.waitForTimeout(250);
    metrics.push({name,...await inspect(page)});
    assert.match(metrics.at(-1).background,/palace-hall-v4/);
    await page.screenshot({path:path.join(output,name+'.png')});
    if(name==='wide') {
      await page.evaluate(()=>{window.HP_KEY_PREFS.white=90;window.dispatchEvent(new Event('hp-viewport-resize'));});
      await page.waitForTimeout(100);await inspect(page);
      await page.screenshot({path:path.join(output,'saved-white-90.png')});
      await page.evaluate(()=>{window.HP_KEY_PREFS.white=100;window.dispatchEvent(new Event('hp-viewport-resize'));});
      await page.waitForTimeout(100);
    }
    await page.locator('[data-control="layout"]').selectOption('88');
    await page.waitForTimeout(120);
    const full=await inspect(page,'88');
    for(const sharp of [false,true]) {
      const before=metrics.at(-1).keys.find(key=>key.sharp===sharp),after=full.keys.find(key=>key.sharp===sharp);
      assert.ok(Math.abs(before.w-after.w)<=1&&Math.abs(before.h-after.h)<=1,'88-key dimensions differ from 37-key dimensions');
      if(!sharp)assert.equal(after.labelSize,before.labelSize,'88-key label size differs from 37-key label size');
      assert.ok(after.h/after.w>.65,'88-key image is vertically squashed');
    }
    await page.screenshot({path:path.join(output,name+'-88.png')});
    const scroll=page.locator('.hp-scroll-window');
    await scroll.evaluate(el=>el.scrollTop=el.scrollHeight);await page.waitForTimeout(80);await inspect(page,'88');
    assert.equal(await page.locator('[data-action="lower"]').isDisabled(),true);
    const lowest=await scroll.locator('[data-midi="21"]').boundingBox(),scrollBox=await scroll.boundingBox();
    assert.ok(lowest&&lowest.x>=scrollBox.x-.5&&lowest.y>=scrollBox.y-.5&&lowest.x+lowest.width<=scrollBox.x+scrollBox.width+.5&&lowest.y+lowest.height<=scrollBox.y+scrollBox.height+.5,'lowest A0 is inaccessible');
    await scroll.evaluate(el=>el.scrollTop=0);await page.waitForTimeout(80);await inspect(page,'88');
    assert.equal(await page.locator('[data-action="higher"]').isDisabled(),true);
    assert.ok(await scroll.locator('[data-midi="108"]').isVisible(),'highest C8 is inaccessible');
    if(name==='iphone15pm') {
      await page.locator('[data-action="lower"]').click();await page.waitForTimeout(350);
      assert.ok(await scroll.evaluate(el=>el.scrollTop)>0,'lower register button did not scroll');
      const cdp=await context.newCDPSession(page),box=await scroll.boundingBox();
      const before=await scroll.evaluate(el=>el.scrollTop);
      const p={x:box.x+box.width*.03,y:box.y+box.height*.8,id:70};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,y:p.y-80}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.ok(await scroll.evaluate(el=>el.scrollTop)>before,'88-key blank-space swipe did not scroll');
      await page.screenshot({path:path.join(output,'88-keys.png')});
    }
    await page.locator('[data-control="layout"]').selectOption('37');
    if(name==='iphone15pm'){
      await page.evaluate(()=>{
        window.notes=[];
        document.querySelector('#hp-four88').addEventListener('hp-note-on',e=>window.notes.push(e.detail.midi));
        window.dispatchEvent(new Event('hp-curtain-start'));
      });
      await page.waitForFunction(()=>!document.querySelector('.hp-stage .hp-key').disabled,null,{timeout:30000});
      if(await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());
      const white=page.locator('.hp-stage [data-midi="60"]'),black=page.locator('.hp-stage [data-midi="61"]');
      const box=await white.boundingBox();
      const point={x:box.x+box.width*.3,y:box.y+box.height*.8};
      const oldStarts=await page.evaluate(()=>window.sampleStarts);
      await page.mouse.move(point.x,point.y);await page.mouse.down();
      await page.waitForFunction(()=>document.querySelector('.hp-stage [data-midi="60"]').getAttribute('aria-pressed')==='true');
      await page.waitForTimeout(60);
      const depressed=await white.evaluate(el=>({face:getComputedStyle(el.querySelector('.hp-key-face')).transform,box:el.getBoundingClientRect().toJSON()}));
      assert.ok(new DOMMatrixShim(depressed.face).y>=3,'white face did not sink');
      assert.ok(Math.abs(depressed.box.y-box.y)<.1,'pressed hit area moved');
      assert.equal(await page.evaluate(()=>window.notes.at(-1)),60);
      assert.ok(await page.evaluate(()=>window.sampleStarts)>oldStarts,'actual piano sample did not start');
      await page.screenshot({path:path.join(output,'white-pressed.png')});
      const blackBox=await black.boundingBox();
      await page.mouse.move(blackBox.x+blackBox.width/2,blackBox.y+blackBox.height/2);
      await page.waitForFunction(()=>document.querySelector('.hp-stage [data-midi="61"]').getAttribute('aria-pressed')==='true');
      assert.equal(await white.getAttribute('aria-pressed'),'false','slide did not release white key');
      assert.equal(await page.evaluate(()=>window.notes.at(-1)),61,'black key did not win overlap');
      await page.waitForTimeout(60);
      assert.ok(new DOMMatrixShim(await black.locator('.hp-key-face').evaluate(el=>getComputedStyle(el).transform)).y>=3,'black face did not sink');
      await page.screenshot({path:path.join(output,'black-pressed.png')});
      await page.mouse.up();await page.waitForTimeout(80);
      assert.equal(await black.getAttribute('aria-pressed'),'false');
      assert.equal(new DOMMatrixShim(await black.locator('.hp-key-face').evaluate(el=>getComputedStyle(el).transform)).y,0,'released key stayed sunk during afterglow');
      // Two genuine touch points must depress and release independently.
      const cdp=await context.newCDPSession(page),b1=await white.boundingBox(),b2=await black.boundingBox();
      const p1={x:b1.x+b1.width*.25,y:b1.y+b1.height*.85,id:1},p2={x:b2.x+b2.width*.5,y:b2.y+b2.height*.5,id:2};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2]});
      await page.waitForFunction(()=>['60','61'].every(m=>document.querySelector('.hp-stage [data-midi="'+m+'"]').getAttribute('aria-pressed')==='true'));
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p1]});
      await page.waitForFunction(()=>document.querySelector('.hp-stage [data-midi="60"]').getAttribute('aria-pressed')==='false');
      assert.equal(await black.getAttribute('aria-pressed'),'true');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      await page.waitForFunction(()=>!document.querySelector('.hp-stage .hp-key[aria-pressed="true"]'));
      // A tap down/up in the same frame is still visible; no orange touch border.
      const fastTap=await white.evaluate(el=>{
        const r=el.getBoundingClientRect(),face=el.querySelector('.hp-key-face');
        const border=getComputedStyle(face).borderColor;
        for(const type of ['pointerdown','pointerup'])el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:900,pointerType:'touch',clientX:r.x+r.width*.3,clientY:r.y+r.height*.8}));
        return {pressed:el.dataset.pressed,transform:getComputedStyle(face).transform,borderBefore:border,borderAfter:getComputedStyle(face).borderColor,glow:getComputedStyle(el.querySelector('.hp-key-glow')).display};
      });
      assert.equal(fastTap.pressed,'true','same-frame tap had no physical feedback');
      assert.ok(new DOMMatrixShim(fastTap.transform).y>=3,'same-frame tap did not sink');
      assert.equal(fastTap.borderAfter,fastTap.borderBefore,'touch changed border colour');assert.equal(fastTap.glow,'none','orange touch frame still visible');
      await page.waitForTimeout(100);assert.equal(await white.getAttribute('data-pressed'),'false','short tap never released');
      // Two fingers on one note: releasing either finger must leave the other held.
      const same1={...p1,id:11},same2={...p1,x:p1.x+10,id:12};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[same1,same2]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[same1]});
      assert.equal(await white.getAttribute('data-pressed'),'true','first finger released the second');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(100);
      assert.equal(await white.getAttribute('data-pressed'),'false');
      // Simulate slow mobile audio resumption; visual response is immediate and a
      // cancelled quick tap must not begin sounding after the finger has lifted.
      await page.evaluate(async()=>{
        const ctx=window.HP_AUDIO_BRIDGE.get().context;await ctx.suspend();
        window.restoreResume=ctx.resume.bind(ctx);
        ctx.resume=()=>new Promise(resolve=>setTimeout(()=>window.restoreResume().then(resolve),150));
      });
      const delayed=await white.evaluate(el=>{
        const r=el.getBoundingClientRect(),before=window.sampleStarts;
        el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:901,pointerType:'touch',clientX:r.x+r.width*.3,clientY:r.y+r.height*.8}));
        const result={pressed:el.dataset.pressed,transform:getComputedStyle(el.querySelector('.hp-key-face')).transform,before,after:window.sampleStarts};
        el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:901,pointerType:'touch'}));return result;
      });
      assert.equal(delayed.pressed,'true');assert.ok(new DOMMatrixShim(delayed.transform).y>=3,'audio resume blocked depression');assert.equal(delayed.before,delayed.after);
      await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.sampleStarts),delayed.before,'cancelled tap sounded after resume');
      await page.evaluate(()=>{window.HP_AUDIO_BRIDGE.get().context.resume=window.restoreResume;delete window.restoreResume;});
      // Recording uses the same sampled input and retains the exact take duration.
      const record=page.locator('[data-action="record"]'),play=page.locator('[data-action="play"]');await record.click();
      const checkRedPlate=async button=>{
        const paint=await button.evaluate(el=>({body:getComputedStyle(el).backgroundColor,plate:getComputedStyle(el,'::before').backgroundImage}));
        assert.equal(paint.body,'rgba(0, 0, 0, 0)','red paint escaped the mobile plate');
        assert.match(paint.plate,/141, 51, 70/,'stop plate did not turn red');
      };
      await checkRedPlate(record);
      await page.screenshot({path:path.join(output,'recording-red.png')});
      await page.mouse.move(point.x,point.y);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();
      await page.waitForTimeout(250);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();
      await page.waitForTimeout(200);await record.click();
      const take=await page.evaluate(()=>JSON.parse(localStorage.getItem('piano-palette-multitrack-v1')).tracks.at(-1));
      assert.ok(take.notes.some(n=>n.midi===60),'pressed note missing from recording');
      assert.ok(take.duration>=.2&&take.duration<3,'recorded stop duration incorrect');
      const beforePlay=await page.evaluate(()=>window.sampleStarts);
      await play.click();
      await page.waitForFunction(count=>window.sampleStarts>count,beforePlay);
      assert.equal(await play.getAttribute('aria-pressed'),'true');await checkRedPlate(play);
      await page.screenshot({path:path.join(output,'playback-stop-red.png')});
      // Check actual source.stop() calls, rather than only the playback label:
      // live notes must be cut without cancelling current or scheduled backing.
      const checkLiveStop=async (sourceStart,pointerId)=>{
        await page.evaluate(sourceStart=>{window.qaBacking=window.sampleSources.slice(sourceStart).map(source=>({source,stops:source.qaStops||0}));},sourceStart);
        await white.evaluate((el,pointerId)=>{const r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId,pointerType:'touch',clientX:r.x+r.width*.3,clientY:r.y+r.height*.8}));},pointerId);
        await page.evaluate(()=>{window.qaLive=window.sampleSources.at(-1);window.qaLiveStops=window.qaLive.qaStops||0;});
        await page.locator('[data-action="stop-sound"]').click();
        const result=await page.evaluate(()=>({backingCount:window.qaBacking.length,backingUntouched:window.qaBacking.every(item=>(item.source.qaStops||0)===item.stops),liveCut:(window.qaLive.qaStops||0)>window.qaLiveStops}));
        assert.ok(result.backingCount>=2&&result.backingUntouched,'音停止 cancelled current or scheduled backing sources');
        assert.ok(result.liveCut,'音停止 did not silence the live note');
        assert.equal(await white.getAttribute('data-pressed'),'false');
      };
      await checkLiveStop(beforePlay,910);
      assert.equal(await play.getAttribute('aria-pressed'),'true','音停止 changed playback state');
      await play.click();assert.equal(await play.getAttribute('aria-pressed'),'false');
      const beforeBacking=await page.evaluate(()=>window.sampleStarts);
      await record.click();await page.waitForFunction(count=>window.sampleStarts>count,beforeBacking);
      await checkRedPlate(record);await checkLiveStop(beforeBacking,911);
      assert.equal(await record.getAttribute('aria-pressed'),'true','音停止 ended recording');
      assert.match(await play.textContent(),/伴奏再生中/,'音停止 stopped recording accompaniment');
      await page.mouse.move(point.x,point.y);await page.mouse.down();await page.waitForTimeout(160);await page.mouse.up();
      await record.click();
      const overdub=await page.evaluate(()=>JSON.parse(localStorage.getItem('piano-palette-multitrack-v1')).tracks.at(-1));
      assert.ok(overdub.cuts.length===1&&overdub.notes.some(n=>n.cut),'live cut missing from the recorded take');
      assert.ok(overdub.notes.some(n=>!n.cut),'recording did not continue after 音停止');
      const tracks=page.getByRole('button',{name:'録音一覧',exact:false});await tracks.click();
      await page.locator('.hp-track-panel').waitFor({state:'visible'});
      await page.screenshot({path:path.join(output,'recordings.png')});
      await page.keyboard.press('Escape');
      await page.locator('[data-action="settings"]').click();
      await page.locator('.hp-settings-overlay').waitFor({state:'visible'});
      assert.equal(await page.locator('.hp-stage').evaluate(el=>el.inert),true);
      await page.screenshot({path:path.join(output,'settings.png')});
      for(const id of ['guitar','bass','piano']) {
        await page.locator('[data-control="instrument"]').selectOption(id);
        await page.waitForFunction(id=>document.querySelector('#hp-four88').dataset.instrument===id&&!document.querySelector('.hp-stage .hp-key').disabled,id);
        const icon=await page.locator('[data-output="instrument-label"]').evaluate(el=>({image:getComputedStyle(el,'::before').backgroundImage,width:parseFloat(getComputedStyle(el,'::before').width)}));
        assert.ok(icon.image!=='none'&&icon.width>0,'missing instrument footer icon: '+id);
        if(id!=='piano') {
          assert.match(icon.image,new RegExp(id+'-icon'));
          await page.locator('[data-action="settings-close"]').click();
          await inspect(page);await page.screenshot({path:path.join(output,id+'-icon.png')});
          await page.locator('[data-action="settings"]').click();
        }
      }
      for(const [kind,value] of [['white','60'],['black','60'],['edge','48']])await page.locator('[data-key-size="'+kind+'"]').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
      await page.locator('[data-action="settings-close"]').click();await inspect(page);
      await page.locator('[data-action="settings"]').click();await page.locator('[data-action="key-size-reset"]').click();
      await page.locator('[data-action="settings-close"]').click();await inspect(page);
      await page.emulateMedia({reducedMotion:'reduce'});
      await white.click();
      assert.equal(await white.locator('.hp-key-face').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
      console.log('PASS actual white/black samples; stable rapid taps/slide/multitouch; live-only 音停止 during playback and overdub; red stop plates; all instrument icons; recording/playback; overlays; key sizes; reduced motion');
    }
    await page.getByRole('button',{name:'ホームへ戻る',exact:true}).click();
    await page.locator('#hp-home-screen').waitFor({state:'visible'});
    await page.getByRole('button',{name:'ピアノモードへ',exact:true}).click();await page.locator('#hp-four88').waitFor({state:'visible'});
    await inspect(page);
    assert.deepEqual(errors,[],'browser errors');assert.deepEqual(missing,[],'missing piano art');
    console.log('PASS piano '+name+' '+width+'x'+height+'; 37/88 keys; HOME round trip');
    await context.close();
  }
}finally{fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(metrics,null,2));await browser.close();server.close();}
function DOMMatrixShim(value){this.y=value==='none'?0:Number(value.match(/^matrix\(([^)]+)\)$/)[1].split(',')[5]);}
