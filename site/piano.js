
(() => {
  const root = document.getElementById('hp-four88');
  const keyboard = root.querySelector('.hp-keyboard');
  const action = name => root.querySelector('[data-action="' + name + '"]');
  const status = root.querySelector('.hp-status');
  const output = root.querySelector('[data-output="notes"]');
  const volume = root.querySelector('[data-control="volume"]');
  const reverbControl = root.querySelector('[data-control="reverb"]');
  const decayControl = root.querySelector('[data-control="decay"]');
  const naturals = [0, 2, 4, 5, 7, 9, 11];
  const syllables = ['ド', 'レ', 'ミ', 'ファ', 'ソ', 'ラ', 'シ'];
  const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const rows = [
    {base:72, name:'高音', label:'C5–C6', white:['Q','W','E','R','T','Y','U'], wc:['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU'], black:['2','3','','5','6','7',''], bc:['Digit2','Digit3','','Digit5','Digit6','Digit7','']},
    {base:60, name:'中音', label:'C4–B4', white:['Z','X','C','V','B','N','M'], wc:['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM'], black:['S','D','','G','H','J',''], bc:['KeyS','KeyD','','KeyG','KeyH','KeyJ','']},
    {base:48, name:'低音', label:'C3–B3', white:[',','.','/','O','P','[',']'], wc:['Comma','Period','Slash','KeyO','KeyP','BracketLeft','BracketRight'], black:['L',';','','0','-','=',''], bc:['KeyL','Semicolon','','Digit0','Minus','Equal','']}
  ];
  const buttons = new Map();
  const shortcuts = new Map();
  const held = new Map();
  const pendingNoteOns = new Map();
  const pointerStarts = new Map();
  const allVoices = new Set();
  const playingCounts = new Map();
  let ctx, master, compressor, reverb, wet, reverbInput, effects, ambienceSend, resumePromise = null;
  const effectUI = window.HP_EFFECTS_UI;
  const ambience = {piano:{amount:35,decay:.05},bass:{amount:4,decay:.3}};
  const articulation={piano:{release:.07,sustain:true},guitar:{release:.05,sustain:true},bass:{release:.06,sustain:true}};
  const releaseControl=root.querySelector('[data-control="release"]');
  let ambienceInstrument = 'piano';
  let samplesReady = false, sampleBuffers = new Map(), currentInstrument = 'piano', loadGeneration = 0;
  const instruments = window.HP_INSTRUMENTS;
  const bankCache = new Map(), bankLoads = new Map(), sampleCounters = new Map();
  const instrumentControl = root.querySelector('[data-control="instrument"]');
  const settingsOverlay = root.querySelector('.hp-settings-overlay');
  let sustain = false, showSharps = true, recording = false, playing = false;
  let events = [], recordStart = 0, recordDuration = 0, timer = null;
  let playbackTimers = [], playbackVoices = [], playGeneration = 0, scheduler = null;
  let eventCount = 0;
  const pitchName = midi => noteNames[midi % 12] + (Math.floor(midi / 12) - 1);
  const say = (message, error = false) => {
    status.textContent = message; status.dataset.error = String(error);
    root.querySelector('[data-output="instrument-status"]').textContent = message;
  };

  function makeKey(midi, text, shortcut, code, sharp = false) {
    const key = document.createElement('button');
    key.disabled = !samplesReady; key.type = 'button'; key.className = 'hp-key' + (sharp ? ' hp-sharp' : '');
    key.dataset.midi = midi; key.setAttribute('aria-label', text + ' ' + pitchName(midi));
    key.setAttribute('aria-pressed', 'false');
    if (!sharp) {
      const octave = document.createElement('span'); octave.className = 'hp-octave';
      octave.textContent = midi >= 84 ? '••' : midi >= 72 ? '•' : '';
      const digit = document.createElement('span'); digit.className = 'hp-digit'; digit.textContent = String(naturals.indexOf(midi % 12) + 1);
      const label = document.createElement('span'); label.className = 'hp-syllable'; label.textContent = syllables[naturals.indexOf(midi % 12)];
      if (midi < 60) key.classList.add('hp-low');
      key.append(octave, digit, label);
    }
    const glow = document.createElement('span'); glow.className = 'hp-key-glow';
    glow.setAttribute('aria-hidden','true'); key.append(glow);
    if (!buttons.has(midi)) buttons.set(midi, []);
    buttons.get(midi).push(key); if (code) shortcuts.set(code, {midi, sharp});
    return key;
  }
  function build37(shift = 0) {
  keyboard.querySelectorAll('[data-midi]').forEach(key => {
    const midi=Number(key.dataset.midi), remaining=(buttons.get(midi)||[]).filter(item=>item!==key);
    if(remaining.length)buttons.set(midi,remaining);else buttons.delete(midi);
  });
  keyboard.replaceChildren(); shortcuts.clear();
  rows.forEach((sourceRow, rowIndex) => {
    const row = {...sourceRow,base:sourceRow.base+shift};
    const section = document.createElement('div'); section.className = 'hp-register-section';
    section.setAttribute('role','group'); section.setAttribute('aria-label',row.name);
    const firstX = rowIndex === 0 ? 6 : 12.3;
    const stepX = 88 / 7;
    naturals.forEach((semitone, index) => {
      const white = makeKey(row.base + semitone, syllables[index], row.white[index], row.wc[index]);
      white.style.left = (firstX + index * stepX) + '%'; section.append(white);
      if (row.bc[index]) {
        const black = makeKey(row.base + semitone + 1, syllables[index] + '♯', row.black[index], row.bc[index], true);
        black.style.left = (firstX + (index + .5) * stepX) + '%'; section.append(black);
      }
    });
    if (rowIndex === 0) {
      const top = makeKey(84+shift, '高いド', 'I', 'KeyI'); top.style.left = '94%'; section.append(top);
    }
    section.setAttribute('aria-label',row.name+' '+pitchName(row.base)+'から');
    section.querySelectorAll('.hp-key:not(.hp-sharp)').forEach(key=>{
      key.classList.toggle('hp-low',rowIndex===2);
      key.querySelector('.hp-octave').textContent=rowIndex===0?'•':'';
    });
    keyboard.append(section);
  });
  }
  build37();

  const pianoView = root.querySelector('.hp-piano-view');
  const pianoScroll = root.querySelector('.hp-scroll-window');
  const octaveStack = root.querySelector('.hp-octave-stack');
  const layoutControl = root.querySelector('[data-control="layout"]');
  const octaveGroups = [];
  for (let octave=7;octave>=0;octave--) {
    const lo = octave===0 ? 21 : (octave+1)*12;
    const hi = octave===7 ? 108 : (octave+1)*12+11;
    const block = document.createElement('section'); block.className = 'hp-octave-block';
    block.setAttribute('aria-label',pitchName(lo)+'から'+pitchName(hi));
    const heading = document.createElement('div'); heading.className = 'hp-octave-title';
    const range = document.createElement('span'); range.textContent = pitchName(lo)+'–'+pitchName(hi);
    const kind = document.createElement('span'); kind.textContent = octave>=5 ? '高音' : octave===4 ? '中央のドから' : octave<=1 ? '最低音域' : '低音';
    heading.append(range,kind);
    const row = document.createElement('div'); row.className = 'hp-register-section';
    for (let midi=lo;midi<=hi;midi++) {
      const sharp = !naturals.includes(midi%12);
      const key = makeKey(midi,pitchName(midi),'',null,sharp);
      let x;
      if (octave===0) x = midi===21 ? 37.5 : midi===22 ? 50 : 62.5;
      else {
        const index = midi===108 ? 7 : sharp ? naturals.indexOf(midi%12-1)+.5 : naturals.indexOf(midi%12);
        x = (octave===7 ? 6 : 12.3) + index * (88/7);
      }
      key.style.left = x+'%';
      if (!sharp) key.querySelector('.hp-octave').textContent = '';
      row.append(key);
    }
    block.append(heading,row); octaveStack.append(block); octaveGroups.push({lo,hi,block});
  }
  let activeTopRow = 1;
  const rowHeight = () => parseFloat(pianoScroll.style.getPropertyValue('--hp-row-height')) || 70;
  function showRegister() {
    if (pianoView.hidden) return;
    const height = rowHeight();
    const first = Math.max(0,Math.min(4,Math.floor(pianoScroll.scrollTop/height+.02)));
    const last = Math.min(octaveGroups.length-1,first+3);
    activeTopRow = first;
    const label = pitchName(octaveGroups[last].lo)+'–'+pitchName(octaveGroups[first].hi);
    const display = root.querySelector('[data-output="register"]');
    if (display.textContent!==label) display.textContent=label;
    action('higher').disabled = pianoScroll.scrollTop<=1;
    action('lower').disabled = pianoScroll.scrollTop>=pianoScroll.scrollHeight-pianoScroll.clientHeight-1;
  }
  function sizeRegister() {
    if (!root.querySelector('.hp-stage').hidden && keyboard.clientHeight > 0) {
      keyboard.style.setProperty('--hp-37-row',keyboard.clientHeight/3+'px');
    }
    function fitKeys(container,is37) {
      container.querySelectorAll('.hp-register-section').forEach(section=>{
        if(!section.clientWidth||!section.clientHeight)return;
        const sizes=window.HP_KEY_LAYOUT(section.clientWidth,section.clientHeight,is37);
        for(const [name,value] of Object.entries(sizes)) {
          const property='--hp-'+name.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase());
          section.style.setProperty(property,value+'px');
        }
      });
    }
    if(!root.querySelector('.hp-stage').hidden)fitKeys(keyboard,true);
    if (pianoView.hidden) return;
    if (pianoScroll.clientHeight > 0) pianoScroll.style.setProperty('--hp-row-height', pianoScroll.clientHeight / 4 + 'px');
    fitKeys(octaveStack,false);
    pianoScroll.scrollTop = activeTopRow*rowHeight(); showRegister();
  }
  pianoScroll.addEventListener('scroll',showRegister,{passive:true});
  action('higher').addEventListener('click',() => { releaseHeld(); pianoScroll.scrollBy({top:-rowHeight(),behavior:'smooth'}); });
  action('lower').addEventListener('click',() => { releaseHeld(); pianoScroll.scrollBy({top:rowHeight(),behavior:'smooth'}); });
  new ResizeObserver(sizeRegister).observe(pianoScroll);
  new ResizeObserver(sizeRegister).observe(keyboard);
  requestAnimationFrame(sizeRegister);
  window.addEventListener('hp-viewport-resize', () => {
    releaseHeld(); pointerStarts.clear(); requestAnimationFrame(sizeRegister);
  });
  layoutControl.addEventListener('change',() => {
    releaseHeld(); const enabled = layoutControl.value==='88';
    pianoView.hidden = !enabled; root.querySelector('.hp-stage').hidden = enabled;
    requestAnimationFrame(sizeRegister);
  });

  function ensureAudio() {
    try {
      if (!ctx) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('unsupported');
        ctx = new Audio({latencyHint:'interactive'});
        master = ctx.createGain(); master.gain.value = Number(volume.value) / 100 * .9;
        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -8; compressor.knee.value = 15; compressor.ratio.value = 4;
        compressor.attack.value = .004; compressor.release.value = .22;
        const warmth = ctx.createBiquadFilter(); warmth.type = 'lowshelf'; warmth.frequency.value = 190; warmth.gain.value = 1.8;
        const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 4800; air.gain.value = -1;
        const ceiling = ctx.createWaveShaper(), ceilingCurve = new Float32Array(8193);
        for(let i=0;i<ceilingCurve.length;i++) {
          const x=i/(ceilingCurve.length-1)*2-1, magnitude=Math.abs(x);
          ceilingCurve[i]=Math.sign(x)*(magnitude<=.8?magnitude:.8+.18*Math.tanh((magnitude-.8)/.18));
        }
        ceiling.curve=ceilingCurve;
        master.connect(warmth); warmth.connect(air); air.connect(compressor); compressor.connect(ceiling); ceiling.connect(ctx.destination);
        reverb = ctx.createConvolver(); reverb.normalize = false;
        wet = ctx.createGain(); wet.gain.value = Number(reverbControl.value)/100 * 1.25;
        reverbInput = ctx.createDelay(.1); reverbInput.delayTime.value = .025;
        const rumble = ctx.createBiquadFilter(); rumble.type = 'highpass'; rumble.frequency.value = 100;
        const damping = ctx.createBiquadFilter(); damping.type = 'lowpass'; damping.frequency.value = 6200;
        reverbInput.connect(reverb); reverb.connect(rumble); rumble.connect(damping); damping.connect(wet); wet.connect(master);
        effects=effectUI.attach(ctx); ambienceSend=ctx.createGain();
        ambienceSend.gain.value=currentInstrument!=='piano'?0:1;
        effects.output.connect(master); effects.output.connect(ambienceSend); ambienceSend.connect(reverbInput);
        updateReverb();
      }
      if (ctx.state !== 'running') {
        void resumeAudioContext().then(ok => {
          if (!ok) say('もう一度鍵盤をタップして音を有効にしてください',true);
        });
      }
      return true;
    } catch (_) { say('この表示では音声を開始できません',true); return false; }
  }

  function resumeAudioContext() {
    if (!ctx) return Promise.resolve(false);
    if (ctx.state === 'running') return Promise.resolve(true);
    if (!resumePromise) {
      resumePromise = ctx.resume()
        .then(() => ctx.state === 'running')
        .catch(() => false)
        .finally(() => { resumePromise = null; });
    }
    return resumePromise;
  }

  window.HP_AUDIO_BRIDGE = {
    get() {
      if (!ensureAudio() || !ctx || !master) return null;
      return {context:ctx, output:master};
    },
    async resume() {
      if (!ensureAudio() || !ctx) return false;
      return await resumeAudioContext();
    }
  };

  function updateReverb() {
    if (!ctx || !reverb) return;
    const decay = Number(decayControl.value);
    const impulse = ctx.createBuffer(2,Math.ceil(ctx.sampleRate * decay * 1.25),ctx.sampleRate);
    let seed = 91723;
    for (let channel=0; channel<2; channel++) {
      const values = impulse.getChannelData(channel); let smooth = 0, energy = 0;
      for (let i=0;i<values.length;i++) {
        seed = (1664525 * seed + 1013904223) >>> 0;
        const t = i/ctx.sampleRate;
        const cutoff = 7600 * Math.exp(-t/(decay*.75)) + 900;
        const coefficient = 1 - Math.exp(-2*Math.PI*cutoff/ctx.sampleRate);
        smooth += coefficient * (seed/2147483648-1-smooth);
        values[i] = smooth * Math.exp(-6.907755*t/decay) * Math.min(1,t/.035);
        energy += values[i]*values[i];
      }
      const scale = 1 / Math.sqrt(Math.max(energy,.000001));
      for (let i=0;i<values.length;i++) values[i] *= scale;
    }
    reverb.buffer = impulse;
  }
  reverbControl.addEventListener('input', () => {
    if(ambience[ambienceInstrument])ambience[ambienceInstrument].amount=Number(reverbControl.value);
    root.querySelector('[data-output="reverb"]').textContent = reverbControl.value+'%';
    if (wet) wet.gain.setTargetAtTime(currentInstrument!=='piano'?0:Number(reverbControl.value)/100*1.25,ctx.currentTime,.045);
  });
  decayControl.addEventListener('input', () => { if(ambience[ambienceInstrument])ambience[ambienceInstrument].decay=Number(decayControl.value); root.querySelector('[data-output="decay"]').textContent = Number(decayControl.value).toFixed(1)+'秒'; });
  decayControl.addEventListener('change', updateReverb);

  async function requestLandscape() {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation?.lock) await screen.orientation.lock('landscape');
    } catch (_) {
      // The page already fits a landscape canvas when native locking is unavailable.
    }
  }

  function updateInstrumentUI() {
    const preset=instruments[currentInstrument];
    sustain=articulation[currentInstrument].sustain;
    releaseControl.value=articulation[currentInstrument].release;
    releaseControl.dispatchEvent(new Event('input'));
    action('sustain').setAttribute('aria-pressed',String(sustain));
    action('sustain').textContent=sustain?'音を伸ばす：ON':'音を伸ばす：OFF';
    instrumentControl.value=currentInstrument;
    root.querySelector('[data-output="instrument-label"]').textContent=preset.name;
    root.querySelector('[data-output="instrument-description"]').textContent=preset.description;
    root.querySelector('.hp-surface').setAttribute('aria-label',preset.name);
    effectUI.setReady(samplesReady);
    void effectUI.setInstrument(currentInstrument);
    root.querySelectorAll('[data-common-ambience]').forEach(label=>label.hidden=currentInstrument!=='piano');
    if(ambienceSend)ambienceSend.gain.setTargetAtTime(currentInstrument!=='piano'?0:1,ctx.currentTime,.03);
    if(wet)wet.gain.setTargetAtTime(currentInstrument!=='piano'?0:Number(reverbControl.value)/100*1.25,ctx.currentTime,.03);
    if(ambienceInstrument!==currentInstrument) {
      ambienceInstrument=currentInstrument;
      if(ambience[currentInstrument]) {
        reverbControl.value=ambience[currentInstrument].amount;
        decayControl.value=ambience[currentInstrument].decay;
        reverbControl.dispatchEvent(new Event('input')); decayControl.dispatchEvent(new Event('input'));
        updateReverb();
      }
    }
  }
  async function loadBank(id, generation) {
    const preset=instruments[id];
    if(!bankCache.has(id))bankCache.set(id,new Map());
    const decoded=bankCache.get(id);
    if(!bankLoads.has(id)) {
      const pending=preset.samples.filter(sample=>!decoded.has(sample.url));
      let cursor=0;
      const failures=[];
      const task=Promise.all(Array.from({length:Math.min(6,pending.length)},async()=>{
        while(cursor<pending.length) {
          const descriptor=pending[cursor++];
          try {
            const response=await fetch(descriptor.url,{cache:'force-cache'});
            if(!response.ok)throw new Error('Audio download failed');
            const buffer=await ctx.decodeAudioData(await response.arrayBuffer());
            const left=buffer.getChannelData(0),right=buffer.getChannelData(Math.min(1,buffer.numberOfChannels-1));
            let first=0,end=Math.min(left.length,Math.floor(buffer.sampleRate*.12));
            while(first<end&&Math.max(Math.abs(left[first]),Math.abs(right[first]))<.0005)first++;
            const offset=first<end?Math.max(0,(first-32)/buffer.sampleRate):0;
            decoded.set(descriptor.url,{buffer,offset});
            if(generation===loadGeneration)say(preset.name+'を読み込み中 · '+decoded.size+' / '+preset.samples.length);
          } catch(error) {failures.push(error);}
        }
      })).then(()=>{if(failures.length)throw failures[0];}).finally(()=>bankLoads.delete(id));
      bankLoads.set(id,task);
    }
    await bankLoads.get(id);
    const bank=new Map();
    preset.samples.forEach(descriptor=>{
      if(!bank.has(descriptor.midi))bank.set(descriptor.midi,[]);
      bank.get(descriptor.midi).push(decoded.get(descriptor.url));
    });
    return bank;
  }
  async function prepareSamples(id=instrumentControl.value) {
    if(!instruments[id]||!ensureAudio())return;
    void requestLandscape();
    const generation=++loadGeneration,previous=currentInstrument,previousBank=sampleBuffers,wasReady=samplesReady;
    finishRecording(); stopPlayback(); releaseHeld(); pointerStarts.clear();
    allVoices.forEach(voice=>voice.release(ctx.currentTime,.08));
    samplesReady=false; buttons.forEach(list=>list.forEach(button=>button.disabled=true));
    effectUI.setReady(false);
    instrumentControl.disabled=true; action('record').disabled=true; action('play').disabled=true;
    const startButton=action('start'); startButton.disabled=true; startButton.textContent='音源を準備中…';
    say(instruments[id].name+'を準備中');
    try {
      await ctx.resume();
      const bank=await loadBank(id,generation);
      if(generation!==loadGeneration)return;
      await effectUI.setInstrument(id);
      currentInstrument=id; sampleBuffers=bank; sampleCounters.clear(); samplesReady=true;
      build37(instruments[id].shift37); updateInstrumentUI();
      if(id!==previous)activeTopRow=instruments[id].row88;
      requestAnimationFrame(sizeRegister);
      startButton.hidden=true; say(instruments[id].name+'で演奏できます');
    } catch(_) {
      if(generation!==loadGeneration)return;
      currentInstrument=previous; sampleBuffers=previousBank; samplesReady=wasReady;
      updateInstrumentUI();
      startButton.hidden=wasReady; startButton.textContent='音源を再準備';
      say(wasReady?'音源を読み込めなかったため、前の音源に戻しました。':'音源を読み込めませんでした。通信を確認して、もう一度お試しください',true);
    } finally {
      if(generation===loadGeneration) {
        instrumentControl.disabled=false; startButton.disabled=false;
        buttons.forEach(list=>list.forEach(button=>button.disabled=!samplesReady));
        action('record').disabled=!samplesReady; action('play').disabled=!samplesReady||events.length===0;
      }
    }
  }
  instrumentControl.addEventListener('change',()=>{
    const id=instrumentControl.value;
    if(!instruments[id])return;
    if(!ctx) {
      currentInstrument=id; build37(instruments[id].shift37); updateInstrumentUI();
      activeTopRow=instruments[id].row88; requestAnimationFrame(sizeRegister);
      say('演奏をはじめるボタンで'+instruments[id].name+'を準備');
    } else {void prepareSamples(id);}
  });

  function synth(midi, when = ctx.currentTime) {
    while (allVoices.size >= 48) {
      const oldest = allVoices.values().next().value; oldest.release(ctx.currentTime,.04); allVoices.delete(oldest);
    }
    const anchor = Array.from(sampleBuffers.keys()).reduce((best,note) => Math.abs(note-midi) < Math.abs(best-midi) ? note : best);
    const variants = sampleBuffers.get(anchor), index = sampleCounters.get(anchor)||0;
    const sample = variants[index%variants.length]; sampleCounters.set(anchor,index+1);
    const preset = instruments[currentInstrument];
    const source = ctx.createBufferSource(), bus = ctx.createGain();
    source.buffer = sample.buffer; source.playbackRate.value = Math.pow(2,(midi-anchor)/12);
    const level = preset.gain;
    bus.gain.setValueAtTime(.00001,when); bus.gain.linearRampToValueAtTime(level,when+.002);
    const fade = ctx.createGain();
    const naturalDuration = (sample.buffer.duration-sample.offset)/source.playbackRate.value;
    fade.gain.setValueAtTime(1,when); fade.gain.setValueAtTime(1,when+Math.max(.01,naturalDuration-.25)); fade.gain.linearRampToValueAtTime(0,when+naturalDuration);
    source.connect(fade); fade.connect(bus); bus.connect(effects.input);
    let ended = false, releaseAt = Infinity, releaseEnd = Infinity, releaseLevel = level;
    const voice = {release(at = ctx.currentTime, seconds = sustain ? Infinity : articulation[currentInstrument].release) {
      if (ended) return;
      if (!Number.isFinite(seconds)) return;
      if (at < when) {
        bus.gain.cancelScheduledValues(when); bus.gain.setValueAtTime(.00001,when);
        try { source.stop(when); } catch (_) {}
        releaseAt = when; releaseEnd = when; return;
      }
      const time = Math.max(when+.003,at);
      if (time+seconds >= releaseEnd) return;
      const current = time <= releaseAt ? level : Math.max(.00001,releaseLevel * Math.pow(.01,(time-releaseAt)/(releaseEnd-releaseAt)));
      bus.gain.cancelScheduledValues(time); bus.gain.setValueAtTime(current,time);
      bus.gain.exponentialRampToValueAtTime(Math.max(.00001,current*.01),time+seconds);
      bus.gain.linearRampToValueAtTime(0,time+seconds+.03);
      releaseAt = time; releaseEnd = time+seconds; releaseLevel = current;
      try { source.stop(time+seconds+.04); } catch (_) {}
    }};
    source.onended = () => { ended = true; source.disconnect(); fade.disconnect(); bus.disconnect(); allVoices.delete(voice); };
    source.start(when,sample.offset); allVoices.add(voice); return voice;
  }

  function sparkle(midi) {
    (buttons.get(midi)||[]).forEach(key => {
      const stage = key.closest('.hp-stage');
      if ((stage && stage.hidden) || (!stage && pianoView.hidden)) return;
      clearTimeout(key.hpGlowTimer); key.classList.add('hp-lit');
      key.hpGlowTimer = setTimeout(() => key.classList.remove('hp-lit'),480);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const burst = document.createElement('span'); burst.className='hp-spark-burst'; burst.setAttribute('aria-hidden','true');
      for(let i=0;i<7;i++) {
        const star=document.createElement('span'); star.className='hp-spark'; star.textContent='✦';
        const angle=-Math.PI+(i/6)*Math.PI;
        star.style.setProperty('--spark-x',(Math.cos(angle)*(28+Math.random()*24))+'px');
        star.style.setProperty('--spark-y',(Math.sin(angle)*(30+Math.random()*28)-8)+'px');
        star.style.setProperty('--spark-delay',(i%3*18)+'ms');
        burst.append(star);
      }
      key.append(burst);
      const live=root.querySelectorAll('.hp-spark-burst');
      if(live.length>14)live[0].remove();
      setTimeout(()=>burst.remove(),850);
    });
  }
  let redrawFrame=0;
  const pendingSparkles=new Set();
  function redraw() {
    if(redrawFrame)return;
    redrawFrame=requestAnimationFrame(()=>{redrawFrame=0;renderNotes();pendingSparkles.forEach(sparkle);pendingSparkles.clear();});
  }
  function renderNotes() {
    const notes = new Set(playingCounts.keys()); held.forEach(entry => notes.add(entry.midi));
    buttons.forEach((list, midi) => list.forEach(button => button.getAttribute('aria-pressed')!==String(notes.has(midi))&&button.setAttribute('aria-pressed', String(notes.has(midi)))));
    output.textContent = notes.size ? Array.from(notes).sort((a,b) => a-b).map(pitchName).join(' · ') : '—';
  }
  function playNoteNow(token, midi) {
    if (!samplesReady || held.has(token) || !ctx || ctx.state !== 'running') return;
    const entry = {midi, voice: synth(midi), event: null};
    if (recording) {
      entry.event = {midi, start: Math.max(0, ctx.currentTime - recordStart), duration: .12, sustain};
      events.push(entry.event); eventCount++;
    }
    held.set(token, entry); root.dispatchEvent(new CustomEvent('hp-note-on',{detail:{token,midi}})); pendingSparkles.add(midi); redraw();
    if (!recording && !playing && status.textContent!=='演奏中') say('演奏中');
  }
  function noteOn(token, midi) {
    if (!samplesReady || held.has(token) || pendingNoteOns.has(token) || !ensureAudio()) return;
    if (ctx.state === 'running') {
      playNoteNow(token,midi);
      return;
    }
    pendingNoteOns.set(token,midi);
    void resumeAudioContext().then(ok => {
      if (pendingNoteOns.get(token) !== midi) return;
      pendingNoteOns.delete(token);
      if (!ok) {
        say('音声を再開できませんでした。もう一度鍵盤をタップしてください',true);
        return;
      }
      playNoteNow(token,midi);
    });
  }
  function noteOff(token) {
    pendingNoteOns.delete(token);
    const entry = held.get(token); if (!entry) return;
    entry.voice.release();
    if (entry.event && recording) entry.event.duration = Math.max(.06, ctx.currentTime - recordStart - entry.event.start);
    root.dispatchEvent(new CustomEvent('hp-note-off',{detail:{token,midi:entry.midi}})); held.delete(token); redraw();
  }
  function releaseHeld() {
    pendingNoteOns.clear();
    Array.from(held.keys()).forEach(noteOff);
  }
  function stopPlayback() {
    playGeneration++; playbackTimers.forEach(clearTimeout); playbackTimers = [];
    clearInterval(scheduler); scheduler = null;
    if (ctx) playbackVoices.forEach(voice => voice.release(ctx.currentTime, .08));
    playbackVoices = []; playingCounts.clear(); playing = false;
    action('play').textContent = '▶ 再生'; redraw();
  }
  function finishRecording() {
    if (!recording) return;
    releaseHeld(); recordDuration = Math.max(.15, ctx.currentTime - recordStart);
    recording = false; clearInterval(timer); timer = null;
    action('record').setAttribute('aria-pressed','false'); action('record').textContent = '● 録音';
    action('play').disabled = events.length === 0;
    say(events.length ? events.length + '音 · ' + recordDuration.toFixed(1) + '秒を記録' : '演奏がありません');
  }
  const localPointer = event => document.documentElement.dataset.hpRotated === 'true'
    ? {x:event.clientY,y:-event.clientX}
    : {x:event.clientX,y:event.clientY};
  root.addEventListener('pointerdown', event => {
    if (!settingsOverlay.hidden || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const key = event.target.closest('[data-midi]');
    const scrollable = !!event.target.closest('.hp-scroll-window');
    if (!key && !scrollable) return;
    event.preventDefault();
    try {root.setPointerCapture(event.pointerId);} catch(_) {}
    const point = localPointer(event);
    pointerStarts.set(event.pointerId,{...point,scrollable:scrollable&&!key,scrollTop:pianoScroll.scrollTop,scrolling:false,lastClientX:event.clientX,lastClientY:event.clientY});
    if (key) noteOn('pointer:' + event.pointerId, Number(key.dataset.midi));
  });
  root.addEventListener('pointermove', event => {
    const token = 'pointer:' + event.pointerId;
    const origin = pointerStarts.get(event.pointerId);
    if (!origin) return;
    const point = localPointer(event), dx = point.x-origin.x, dy = point.y-origin.y;
    if (origin.scrollable && pointerStarts.size === 1 && (origin.scrolling || (Math.abs(dy)>12 && Math.abs(dy)>Math.abs(dx)*1.15))) {
      origin.scrolling = true; noteOff(token);
      pianoScroll.scrollTop = origin.scrollTop-dy;
      showRegister(); return;
    }
    if ((!held.has(token) && !pendingNoteOns.has(token)) || origin.scrolling) return;
    const samples = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
    const points = samples.length ? samples : [event];
    for (const sample of points) {
      const fromX = Number.isFinite(origin.lastClientX) ? origin.lastClientX : sample.clientX;
      const fromY = Number.isFinite(origin.lastClientY) ? origin.lastClientY : sample.clientY;
      const moveX = sample.clientX-fromX, moveY = sample.clientY-fromY;
      const steps = Math.min(18,Math.max(1,Math.ceil(Math.hypot(moveX,moveY)/10)));
      for (let step=1;step<=steps;step++) {
        const x=fromX+moveX*step/steps, y=fromY+moveY*step/steps;
        const hit = document.elementFromPoint(x,y);
        const key = hit && hit.closest('[data-midi]');
        const currentMidi = held.get(token)?.midi ?? pendingNoteOns.get(token);
        if (key && root.contains(key) && Number(key.dataset.midi) !== currentMidi) {
          noteOff(token); noteOn(token, Number(key.dataset.midi));
        }
      }
      origin.lastClientX=sample.clientX; origin.lastClientY=sample.clientY;
    }
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(name => root.addEventListener(name, event => { noteOff('pointer:' + event.pointerId); pointerStarts.delete(event.pointerId); }));
  root.addEventListener('click', event => {
    const key = event.target.closest('[data-midi]');
    if (key && event.detail === 0 && !event.pointerType && !event.sourceCapabilities?.firesTouchEvents) { const token = 'accessible:' + key.dataset.midi; noteOn(token, Number(key.dataset.midi)); setTimeout(() => noteOff(token),180); }
  });
  document.addEventListener('keydown', event => {
    if (!settingsOverlay.hidden) return;
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    if (event.target.matches('input,select,textarea,[contenteditable="true"]')) return;
    const mapped = shortcuts.get(event.code); if (!mapped || (mapped.sharp && !showSharps)) return;
    event.preventDefault(); noteOn('key:' + event.code, mapped.midi);
  });
  document.addEventListener('keyup', event => noteOff('key:' + event.code));
  action('start').addEventListener('click', () => {void prepareSamples();});
  function showSettings(open) {
    releaseHeld(); pointerStarts.clear();
    settingsOverlay.hidden = !open;
    root.querySelectorAll('[data-settings-background]').forEach(element => element.inert = open);
    (open ? action('settings-close') : action('settings')).focus();
  }
  action('settings').addEventListener('click', () => showSettings(true));
  action('settings-close').addEventListener('click', () => showSettings(false));
  action('settings-backdrop').addEventListener('click', () => showSettings(false));
  document.addEventListener('keydown', event => {
    if (settingsOverlay.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); showSettings(false); }
    if (event.key === 'Tab') {
      const focusable = Array.from(settingsOverlay.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,a[href]')).filter(element=>{
        if(element.closest('[hidden]'))return false;
        for(let parent=element.parentElement;parent&&parent!==settingsOverlay;parent=parent.parentElement) {
          if(parent.matches('details:not([open])')&&element!==parent.querySelector(':scope > summary'))return false;
        }
        return true;
      });
      const first = focusable[0], last = focusable[focusable.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  action('sustain').addEventListener('click', () => { sustain = !sustain; articulation[currentInstrument].sustain=sustain; action('sustain').setAttribute('aria-pressed', String(sustain)); action('sustain').textContent=sustain?'音を伸ばす：ON':'音を伸ばす：OFF'; if (!sustain && ctx) { const active=new Set(Array.from(held.values()).map(note=>note.voice)); allVoices.forEach(voice=>{if(!active.has(voice))voice.release(ctx.currentTime,articulation[currentInstrument].release);}); } });
  action('stop-sound').addEventListener('click', () => {
    stopPlayback(); releaseHeld(); pointerStarts.clear();
    if (ctx) {
      allVoices.forEach(voice=>voice.release(ctx.currentTime,.02));
      playingCounts.clear();
      if (reverb) { reverb.buffer=null; updateReverb(); }
    }
    root.dispatchEvent(new Event('hp-stop-sound'));
    redraw(); say('鳴っている音と余韻を止めました');
  });
  action('record').addEventListener('click', () => {
    if (recording) { finishRecording(); return; }
    if (!ensureAudio()) return;
    stopPlayback(); releaseHeld(); events = []; eventCount = 0; recordStart = ctx.currentTime; recording = true;
    action('record').setAttribute('aria-pressed','true'); action('record').textContent = '■ 録音停止'; action('play').disabled = true;
    say('録音中 · 0.0秒');
    timer = setInterval(() => {
      const elapsed = ctx.currentTime - recordStart;
      say('録音中 · ' + elapsed.toFixed(1) + '秒 · ' + eventCount + '音');
      if (elapsed >= 120 || events.length >= 1500) finishRecording();
    }, 100);
  });
  action('play').addEventListener('click', async () => {
    if (playing) { stopPlayback(); say('再生を停止'); return; }
    if (!events.length || !ensureAudio()) return;
    releaseHeld(); playing = true; action('play').textContent = '■ 停止'; say('再生中');
    const generation = ++playGeneration;
    try { await ctx.resume(); } catch (_) { stopPlayback(); say('鍵盤をタップしてから再生してください', true); return; }
    if (generation !== playGeneration) return;
    const start = ctx.currentTime + .08;
    const later = (fn, seconds) => playbackTimers.push(setTimeout(() => { if (generation === playGeneration) fn(); }, Math.max(0, seconds * 1000)));
    let nextEvent = 0;
    function schedule() {
      if (generation !== playGeneration) return;
      while (nextEvent < events.length && start + events[nextEvent].start < ctx.currentTime + .14) {
        const event = events[nextEvent++], when = Math.max(ctx.currentTime, start + event.start);
        const voice = synth(event.midi, when); playbackVoices.push(voice);
        voice.release(when + event.duration, event.sustain ? Infinity : articulation[currentInstrument].release);
        later(() => { playingCounts.set(event.midi, (playingCounts.get(event.midi) || 0) + 1); redraw(); sparkle(event.midi); }, when - ctx.currentTime);
        later(() => { const remaining = (playingCounts.get(event.midi) || 1) - 1; if (remaining) playingCounts.set(event.midi, remaining); else playingCounts.delete(event.midi); redraw(); }, when + event.duration - ctx.currentTime);
      }
      const tail = Math.max(...Array.from(sampleBuffers.values()).flat().map(sample => sample.buffer.duration)) * 1.2 + Number(decayControl.value) * 1.25;
      if (ctx.currentTime >= start + recordDuration + tail) { stopPlayback(); say('再生が終わりました'); }
    }
    schedule(); scheduler = setInterval(schedule, 25);
  });
  releaseControl.addEventListener('input',()=>{articulation[currentInstrument].release=Number(releaseControl.value);root.querySelector('[data-output="release"]').textContent=Number(releaseControl.value).toFixed(2)+'秒';});
  volume.addEventListener('input', () => { root.querySelector('[data-output="volume"]').textContent = volume.value + '%'; if (master) master.gain.setTargetAtTime(Number(volume.value) / 100 * .9, ctx.currentTime, .03); });
  let auditionTimer, auditionVoice;
  root.addEventListener('hp-audition',()=>{
    if(!samplesReady||!ensureAudio())return;
    clearTimeout(auditionTimer);
    auditionVoice?.release(ctx.currentTime,.06);
    noteOff('audition');
    const midi=currentInstrument==='bass'?40:currentInstrument==='guitar'?64:60;
    noteOn('audition',midi);
    const voice=held.get('audition')?.voice; auditionVoice=voice;
    auditionTimer=setTimeout(()=>{noteOff('audition');voice?.release(ctx.currentTime,.5);},600);
  });
  function pauseAll() { releaseHeld(); finishRecording(); if (playing) { stopPlayback(); say('再生を停止'); } if (ctx) allVoices.forEach(voice => voice.release(ctx.currentTime, .08)); }
  window.addEventListener('blur', pauseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); });
  const modelContext = document.modelContext;
  if (modelContext?.registerTool) {
    const lifecycle = new AbortController();
    window.addEventListener('pagehide', () => lifecycle.abort(), {once:true});
    try {
      Promise.resolve(modelContext.registerTool({
        name:'configure_piano_sound',
        title:'ピアノの音を調整',
        description:'Set piano volume, reverb amount and decay using the same controls as the visible sound settings.',
        inputSchema:{
          type:'object',
          properties:{volume:{type:'number',minimum:0,maximum:100},reverb:{type:'number',minimum:0,maximum:100},decay:{type:'number',minimum:0.02,maximum:8,multipleOf:0.01}},
          additionalProperties:false
        },
        annotations:{readOnlyHint:false,untrustedContentHint:false},
        execute(input) {
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected sound settings');
          const bounds={volume:[0,100],reverb:[0,100],decay:[.02,8]};
          Object.entries(input).forEach(([name,value]) => {
            if (!bounds[name] || typeof value !== 'number' || !Number.isFinite(value) || value<bounds[name][0] || value>bounds[name][1] || (name==='decay' && Math.abs(value*100-Math.round(value*100))>1e-8)) throw new Error('Invalid sound setting');
          });
          Object.entries(input).forEach(([name,value]) => {
            const control=root.querySelector('[data-control="'+name+'"]');
            control.value=String(value); control.dispatchEvent(new Event('input')); control.dispatchEvent(new Event('change'));
          });
          return {volume:Number(volume.value),reverb:Number(reverbControl.value),decay:Number(decayControl.value)};
        }
      },{signal:lifecycle.signal})).catch(() => {});
    } catch (_) {}
  }
})();
