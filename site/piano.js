
(() => {
  const root = document.getElementById('hp-four88');
  const keyboard = root.querySelector('.hp-keyboard');
  const action = name => root.querySelector('[data-action="' + name + '"]');
  const status = root.querySelector('.hp-status');
  const output = root.querySelector('[data-output="notes"]');
  const volume = root.querySelector('[data-control="volume"]');
  try {
    const stored = localStorage.getItem('hp-master-volume');
    if (stored !== null && Number.isFinite(Number(stored))) volume.value = Math.max(0, Math.min(100, Number(stored)));
  } catch (_) {}
  root.querySelector('[data-output="volume"]').textContent = volume.value + '%';
  const reverbControl = root.querySelector('[data-control="reverb"]');
  const decayControl = root.querySelector('[data-control="decay"]');
  function configureAudioSession() {
    try {
      // WebKit maps transient to the native ambient category: both Web Audio
      // and media-element BGM obey the iPhone silent switch. Playback bypasses it.
      if (navigator.audioSession && navigator.audioSession.type !== 'transient') {
        navigator.audioSession.type = 'transient';
      }
      return navigator.audioSession?.type || 'unsupported';
    } catch (_) {
      return 'unsupported';
    }
  }
  configureAudioSession();
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
  // Finger/keyboard feedback must not wait for AudioContext.resume or an audio frame.
  const pressedTokens = new Map(), pressedSince = new Map(), pressReleaseTimers = new Map();
  const pointerStarts = new Map();
  const allVoices = new Set();
  const liveVoices = new Set();
  const playingCounts = new Map();
  let ctx, master, compressor, reverb, wet, reverbInput, effects, ambienceSend, violinSpace, resumePromise = null;
  let audioNeedsGestureUnlock = true;
  const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const effectUI = window.HP_EFFECTS_UI;
  const finalInstrumentIds = new Set(['finalChip8','finalKoto','finalTrumpet','finalPipeOrgan','finalVibraphone']);
  const ambienceInstrumentIds = new Set(['piano','finalKoto','finalTrumpet','finalPipeOrgan','finalVibraphone']);
  const supportsAmbience = id => ambienceInstrumentIds.has(id);
  const effectsInstrumentId = id => finalInstrumentIds.has(id) ? 'piano' : id;
  const ambience = {
    piano:{amount:35,decay:.05},
    finalKoto:{amount:18,decay:1.05},
    finalTrumpet:{amount:20,decay:1.35},
    finalPipeOrgan:{amount:54,decay:4.8},
    finalVibraphone:{amount:28,decay:1.9},
    bass:{amount:4,decay:.3}
  };
  const articulation={
    piano:{release:.07,sustain:true},
    finalChip8:{release:.055,sustain:false},
    finalKoto:{release:.34,sustain:true},
    finalTrumpet:{release:.19,sustain:false},
    finalPipeOrgan:{release:.75,sustain:false},
    finalVibraphone:{release:1.6,sustain:true},
    guitar:{release:.05,sustain:true},bass:{release:.06,sustain:true},violin:{release:.3,sustain:false}
  };
  const releaseControl=root.querySelector('[data-control="release"]');
  let ambienceInstrument = 'piano';
  let samplesReady = false, sampleBuffers = new Map(), currentInstrument = 'piano', loadGeneration = 0;
  const instruments = window.HP_INSTRUMENTS;
  const bankCache = new Map(), bankLoads = new Map(), sampleCounters = new Map();
  const instrumentControl = root.querySelector('[data-control="instrument"]');
  const settingsOverlay = root.querySelector('.hp-settings-overlay');
  let sustain = false, showSharps = true, recording = false, playing = false;
  let events = [], recordStart = 0, recordDuration = 0, timer = null, soundStopEvents = [];
  let playbackTimers = [], playbackVoices = [], playGeneration = 0, scheduler = null;
  let eventCount = 0;

  const pitchName = midi => noteNames[midi % 12] + (Math.floor(midi / 12) - 1);
  const isPlayableMidi = (midi,id=currentInstrument) => {
    const range=instruments[id]?.range;
    return !Array.isArray(range) || (midi>=range[0] && midi<=range[1]);
  };
  function updatePlayableKeys() {
    buttons.forEach((list,midi)=>list.forEach(button=>{
      button.disabled=!samplesReady || !isPlayableMidi(midi,currentInstrument);
      button.classList.toggle('hp-key-out-of-range',samplesReady && !isPlayableMidi(midi,currentInstrument));
    }));
  }
  const say = (message, error = false) => {
    status.textContent = message; status.dataset.error = String(error);
    root.querySelector('[data-output="instrument-status"]').textContent = message;
  };

  function makeKey(midi, text, shortcut, code, sharp = false) {
    const key = document.createElement('button');
    key.disabled = !samplesReady; key.type = 'button'; key.className = 'hp-key' + (sharp ? ' hp-sharp' : '');
    key.dataset.midi = midi; key.setAttribute('aria-label', text + ' ' + pitchName(midi));
    key.setAttribute('aria-pressed', 'false');
    const face = document.createElement('span'); face.className = 'hp-key-face';
    if (!sharp) {
      const octave = document.createElement('span'); octave.className = 'hp-octave';
      octave.textContent = midi >= 84 ? '••' : midi >= 72 ? '•' : '';
      const digit = document.createElement('span'); digit.className = 'hp-digit'; digit.textContent = String(naturals.indexOf(midi % 12) + 1);
      const label = document.createElement('span'); label.className = 'hp-syllable'; label.textContent = syllables[naturals.indexOf(midi % 12)];
      if (midi < 60) key.classList.add('hp-low');
      face.append(octave, digit, label);
    }
    const glow = document.createElement('span'); glow.className = 'hp-key-glow';
    glow.setAttribute('aria-hidden','true'); face.append(glow); key.append(face);
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
    const firstX = rowIndex === 0 ? 8 : 14;
    const stepX = 11.8;
    naturals.forEach((semitone, index) => {
      const white = makeKey(row.base + semitone, syllables[index], row.white[index], row.wc[index]);
      white.style.left = (firstX + index * stepX) + '%'; section.append(white);
      if (row.bc[index]) {
        const black = makeKey(row.base + semitone + 1, syllables[index] + '♯', row.black[index], row.bc[index], true);
        black.style.left = (firstX + (index + .5) * stepX) + '%'; section.append(black);
      }
    });
    if (rowIndex === 0) {
      const top = makeKey(84+shift, '高いド', 'I', 'KeyI'); top.style.left = '90.6%'; section.append(top);
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
      if (octave===0) x = midi===21 ? 44.1 : midi===22 ? 50 : 55.9;
      else {
        const index = midi===108 ? 7 : sharp ? naturals.indexOf(midi%12-1)+.5 : naturals.indexOf(midi%12);
        x = (octave===7 ? 8 : 14) + index * 11.8;
      }
      key.style.left = x+'%';
      if (!sharp) key.querySelector('.hp-octave').textContent = '';
      row.append(key);
    }
    block.append(heading,row); octaveStack.append(block); octaveGroups.push({lo,hi,block});
  }
  const defaultTopRow=id=>octaveGroups.findIndex(group=>group.lo<=60+instruments[id].shift37&&group.hi>=60+instruments[id].shift37);
  let activeTopRow = defaultTopRow(currentInstrument);
  const rowHeight = () => parseFloat(pianoScroll.style.getPropertyValue('--hp-row-height')) || 70;
  function showRegister() {
    if (pianoView.hidden) return;
    const height = rowHeight();
    const first = Math.max(0,Math.min(octaveGroups.length-1,Math.floor(pianoScroll.scrollTop/height+.02)));
    const last = Math.min(octaveGroups.length-1,Math.ceil((pianoScroll.scrollTop+pianoScroll.clientHeight)/height-.02)-1);
    activeTopRow = first;
    const label = pitchName(octaveGroups[last].lo)+'–'+pitchName(octaveGroups[first].hi);
    const display = root.querySelector('[data-output="register"]');
    if (display.textContent!==label) display.textContent=label;
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
        // Pack the visible group using its actual key width, including saved
        // size preferences. Black keys stay centred on the adjoining whites.
        const whites=[...section.querySelectorAll('.hp-key:not(.hp-sharp)')];
        const first=section.clientWidth/2-(whites.length-1)*sizes.whiteStep/2;
        const centres=new Map();
        whites.forEach((key,index)=>{
          const centre=first+index*sizes.whiteStep;
          key.style.left=centre+'px';centres.set(Number(key.dataset.midi),centre);
        });
        section.querySelectorAll('.hp-key.hp-sharp').forEach(key=>{
          const midi=Number(key.dataset.midi);
          key.style.left=(centres.get(midi-1)+centres.get(midi+1))/2+'px';
        });
      });
    }
    if(!root.querySelector('.hp-stage').hidden)fitKeys(keyboard,true);
    if (pianoView.hidden) return;
    if (pianoScroll.clientHeight > 0) {
      // Use the same rack geometry as 37 keys. The 88-key window scrolls through
      // full-size rows instead of vertically squeezing four octaves to fit.
      const stage=root.querySelector('.hp-stage'),style=getComputedStyle(stage);
      const frameHeight=Math.min(root.querySelector('.hp-surface').clientHeight-root.querySelector('.hp-header').offsetHeight-root.querySelector('.hp-footer').offsetHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom),root.clientWidth*.42);
      const gap=parseFloat(getComputedStyle(keyboard).rowGap)||0;
      const rackHeight=Math.max(28,(frameHeight-2*gap)/3);
      pianoScroll.style.setProperty('--hp-register-gap',gap+'px');
      pianoScroll.style.setProperty('--hp-row-height',rackHeight+gap+'px');
    }
    fitKeys(octaveStack,false);
    pianoScroll.scrollTop = activeTopRow*rowHeight(); showRegister();
  }
  pianoScroll.addEventListener('scroll',showRegister,{passive:true});
  new ResizeObserver(sizeRegister).observe(pianoScroll);
  new ResizeObserver(sizeRegister).observe(keyboard);
  requestAnimationFrame(sizeRegister);
  // HOME prepares the revealed layout under its cover before the first paint.
  window.addEventListener('hp-piano-prepare', sizeRegister);
  window.addEventListener('hp-viewport-resize', () => {
    releaseHeld(); pointerStarts.clear(); requestAnimationFrame(sizeRegister);
  });
  layoutControl.addEventListener('change',() => {
    releaseHeld(); const enabled = layoutControl.value==='88';
    pianoView.hidden = !enabled; root.querySelector('.hp-stage').hidden = enabled;
    root.querySelector('.hp-register-info').hidden = !enabled;
    requestAnimationFrame(sizeRegister);
  });

  function ensureAudio() {
    try {
      configureAudioSession();
      if (!ctx) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('unsupported');
        ctx = new Audio({latencyHint:'interactive'});
        audioNeedsGestureUnlock = true;
        ctx.onstatechange = () => {
          if (ctx.state !== 'running') audioNeedsGestureUnlock = true;
        };
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
        violinSpace=window.HP_VIOLIN.createSpace(ctx,effects.input);
        ambienceSend.gain.value=!supportsAmbience(currentInstrument)?0:1;
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
    if (ctx.state === 'running') {
      audioNeedsGestureUnlock = false;
      return Promise.resolve(true);
    }
    if (!resumePromise) {
      resumePromise = ctx.resume()
        .then(() => {
          const running = ctx.state === 'running';
          if (running) audioNeedsGestureUnlock = false;
          return running;
        })
        .catch(() => false)
        .finally(() => { resumePromise = null; });
    }
    return resumePromise;
  }

  function unlockAudioFromGesture() {
    configureAudioSession();
    if (!ensureAudio() || !ctx) return false;
    try {
      // iOS standalone/PWA can require both resume() and an actual source.start()
      // to happen directly inside the user's tap gesture.
      if (ctx.state !== 'running') {
        const attempt = ctx.resume();
        if (attempt?.then) {
          void attempt.then(() => {
            if (ctx.state === 'running') audioNeedsGestureUnlock = false;
          }).catch(() => {});
        }
      }
      const buffer = ctx.createBuffer(1,1,22050);
      const source = ctx.createBufferSource();
      const silent = ctx.createGain();
      silent.gain.value = 0;
      source.buffer = buffer;
      source.connect(silent);
      silent.connect(ctx.destination);
      source.onended = () => {
        try { source.disconnect(); silent.disconnect(); } catch (_) {}
      };
      source.start(0);
      if (ctx.state === 'running') audioNeedsGestureUnlock = false;
      return true;
    } catch (_) {
      audioNeedsGestureUnlock = true;
      return false;
    }
  }

  root.addEventListener('pointerdown', () => {
    if (isStandalone || audioNeedsGestureUnlock || (ctx && ctx.state !== 'running')) {
      unlockAudioFromGesture();
    }
  }, {capture:true,passive:true});

  window.HP_AUDIO_BRIDGE = {
    configureSession: configureAudioSession,
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
    if (wet) wet.gain.setTargetAtTime(!supportsAmbience(currentInstrument)?0:Number(reverbControl.value)/100*1.25,ctx.currentTime,.045);
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
    root.dataset.instrument=currentInstrument;
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
    void effectUI.setInstrument(effectsInstrumentId(currentInstrument));
    root.querySelectorAll('[data-common-ambience]').forEach(label=>label.hidden=!supportsAmbience(currentInstrument));
    if(ambienceSend)ambienceSend.gain.setTargetAtTime(!supportsAmbience(currentInstrument)?0:1,ctx.currentTime,.03);
    if(wet)wet.gain.setTargetAtTime(!supportsAmbience(currentInstrument)?0:Number(reverbControl.value)/100*1.25,ctx.currentTime,.03);
    if(ambienceInstrument!==currentInstrument) {
      ambienceInstrument=currentInstrument;
      if(ambience[currentInstrument]) {
        reverbControl.value=ambience[currentInstrument].amount;
        decayControl.value=ambience[currentInstrument].decay;
        reverbControl.dispatchEvent(new Event('input')); decayControl.dispatchEvent(new Event('input'));
        updateReverb();
      }
    }
    updatePlayableKeys();
  }
  // The VCSL organ/vibraphone recordings can have long silent lead-ins and
  // widely varying source levels. Inspect each buffer once, never on keydown.
  function analyseSampleStartAndLevel(buffer,id) {
    const left=buffer.getChannelData(0);
    const right=buffer.getChannelData(Math.min(1,buffer.numberOfChannels-1));
    const rate=buffer.sampleRate;
    if(id!=='finalPipeOrgan' && id!=='finalVibraphone') {
      let first=0,end=Math.min(left.length,Math.floor(rate*.12));
      while(first<end&&Math.max(Math.abs(left[first]),Math.abs(right[first]))<.0005)first++;
      return {offset:first<end?Math.max(0,(first-32)/rate):0,levelAdjustment:1};
    }
    const vibraphone=id==='finalVibraphone';
    const step=Math.max(1,Math.floor(rate/2400));
    let peak=0;
    for(let i=0;i<left.length;i+=step) {
      peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
    }
    // Relative threshold finds an audible attack in a softly recorded file.
    // The pre-roll preserves the natural strike or pipe breath.
    const threshold=Math.max(.00008,peak*(vibraphone?.05:.025));
    const searchEnd=Math.min(left.length,Math.floor(rate*10));
    let first=searchEnd;
    for(let i=0;i<searchEnd;i+=step) {
      if(Math.max(Math.abs(left[i]),Math.abs(right[i]))>=threshold) {
        first=i;
        break;
      }
    }
    const preroll=vibraphone?.012:.02;
    const offset=first<searchEnd?Math.max(0,first/rate-preroll):0;
    // Loudness leveling with a strict cap protects unusually quiet/noisy files.
    const targetPeak=vibraphone?.46:.44;
    const levelAdjustment=peak>.00001?Math.max(.4,Math.min(24,targetPeak/peak)):1;
    return {offset,levelAdjustment};
  }
  async function loadBank(id, generation) {
    const preset=instruments[id];
    if(preset.engine && !preset.samples?.length)return new Map();
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
            const {offset,levelAdjustment}=analyseSampleStartAndLevel(buffer,id);
            decoded.set(descriptor.url,{...descriptor,buffer,offset,levelAdjustment});
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
    say(instruments[id].name+'を準備中');
    try {
      await ctx.resume();
      const bank=await loadBank(id,generation);
      if(generation!==loadGeneration)return;
      await effectUI.setInstrument(effectsInstrumentId(id));
      currentInstrument=id; sampleBuffers=bank; sampleCounters.clear(); samplesReady=true;
      build37(instruments[id].shift37); updateInstrumentUI();
      if(id!==previous)activeTopRow=defaultTopRow(id);
      requestAnimationFrame(sizeRegister);
      say(instruments[id].name+'で演奏できます');
    } catch(_) {
      if(generation!==loadGeneration)return;
      currentInstrument=previous; sampleBuffers=previousBank; samplesReady=wasReady;
      updateInstrumentUI();
      say(wasReady?'音源を読み込めなかったため、前の音源に戻しました。':'音源を読み込めませんでした。通信を確認して、もう一度お試しください',true);
    } finally {
      if(generation===loadGeneration) {
        instrumentControl.disabled=false;
        updatePlayableKeys();
        action('record').disabled=!samplesReady; action('play').disabled=!samplesReady||events.length===0;
      }
    }
  }
  instrumentControl.addEventListener('change',()=>{
    const id=instrumentControl.value;
    if(!instruments[id])return;
    if(!ctx) {
      currentInstrument=id; build37(instruments[id].shift37); updateInstrumentUI();
      activeTopRow=defaultTopRow(id); requestAnimationFrame(sizeRegister);
      say('幕をタップすると'+instruments[id].name+'を準備');
    } else {void prepareSamples(id);}
  });

  const chipWaveCache = new Map();
  const kotoBufferCache = new Map();
  const organWaveCache = new Map();
  const trumpetWaveCache = new Map();
  let breathNoiseBuffer = null;

  function midiHz(midi) {
    return 440*Math.pow(2,(midi-69)/12);
  }

  function pulseWave(duty) {
    const key=String(duty);
    if(chipWaveCache.has(key))return chipWaveCache.get(key);
    const harmonics=56,real=new Float32Array(harmonics+1),imag=new Float32Array(harmonics+1);
    for(let n=1;n<=harmonics;n++){
      real[n]=2*Math.sin(2*Math.PI*n*duty)/(Math.PI*n);
      imag[n]=2*(1-Math.cos(2*Math.PI*n*duty))/(Math.PI*n);
    }
    const wave=ctx.createPeriodicWave(real,imag,{disableNormalization:false});
    chipWaveCache.set(key,wave);
    return wave;
  }

  function getBreathNoiseBuffer() {
    if(breathNoiseBuffer)return breathNoiseBuffer;
    const length=Math.max(1,Math.floor(ctx.sampleRate*.8));
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    let seed=0x51f15e;
    for(let i=0;i<length;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      data[i]=(seed/2147483648)-1;
    }
    breathNoiseBuffer=buffer;
    return buffer;
  }

  function createChip8Voice(midi,when,onEnded) {
    const preset=instruments.finalChip8,level=preset.gain;
    const bus=ctx.createGain(),tone=ctx.createBiquadFilter(),pan=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain();
    tone.type='lowpass';tone.frequency.setValueAtTime(midi>84?8200:midi<48?6900:10400,when);tone.Q.value=.18;
    if('pan' in pan)pan.pan.value=Math.max(-.08,Math.min(.08,(midi-64)/300));
    bus.gain.setValueAtTime(.00001,when);bus.gain.linearRampToValueAtTime(level,when+.0035);
    tone.connect(pan);pan.connect(bus);bus.connect(effects.input);

    const duty=midi>=84?.125:midi>=60?.25:.5;
    const main=ctx.createOscillator(),color=ctx.createOscillator(),tri=ctx.createOscillator();
    const mainGain=ctx.createGain(),colorGain=ctx.createGain(),triGain=ctx.createGain();
    const f=midiHz(midi);
    main.setPeriodicWave(pulseWave(duty));
    color.setPeriodicWave(pulseWave(duty===.125?.25:.125));
    tri.type='triangle';
    main.frequency.setValueAtTime(f,when);color.frequency.setValueAtTime(f*2,when);tri.frequency.setValueAtTime(f/2,when);
    mainGain.gain.value=.76;colorGain.gain.value=midi>80?.08:.14;triGain.gain.value=midi<60?.14:.045;
    main.connect(mainGain);color.connect(colorGain);tri.connect(triGain);
    mainGain.connect(tone);colorGain.connect(tone);triGain.connect(tone);

    const lfo=ctx.createOscillator(),lfoGain=ctx.createGain();
    lfo.type='sine';lfo.frequency.value=5.35;
    lfoGain.gain.setValueAtTime(0,when);lfoGain.gain.linearRampToValueAtTime(1.8,when+.22);
    lfo.connect(lfoGain);lfoGain.connect(main.detune);lfoGain.connect(color.detune);
    main.detune.setValueAtTime(-4.5,when);main.detune.linearRampToValueAtTime(0,when+.028);
    color.detune.value=2;

    let cleaned=false;
    const cleanup=()=>{
      if(cleaned)return;cleaned=true;
      try{main.disconnect();color.disconnect();tri.disconnect();lfo.disconnect();mainGain.disconnect();colorGain.disconnect();triGain.disconnect();lfoGain.disconnect();tone.disconnect();pan.disconnect();bus.disconnect();}catch(_){}
      onEnded?.();
    };
    main.onended=cleanup;
    main.start(when);color.start(when);tri.start(when);lfo.start(when);
    return {release(at=ctx.currentTime,seconds=sustain?Infinity:articulation.finalChip8.release){
      if(cleaned||!Number.isFinite(seconds))return;
      const start=Math.max(when+.006,at),end=start+Math.max(.025,seconds);
      bus.gain.cancelScheduledValues(start);bus.gain.setTargetAtTime(.00001,start,Math.max(.006,seconds/4));
      try{main.stop(end+.04);color.stop(end+.04);tri.stop(end+.04);lfo.stop(end+.04);}catch(_){}
    }};
  }

  function createKotoBuffer(midi,variant=0) {
    const key=ctx.sampleRate+':'+midi+':'+variant;
    if(kotoBufferCache.has(key))return kotoBufferCache.get(key);
    const sr=ctx.sampleRate,f=midiHz(midi);
    const duration=Math.max(2.45,4.65-(midi-48)*.045);
    const length=Math.ceil(duration*sr);
    const period=Math.max(3,Math.round(sr/f));
    const ringA=new Float32Array(period);
    const ringB=new Float32Array(Math.max(3,Math.round(period*(1+(variant?0.0021:-0.0017)))));
    const out=new Float32Array(length);
    let seed=(0x9e3779b9^(midi*2654435761)^(variant*0x85ebca6b))>>>0;
    const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
    const pick=.16+variant*.055+(midi%3)*.012;
    const excite=(ring,amount)=>{
      const pickOffset=Math.max(1,Math.floor(ring.length*pick));
      for(let i=0;i<ring.length;i++)ring[i]=rnd();
      for(let i=0;i<ring.length;i++)ring[i]=(ring[i]-ring[(i+pickOffset)%ring.length]*.62)*amount;
    };
    excite(ringA,.82);excite(ringB,.31);
    const dampA=Math.max(.9967,.99912-(midi-48)*.000034);
    const dampB=Math.max(.9964,.99894-(midi-48)*.000037);
    let ia=0,ib=0,prevA=0,prevB=0;
    let body1=0,body2=0,body3=0;
    const c1=Math.exp(-2*Math.PI*360/sr),c2=Math.exp(-2*Math.PI*760/sr),c3=Math.exp(-2*Math.PI*1320/sr);
    for(let i=0;i<length;i++){
      const na=(ia+1)%ringA.length,nb=(ib+1)%ringB.length;
      const a=ringA[ia],b=ringB[ib];
      const da=((a+ringA[na])*.5*.982+prevA*.018)*dampA;
      const db=((b+ringB[nb])*.5*.974+prevB*.026)*dampB;
      ringA[ia]=da;ringB[ib]=db;prevA=da;prevB=db;
      const t=i/sr;
      let raw=a+b*.52;
      if(i<sr*.018)raw+=rnd()*.20*(1-i/(sr*.018));
      body1=(1-c1)*raw+c1*body1;
      body2=(1-c2)*raw+c2*body2;
      body3=(1-c3)*raw+c3*body3;
      const resonant=(raw-body1)*.48+(raw-body2)*.22+(raw-body3)*.11;
      const tail=Math.exp(-t*(midi>72?.20:.115));
      out[i]=(raw*.72+resonant*.36)*tail;
      ia=na;ib=nb;
    }
    let peak=.0001;
    for(let i=0;i<out.length;i++)peak=Math.max(peak,Math.abs(out[i]));
    const scale=.86/peak;
    const buffer=ctx.createBuffer(1,length,sr),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=out[i]*scale;
    kotoBufferCache.set(key,buffer);
    return buffer;
  }

  function createKotoVoice(midi,when,onEnded) {
    const preset=instruments.finalKoto;
    const count=sampleCounters.get('koto:'+midi)||0;sampleCounters.set('koto:'+midi,count+1);
    const source=ctx.createBufferSource(),body=ctx.createBiquadFilter(),air=ctx.createBiquadFilter();
    const pan=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain();
    const bus=ctx.createGain(),reflection=ctx.createDelay(.09),reflectionGain=ctx.createGain();
    source.buffer=createKotoBuffer(midi,count%2);
    source.playbackRate.setValueAtTime(1.007,when);source.playbackRate.exponentialRampToValueAtTime(1,when+.032);
    body.type='peaking';body.frequency.value=510;body.Q.value=.7;body.gain.value=2.8;
    air.type='peaking';air.frequency.value=2400;air.Q.value=.9;air.gain.value=1.6;
    if('pan' in pan)pan.pan.value=Math.max(-.14,Math.min(.14,(midi-66)/120));
    bus.gain.setValueAtTime(.00001,when);bus.gain.linearRampToValueAtTime(preset.gain,when+.0025);
    source.connect(body);body.connect(air);air.connect(pan);pan.connect(bus);
    air.connect(reflection);reflection.delayTime.value=.026;reflection.connect(reflectionGain);reflectionGain.gain.value=.09;reflectionGain.connect(bus);
    bus.connect(effects.input);
    let cleaned=false;
    const cleanup=()=>{
      if(cleaned)return;cleaned=true;
      try{source.disconnect();body.disconnect();air.disconnect();pan.disconnect();reflection.disconnect();reflectionGain.disconnect();bus.disconnect();}catch(_){}
      onEnded?.();
    };
    source.onended=cleanup;source.start(when);
    return {release(at=ctx.currentTime,seconds=sustain?Infinity:articulation.finalKoto.release){
      if(cleaned||!Number.isFinite(seconds))return;
      const start=Math.max(when+.004,at),end=start+Math.max(.05,seconds);
      bus.gain.cancelScheduledValues(start);bus.gain.setTargetAtTime(.00001,start,Math.max(.01,seconds/4));
      try{source.stop(end+.06);}catch(_){}
    }};
  }

  function trumpetPeriodicWave(register) {
    if(trumpetWaveCache.has(register))return trumpetWaveCache.get(register);
    const real=new Float32Array(19),imag=new Float32Array(19);
    const base=register==='high'
      ? [0,1,.88,.71,.58,.48,.39,.31,.25,.20,.16,.13,.105,.082,.064,.05,.039,.03,.023]
      : register==='low'
      ? [0,1,.67,.50,.37,.28,.21,.16,.12,.09,.07,.052,.039,.03,.022,.017,.013,.010,.008]
      : [0,1,.78,.60,.46,.35,.27,.21,.16,.125,.098,.076,.059,.046,.035,.027,.021,.016,.012];
    for(let i=1;i<base.length;i++)imag[i]=base[i];
    const wave=ctx.createPeriodicWave(real,imag,{disableNormalization:false});
    trumpetWaveCache.set(register,wave);
    return wave;
  }

  function createTrumpetVoice(midi,when,onEnded) {
    const preset=instruments.finalTrumpet,f=midiHz(midi);
    const register=midi>=74?'high':midi<=61?'low':'mid',wave=trumpetPeriodicWave(register);
    const osc1=ctx.createOscillator(),osc2=ctx.createOscillator();
    osc1.setPeriodicWave(wave);osc2.setPeriodicWave(wave);
    osc1.frequency.value=f;osc2.frequency.value=f;
    const attackBend=midi>=76?-16:-11;
    osc1.detune.setValueAtTime(attackBend,when);osc1.detune.linearRampToValueAtTime(0,when+.085);
    osc2.detune.setValueAtTime(attackBend+3,when);osc2.detune.linearRampToValueAtTime(2.6,when+.092);
    const g1=ctx.createGain(),g2=ctx.createGain();g1.gain.value=.75;g2.gain.value=.19;

    const mix=ctx.createGain(),drive=ctx.createWaveShaper(),filter=ctx.createBiquadFilter(),presence=ctx.createBiquadFilter(),warmth=ctx.createBiquadFilter();
    const pan=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain(),bus=ctx.createGain();
    const curve=new Float32Array(257);
    for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=Math.tanh(x*1.45)/Math.tanh(1.45);}
    drive.curve=curve;drive.oversample='2x';
    filter.type='lowpass';filter.Q.value=.62;
    const open=Math.min(8200,2850+f*5.0);
    filter.frequency.setValueAtTime(Math.max(1050,open*.32),when);
    filter.frequency.exponentialRampToValueAtTime(open,when+.11);
    filter.frequency.setTargetAtTime(open*.86,when+.18,.13);
    presence.type='peaking';presence.frequency.value=1850;presence.Q.value=.82;presence.gain.value=3.1;
    warmth.type='peaking';warmth.frequency.value=720;warmth.Q.value=.72;warmth.gain.value=register==='low'?2.1:1.2;
    if('pan' in pan)pan.pan.value=(midi%2?-.035:.035);
    bus.gain.setValueAtTime(.00001,when);bus.gain.exponentialRampToValueAtTime(Math.max(.0001,preset.gain),when+.04);bus.gain.setTargetAtTime(preset.gain*.9,when+.13,.08);

    osc1.connect(g1);osc2.connect(g2);g1.connect(mix);g2.connect(mix);mix.connect(drive);drive.connect(filter);filter.connect(presence);presence.connect(warmth);warmth.connect(pan);pan.connect(bus);

    const breath=ctx.createBufferSource(),breathFilter=ctx.createBiquadFilter(),breathGain=ctx.createGain();
    breath.buffer=getBreathNoiseBuffer();breath.loop=true;
    breathFilter.type='bandpass';breathFilter.frequency.value=register==='high'?4200:3300;breathFilter.Q.value=.7;
    breathGain.gain.setValueAtTime(.0001,when);breathGain.gain.linearRampToValueAtTime(.026,when+.05);breathGain.gain.setTargetAtTime(.011,when+.18,.09);
    breath.connect(breathFilter);breathFilter.connect(breathGain);breathGain.connect(bus);

    const lfo=ctx.createOscillator(),lfoGain=ctx.createGain();
    lfo.type='sine';lfo.frequency.value=5.2;
    lfoGain.gain.setValueAtTime(0,when);lfoGain.gain.setValueAtTime(0,when+.22);lfoGain.gain.linearRampToValueAtTime(register==='high'?5.0:4.1,when+.52);
    lfo.connect(lfoGain);lfoGain.connect(osc1.detune);lfoGain.connect(osc2.detune);

    const reflection=ctx.createDelay(.09),reflectionGain=ctx.createGain();
    reflection.delayTime.value=.031;reflectionGain.gain.value=.055;warmth.connect(reflection);reflection.connect(reflectionGain);reflectionGain.connect(bus);
    bus.connect(effects.input);

    let cleaned=false;
    const cleanup=()=>{
      if(cleaned)return;cleaned=true;
      try{osc1.disconnect();osc2.disconnect();g1.disconnect();g2.disconnect();mix.disconnect();drive.disconnect();filter.disconnect();presence.disconnect();warmth.disconnect();pan.disconnect();breath.disconnect();breathFilter.disconnect();breathGain.disconnect();lfo.disconnect();lfoGain.disconnect();reflection.disconnect();reflectionGain.disconnect();bus.disconnect();}catch(_){}
      onEnded?.();
    };
    osc1.onended=cleanup;osc1.start(when);osc2.start(when);breath.start(when);lfo.start(when);
    return {release(at=ctx.currentTime,seconds=sustain?Infinity:articulation.finalTrumpet.release){
      if(cleaned||!Number.isFinite(seconds))return;
      const start=Math.max(when+.045,at),end=start+Math.max(.07,seconds);
      bus.gain.cancelScheduledValues(start);bus.gain.setTargetAtTime(.00001,start,Math.max(.014,seconds/4));
      breathGain.gain.cancelScheduledValues(start);breathGain.gain.setTargetAtTime(.00001,start,.03);
      try{osc1.stop(end+.07);osc2.stop(end+.07);breath.stop(end+.07);lfo.stop(end+.07);}catch(_){}
    }};
  }

  function organPeriodicWave(kind) {
    if(organWaveCache.has(kind))return organWaveCache.get(kind);
    const weights=kind==='principal'
      ? [0,1,.48,.31,.20,.15,.105,.075,.052,.038,.028,.020,.015,.011,.008]
      : [0,1,.18,.055,.025,.014,.008,.005,.003];
    const real=new Float32Array(weights.length),imag=new Float32Array(weights.length);
    for(let i=1;i<weights.length;i++)imag[i]=weights[i];
    const wave=ctx.createPeriodicWave(real,imag,{disableNormalization:false});
    organWaveCache.set(kind,wave);return wave;
  }

  function createPipeOrganVoice(midi,when,onEnded) {
    const preset=instruments.finalPipeOrgan,f=midiHz(midi);
    const bus=ctx.createGain(),low=ctx.createBiquadFilter(),panA=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain(),panB=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain();
    low.type='lowpass';low.frequency.value=Math.min(12500,4200+f*8);low.Q.value=.12;
    if('pan' in panA){panA.pan.value=-.10;panB.pan.value=.10;}
    bus.gain.setValueAtTime(.00001,when);bus.gain.linearRampToValueAtTime(preset.gain,when+.026);
    low.connect(bus);bus.connect(effects.input);

    const principal=ctx.createOscillator(),flute=ctx.createOscillator(),oct=ctx.createOscillator();
    const gp=ctx.createGain(),gf=ctx.createGain(),go=ctx.createGain();
    principal.setPeriodicWave(organPeriodicWave('principal'));flute.setPeriodicWave(organPeriodicWave('flute'));oct.setPeriodicWave(organPeriodicWave('flute'));
    principal.frequency.value=f;flute.frequency.value=f*.5;oct.frequency.value=f*2;
    principal.detune.value=-1.2;flute.detune.value=1.1;oct.detune.value=.5;
    gp.gain.value=.68;gf.gain.value=midi<60?.32:.18;go.gain.value=midi>76?.08:.17;
    principal.connect(gp);flute.connect(gf);oct.connect(go);gp.connect(panA);gf.connect(panB);go.connect(panB);panA.connect(low);panB.connect(low);

    const chiff=ctx.createBufferSource(),chiffFilter=ctx.createBiquadFilter(),chiffGain=ctx.createGain();
    chiff.buffer=getBreathNoiseBuffer();chiff.loop=true;chiffFilter.type='bandpass';chiffFilter.frequency.value=Math.min(5400,1500+f*3);chiffFilter.Q.value=.8;
    chiffGain.gain.setValueAtTime(.035,when);chiffGain.gain.exponentialRampToValueAtTime(.0001,when+.075);
    chiff.connect(chiffFilter);chiffFilter.connect(chiffGain);chiffGain.connect(low);

    const drift=ctx.createOscillator(),driftGain=ctx.createGain();
    drift.type='sine';drift.frequency.value=.22;driftGain.gain.value=1.0;drift.connect(driftGain);driftGain.connect(principal.detune);driftGain.connect(flute.detune);

    let cleaned=false;
    const cleanup=()=>{
      if(cleaned)return;cleaned=true;
      try{principal.disconnect();flute.disconnect();oct.disconnect();gp.disconnect();gf.disconnect();go.disconnect();panA.disconnect();panB.disconnect();low.disconnect();chiff.disconnect();chiffFilter.disconnect();chiffGain.disconnect();drift.disconnect();driftGain.disconnect();bus.disconnect();}catch(_){}
      onEnded?.();
    };
    principal.onended=cleanup;principal.start(when);flute.start(when);oct.start(when);chiff.start(when);drift.start(when);
    return {release(at=ctx.currentTime,seconds=sustain?Infinity:articulation.finalPipeOrgan.release){
      if(cleaned||!Number.isFinite(seconds))return;
      const start=Math.max(when+.03,at),end=start+Math.max(.12,seconds);
      bus.gain.cancelScheduledValues(start);bus.gain.setTargetAtTime(.00001,start,Math.max(.03,seconds/4));
      try{principal.stop(end+.12);flute.stop(end+.12);oct.stop(end+.12);chiff.stop(end+.12);drift.stop(end+.12);}catch(_){}
    }};
  }

  function createSampleOrganVoice(midi,when,onEnded) {
    const preset=instruments.finalPipeOrgan;
    const anchor=Array.from(sampleBuffers.keys()).reduce((best,note)=>Math.abs(note-midi)<Math.abs(best-midi)?note:best);
    const variants=sampleBuffers.get(anchor),index=sampleCounters.get(anchor)||0;
    const sample=variants[index%variants.length];sampleCounters.set(anchor,index+1);
    const source=ctx.createBufferSource(),tone=ctx.createBiquadFilter(),bus=ctx.createGain();
    source.buffer=sample.buffer;source.playbackRate.value=Math.pow(2,(midi-anchor)/12);
    tone.type='lowpass';tone.frequency.value=Math.min(14500,6000+midiHz(midi)*6);tone.Q.value=.12;
    bus.gain.setValueAtTime(.00001,when);bus.gain.linearRampToValueAtTime(preset.gain*(sample.levelAdjustment||1),when+.012);
    source.connect(tone);tone.connect(bus);bus.connect(effects.input);
    let cleaned=false;
    const cleanup=()=>{
      if(cleaned)return;cleaned=true;
      try{source.disconnect();tone.disconnect();bus.disconnect();}catch(_){}
      onEnded?.();
    };
    source.onended=cleanup;source.start(when,sample.offset);
    return {release(at=ctx.currentTime,seconds=sustain?Infinity:articulation.finalPipeOrgan.release){
      if(cleaned||!Number.isFinite(seconds))return;
      const start=Math.max(when+.015,at),end=start+Math.max(.12,seconds);
      bus.gain.cancelScheduledValues(start);bus.gain.setTargetAtTime(.00001,start,Math.max(.03,seconds/4));
      try{source.stop(end+.12);}catch(_){}
    }};
  }

  function createVibraphoneVoice(midi,when,onEnded) {
    const preset=instruments.finalVibraphone;
    const anchor=Array.from(sampleBuffers.keys()).reduce((best,note)=>Math.abs(note-midi)<Math.abs(best-midi)?note:best);
    const variants=sampleBuffers.get(anchor),index=sampleCounters.get(anchor)||0;
    const sample=variants[index%variants.length];sampleCounters.set(anchor,index+1);
    const source=ctx.createBufferSource(),tone=ctx.createBiquadFilter(),motor=ctx.createGain(),pan=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain(),bus=ctx.createGain();
    source.buffer=sample.buffer;source.playbackRate.value=Math.pow(2,(midi-anchor)/12);
    tone.type='highpass';tone.frequency.value=70;tone.Q.value=.15;
    motor.gain.value=.87;if('pan' in pan)pan.pan.value=Math.max(-.16,Math.min(.16,(midi-71)/100));
    bus.gain.setValueAtTime(.00001,when);bus.gain.linearRampToValueAtTime(preset.gain*(sample.levelAdjustment||1),when+.004);
    source.connect(tone);tone.connect(motor);motor.connect(pan);pan.connect(bus);bus.connect(effects.input);

    const lfo=ctx.createOscillator(),lfoGain=ctx.createGain();
    lfo.type='sine';lfo.frequency.value=5.65;lfoGain.gain.value=.13;lfo.connect(lfoGain);lfoGain.connect(motor.gain);

    const naturalDuration=(sample.buffer.duration-sample.offset)/source.playbackRate.value;
    let cleaned=false;
    const cleanup=()=>{
      if(cleaned)return;cleaned=true;
      try{source.disconnect();tone.disconnect();motor.disconnect();pan.disconnect();bus.disconnect();lfo.disconnect();lfoGain.disconnect();}catch(_){}
      onEnded?.();
    };
    source.onended=cleanup;source.start(when,sample.offset);lfo.start(when);
    try{lfo.stop(when+naturalDuration+.1);}catch(_){}
    return {release(at=ctx.currentTime,seconds=sustain?Infinity:articulation.finalVibraphone.release){
      if(cleaned||!Number.isFinite(seconds))return;
      const start=Math.max(when+.005,at),end=start+Math.max(.08,seconds);
      bus.gain.cancelScheduledValues(start);bus.gain.setTargetAtTime(.00001,start,Math.max(.02,seconds/4));
      try{source.stop(end+.08);lfo.stop(end+.08);}catch(_){}
    }};
  }

  function synth(midi, when = ctx.currentTime, live = true) {
    while (allVoices.size >= 48) {
      const oldest = allVoices.values().next().value; oldest.release(ctx.currentTime,.04); allVoices.delete(oldest);
    }
    const engine=instruments[currentInstrument]?.engine;
    if(engine){
      let voice=null;
      const onEnded=()=>{ if(voice){allVoices.delete(voice);liveVoices.delete(voice);} };
      if(engine==='chip8Final')voice=createChip8Voice(midi,when,onEnded);
      else if(engine==='kotoFinal')voice=createKotoVoice(midi,when,onEnded);
      else if(engine==='trumpetFinal')voice=createTrumpetVoice(midi,when,onEnded);
      else if(engine==='pipeOrganFinal')voice=createPipeOrganVoice(midi,when,onEnded);
      else if(engine==='sampleOrganFinal')voice=createSampleOrganVoice(midi,when,onEnded);
      else if(engine==='vibraphoneFinal')voice=createVibraphoneVoice(midi,when,onEnded);
      if(voice){allVoices.add(voice);if(live)liveVoices.add(voice);return voice;}
    }
    if(currentInstrument==='violin'){
      const state=window.HP_VIOLIN.snapshot(),d=window.HP_VIOLIN.descriptor(instruments.violin.samples,midi,state);
      const sample=bankCache.get('violin').get(d.url);
      const voice=window.HP_VIOLIN.createVoice(ctx,violinSpace.input,d,sample.buffer,midi,when,state,instruments.violin.gain,voice=>{allVoices.delete(voice);liveVoices.delete(voice);});
      const release=voice.release;voice.release=(at=ctx.currentTime,seconds=sustain?1.2:articulation.violin.release)=>release(at,seconds);
      allVoices.add(voice);if(live)liveVoices.add(voice);return voice;
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
    source.onended = () => { ended = true; source.disconnect(); fade.disconnect(); bus.disconnect(); allVoices.delete(voice); liveVoices.delete(voice); };
    source.start(when,sample.offset); allVoices.add(voice); if(live)liveVoices.add(voice); return voice;
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
      entry.event = {midi, start: Math.max(0, ctx.currentTime - recordStart), duration: .12, sustain, cut:false};
      events.push(entry.event); eventCount++;
    }
    held.set(token, entry); root.dispatchEvent(new CustomEvent('hp-note-on',{detail:{token,midi}})); pendingSparkles.add(midi); redraw();
    if (!recording && !playing && status.textContent!=='演奏中') say('演奏中');
  }
  function paintPress(midi, pressed) {
    (buttons.get(midi)||[]).forEach(key => key.dataset.pressed = String(pressed));
  }
  function pressKey(token, midi) {
    if (pressedTokens.has(token)) return;
    const alreadyPressed = Array.from(pressedTokens.values()).includes(midi);
    pressedTokens.set(token,midi);
    clearTimeout(pressReleaseTimers.get(midi)); pressReleaseTimers.delete(midi);
    if (!alreadyPressed) pressedSince.set(midi,performance.now());
    paintPress(midi,true);
  }
  function releaseKey(token) {
    const midi = pressedTokens.get(token);
    if (midi === undefined) return;
    pressedTokens.delete(token);
    if (Array.from(pressedTokens.values()).includes(midi)) return;
    // Even a tap released within one animation frame gets a visible depression.
    const remaining = Math.max(0,60-(performance.now()-pressedSince.get(midi)));
    const finish = () => {
      pressReleaseTimers.delete(midi); pressedSince.delete(midi); paintPress(midi,false);
    };
    if (remaining) pressReleaseTimers.set(midi,setTimeout(finish,remaining)); else finish();
  }
  function noteOn(token, midi) {
    if (!samplesReady || !isPlayableMidi(midi,currentInstrument) || held.has(token) || pendingNoteOns.has(token)) return;
    pressKey(token,midi);
    if (!ensureAudio()) return;
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
    releaseKey(token);
    pendingNoteOns.delete(token);
    const entry = held.get(token); if (!entry) return;
    entry.voice.release();
    if (entry.event && recording) entry.event.duration = Math.max(.06, ctx.currentTime - recordStart - entry.event.start);
    root.dispatchEvent(new CustomEvent('hp-note-off',{detail:{token,midi:entry.midi}})); held.delete(token); redraw();
  }
  function markHeldCutForRecording() {
    if(!recording||!ctx)return;
    const stoppedAt=ctx.currentTime;
    held.forEach(entry=>{
      if(!entry.event)return;
      entry.event.cut=true;
      entry.event.duration=Math.max(.015,stoppedAt-recordStart-entry.event.start);
    });
  }
  function releaseHeld() {
    pendingNoteOns.clear();
    Array.from(held.keys()).forEach(noteOff);
    pressedTokens.clear(); pressReleaseTimers.forEach(clearTimeout); pressReleaseTimers.clear();
    pressedSince.clear(); buttons.forEach(list=>list.forEach(key=>key.dataset.pressed="false"));
  }
  function stopPlayback() {
    playGeneration++; playbackTimers.forEach(clearTimeout); playbackTimers = [];
    clearInterval(scheduler); scheduler = null;
    if (ctx) playbackVoices.forEach(voice => voice.release(ctx.currentTime, .08));
    playbackVoices = []; playingCounts.clear(); playing = false;
    action('play').setAttribute('aria-pressed','false');
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

  function keyAtPoint(clientX,clientY,fallbackTarget=null){
    // Black keys always win when their visible rectangle overlaps the touch point,
    // even if a lit/pressed white key has its own stacking context.
    const sharps=root.querySelectorAll('.hp-key.hp-sharp[data-midi]');
    for(const sharp of sharps){
      if(sharp.disabled||sharp.hidden||sharp.offsetParent===null)continue;
      const rect=sharp.getBoundingClientRect();
      if(clientX>=rect.left&&clientX<=rect.right&&clientY>=rect.top&&clientY<=rect.bottom){
        return sharp;
      }
    }
    return fallbackTarget?.closest?.('[data-midi]')||null;
  }
  root.addEventListener('pointerdown', event => {
    if (!settingsOverlay.hidden || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const key = keyAtPoint(event.clientX,event.clientY,event.target);
    const scrollable = !!event.target.closest('.hp-scroll-window');
    if (!key && !scrollable) return;
    event.preventDefault();
    const point = localPointer(event);
    pointerStarts.set(event.pointerId,{...point,scrollable:scrollable&&!key,scrollTop:pianoScroll.scrollTop,scrolling:false,lastClientX:event.clientX,lastClientY:event.clientY});
    if (key) { const token='pointer:' + event.pointerId; noteOff(token); noteOn(token, Number(key.dataset.midi)); }
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
    if (!pressedTokens.has(token) || origin.scrolling) return;
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
        const key = keyAtPoint(x,y,hit);
        const currentMidi = pressedTokens.get(token);
        if (key && root.contains(key) && Number(key.dataset.midi) !== currentMidi) {
          noteOff(token); noteOn(token, Number(key.dataset.midi));
        }
      }
      origin.lastClientX=sample.clientX; origin.lastClientY=sample.clientY;
    }
  });
  const releasePointer = event => { noteOff('pointer:' + event.pointerId); pointerStarts.delete(event.pointerId); };
  ['pointerup','pointercancel'].forEach(name => window.addEventListener(name, releasePointer, true));
  root.addEventListener('lostpointercapture', releasePointer);
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
  window.addEventListener('hp-curtain-start',()=>{ unlockAudioFromGesture(); void prepareSamples(); });
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
    if(recording&&ctx){
      const stopAt=Math.max(0,ctx.currentTime-recordStart);
      const last=soundStopEvents[soundStopEvents.length-1];
      if(!Number.isFinite(last)||Math.abs(last-stopAt)>.02)soundStopEvents.push(stopAt);
    }
    markHeldCutForRecording();
    root.dispatchEvent(new Event('hp-stop-sound'));
    releaseHeld(); pointerStarts.clear();
    if (ctx) {
      liveVoices.forEach(voice=>voice.release(ctx.currentTime,.02));
      violinSpace?.clear();
      if (reverb) { reverb.buffer=null; updateReverb(); }
    }
    redraw(); say('手弾きの音と余韻を止めました');
  });
  action('record').addEventListener('click', () => {
    if (recording) { finishRecording(); return; }
    if (!ensureAudio()) return;
    stopPlayback(); releaseHeld(); events = []; soundStopEvents = []; eventCount = 0; recordStart = ctx.currentTime; recording = true;
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
    releaseHeld(); playing = true; action('play').setAttribute('aria-pressed','true'); action('play').textContent = '■ 停止'; say('再生中');
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
        const voice = synth(event.midi, when, false); playbackVoices.push(voice);
        voice.release(when + event.duration, event.cut ? .02 : (event.sustain ? Infinity : articulation[currentInstrument].release));
        const globalStop=soundStopEvents.find(value=>Number.isFinite(value)&&value>event.start+.001);
        if(Number.isFinite(globalStop))voice.release(start+globalStop,.02);
        later(() => { playingCounts.set(event.midi, (playingCounts.get(event.midi) || 0) + 1); redraw(); sparkle(event.midi); }, when - ctx.currentTime);
        later(() => { const remaining = (playingCounts.get(event.midi) || 1) - 1; if (remaining) playingCounts.set(event.midi, remaining); else playingCounts.delete(event.midi); redraw(); }, when + event.duration - ctx.currentTime);
      }
      if (ctx.currentTime >= start + recordDuration) { stopPlayback(); say('再生が終わりました'); }
    }
    schedule(); scheduler = setInterval(schedule, 25);
  });
  releaseControl.addEventListener('input',()=>{articulation[currentInstrument].release=Number(releaseControl.value);root.querySelector('[data-output="release"]').textContent=Number(releaseControl.value).toFixed(2)+'秒';});
  root.addEventListener('hp-violin-change',event=>violinSpace?.update(event.detail));
  volume.addEventListener('input', () => { try { localStorage.setItem('hp-master-volume',volume.value); } catch (_) {} root.querySelector('[data-output="volume"]').textContent = volume.value + '%'; if (master) master.gain.setTargetAtTime(Number(volume.value) / 100 * .9, ctx.currentTime, .03); });
  let auditionTimer, auditionVoice;
  root.addEventListener('hp-audition',()=>{
    if(!samplesReady||!ensureAudio())return;
    clearTimeout(auditionTimer);
    auditionVoice?.release(ctx.currentTime,.06);
    noteOff('audition');
    const midi=currentInstrument==='bass'?40:currentInstrument==='guitar'?64:currentInstrument==='violin'?72:60;
    noteOn('audition',midi);
    const voice=held.get('audition')?.voice; auditionVoice=voice;
    auditionTimer=setTimeout(()=>{noteOff('audition');voice?.release(ctx.currentTime,.5);},600);
  });
  function pauseAll() { releaseHeld(); finishRecording(); if (playing) { stopPlayback(); say('再生を停止'); } if (ctx) allVoices.forEach(voice => voice.release(ctx.currentTime, .08)); }
  window.addEventListener('blur', pauseAll);
  window.addEventListener('pageshow', () => {
    configureAudioSession();
    if (isStandalone) audioNeedsGestureUnlock = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseAll();
      audioNeedsGestureUnlock = true;
    } else if (isStandalone) {
      audioNeedsGestureUnlock = true;
      say('鍵盤をタップすると音声を再開します');
    }
  });
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
