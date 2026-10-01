(() => {
  'use strict';
  const root=document.getElementById('hp-four88');
  const defaults={articulation:'arco',vibratoDepth:0,vibratoRate:5.5,vibratoDelay:.35,attack:.035,brightness:0,reverb:22,decay:2.4};
  const limits={vibratoDepth:[0,35],vibratoRate:[3,8],vibratoDelay:[0,1.5],attack:[.003,.4],brightness:[-8,8],reverb:[0,60],decay:[.5,6]};
  function sanitise(input){
    const out={...defaults};
    if(input&&['arco','spiccato','pizzicato','tremolo'].includes(input.articulation))out.articulation=input.articulation;
    for(const [key,[lo,hi]] of Object.entries(limits))if(Number.isFinite(input?.[key]))out[key]=Math.max(lo,Math.min(hi,input[key]));
    return out;
  }
  let state;try{state=sanitise(JSON.parse(localStorage.getItem('hp-violin-v1')));}catch(_){state={...defaults};}
  const presets={
    soft:{label:'柔らかいソロ',settings:{...defaults,attack:.12,brightness:-3,reverb:24}},
    brilliant:{label:'華やかなソロ',settings:{...defaults,vibratoDepth:12,brightness:2,reverb:28}},
    light:{label:'短く軽快',settings:{...defaults,articulation:'spiccato',attack:.003,reverb:12,decay:1.2}},
    dream:{label:'幻想的',settings:{...defaults,articulation:'tremolo',attack:.14,vibratoDepth:7,reverb:45,decay:4.5}}
  };
  const snapshots=()=>({...state});
  const roundRobin=new Map();
  function descriptor(samples,midi,settings=state){
    const wanted=sanitise(settings).articulation,list=samples.filter(s=>s.articulation===wanted);
    if(!list.length)throw new Error('バイオリンの奏法音源が見つかりません');
    const anchor=list.reduce((best,s)=>Math.abs(s.midi-midi)<Math.abs(best.midi-midi)?s:best).midi;
    const variants=list.filter(s=>s.midi===anchor),key=wanted+':'+anchor,index=roundRobin.get(key)||0;
    roundRobin.set(key,index+1);return variants[index%variants.length];
  }
  const irCache=new WeakMap();
  function impulse(ctx,decay){
    if(!irCache.has(ctx))irCache.set(ctx,new Map());
    const cache=irCache.get(ctx),key=Math.round(decay*10);
    if(cache.has(key))return cache.get(key);
    const buffer=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*decay),ctx.sampleRate);
    let seed=85473;
    for(let c=0;c<2;c++){
      const data=buffer.getChannelData(c);let smooth=0;
      for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;smooth+=.3*(seed/2147483648-1-smooth);data[i]=smooth*Math.exp(-7*i/data.length)*Math.min(1,i/(ctx.sampleRate*.015));}
    }
    cache.set(key,buffer);if(cache.size>4)cache.delete(cache.keys().next().value);return buffer;
  }
  function createSpace(ctx,target,initial=state){
    const input=ctx.createGain(),dry=ctx.createGain(),wet=ctx.createGain(),verb=ctx.createConvolver(),tone=ctx.createBiquadFilter();
    tone.type='lowpass';tone.frequency.value=6500;
    input.connect(dry);dry.connect(target);input.connect(verb);verb.connect(tone);tone.connect(wet);wet.connect(target);
    let lastDecay;
    function update(values){const s=sanitise(values);dry.gain.setValueAtTime(1-s.reverb/100*.25,ctx.currentTime);wet.gain.setValueAtTime(s.reverb/100*.65,ctx.currentTime);if(lastDecay!==s.decay){verb.buffer=impulse(ctx,s.decay);lastDecay=s.decay;}}
    update(initial);
    return {input,update,clear(){verb.buffer=null;verb.buffer=impulse(ctx,lastDecay);},dispose(){for(const n of [input,dry,wet,verb,tone])n.disconnect();}};
  }
  function createVoice(ctx,target,d,buffer,midi,when,values=state,level=.7,onEnded=()=>{}){
    const s=sanitise(values),source=ctx.createBufferSource(),gain=ctx.createGain(),tone=ctx.createBiquadFilter();
    source.buffer=buffer;source.playbackRate.value=2**((midi-d.midi)/12);source.detune.value=d.tune||0;
    const loop=Number.isFinite(d.loopStart)&&Number.isFinite(d.loopEnd);
    if(loop){source.loop=true;source.loopStart=d.loopStart;source.loopEnd=Math.min(d.loopEnd,buffer.duration);}
    const attack=['spiccato','pizzicato'].includes(s.articulation)?Math.min(.015,s.attack):s.attack;
    gain.gain.setValueAtTime(.00001,when);gain.gain.linearRampToValueAtTime(level,when+attack);
    tone.type='highshelf';tone.frequency.value=2600;tone.gain.value=s.brightness;
    source.connect(tone);tone.connect(gain);gain.connect(target);
    let lfo,lfoAmount,ended=false,releaseAt=Infinity,releaseEnd=Infinity,releaseLevel=level;
    if(s.vibratoDepth>0&&loop){
      lfo=ctx.createOscillator();lfo.frequency.value=s.vibratoRate;lfoAmount=ctx.createGain();
      lfoAmount.gain.setValueAtTime(0,when);lfoAmount.gain.setValueAtTime(0,when+s.vibratoDelay);lfoAmount.gain.linearRampToValueAtTime(s.vibratoDepth,when+s.vibratoDelay+.2);
      lfo.connect(lfoAmount);lfoAmount.connect(source.detune);lfo.start(when);
    }
    const voice={source,release(at=ctx.currentTime,seconds=.3){
      if(ended)return;
      // Bowed notes always stop after finger release, including sustain ON.
      if(!Number.isFinite(seconds))seconds=1.2;
      const time=Math.max(when,at),duration=Math.max(.01,Math.min(10,seconds));
      if(time+duration>=releaseEnd)return;
      const current=time<when+attack?level*Math.max(.00001,(time-when)/attack):time<=releaseAt?level:Math.max(.00001,releaseLevel*.01**((time-releaseAt)/(releaseEnd-releaseAt)));
      gain.gain.cancelScheduledValues(time);gain.gain.setValueAtTime(Math.max(.00001,current),time);gain.gain.exponentialRampToValueAtTime(.00001,time+duration);
      releaseAt=time;releaseEnd=time+duration;releaseLevel=current;source.stop(releaseEnd+.02);
    }};
    source.onended=()=>{ended=true;try{lfo?.stop();}catch(_){}for(const n of [source,gain,tone,lfo,lfoAmount])n?.disconnect();onEnded(voice);};
    source.start(when);if(loop)source.stop(when+125);
    return voice;
  }
  function route(ctx,target,values){
    const s=sanitise(values),key=s.reverb+':'+s.decay;
    const spaces=target.hpViolinSpaces||(target.hpViolinSpaces=new Map());
    if(!spaces.has(key))spaces.set(key,createSpace(ctx,target,s));
    return spaces.get(key).input;
  }
  function disposeTarget(target){for(const space of target.hpViolinSpaces?.values()||[])space.dispose();target.hpViolinSpaces?.clear();}
  window.HP_VIOLIN={defaults,sanitise,snapshot:snapshots,presets,descriptor,createSpace,createVoice,route,disposeTarget};
  window.HP_INSTRUMENTS.violin={name:'バイオリン',shift37:12,gain:.85,release:.3,
    description:'実録ソロバイオリン。弓奏・短い弓奏・ピチカート・トレモロを選べます。37鍵はC4〜C7。',samples:window.HP_VIOLIN_SAMPLES};

  const panel=document.createElement('section');panel.className='hp-violin-panel';panel.hidden=true;
  panel.innerHTML='<h2>バイオリンの音作り</h2><p class="hp-setting-help">弓で弾く・短い弓奏・指で弾く・トレモロ。それぞれ実際に録音された奏法です。</p>';
  const presetLabel=document.createElement('label');presetLabel.className='hp-setting';presetLabel.textContent='音作りのプリセット';
  const presetSelect=document.createElement('select');presetSelect.setAttribute('aria-label','バイオリンのプリセット');
  presetSelect.append(new Option('カスタム','custom'));for(const [id,p] of Object.entries(presets))presetSelect.append(new Option(p.label,id));presetLabel.append(presetSelect);panel.append(presetLabel);
  const controls=[
    ['articulation','奏法',[['arco','弓で弾く（アルコ）'],['spiccato','短い弓奏（スピッカート）'],['pizzicato','指で弾く（ピチカート）'],['tremolo','細かく弓を往復（トレモロ）']]],
    ['vibratoDepth','追加ビブラートの深さ',0,35,1,'セント'],['vibratoRate','ビブラートの速さ',3,8,.1,'Hz'],['vibratoDelay','揺れ始めるまで',0,1.5,.05,'秒'],
    ['attack','音の立ち上がり',.003,.4,.001,'秒'],['brightness','音の明るさ',-8,8,1,'dB'],['reverb','ホールの響き',0,60,1,'%'],['decay','響きの長さ',.5,6,.1,'秒']
  ];
  const inputs=new Map();
  function refresh(){for(const [id,item] of inputs){item.input.value=state[id];if(item.out)item.out.textContent=state[id]+item.unit;item.input.dispatchEvent(new Event('hp-value-refresh'));}}
  function changed(){try{localStorage.setItem('hp-violin-v1',JSON.stringify(state));}catch(_){}root.dispatchEvent(new CustomEvent('hp-violin-change',{detail:snapshots()}));}
  for(const [id,title,min,max,step,unit] of controls){
    const label=document.createElement('label');label.className='hp-setting';const heading=document.createElement('span');heading.className='hp-setting-heading';heading.textContent=title;label.append(heading);
    let input,out;
    if(Array.isArray(min)){input=document.createElement('select');for(const [value,text] of min)input.append(new Option(text,value));}
    else{input=document.createElement('input');input.type='range';Object.assign(input,{min,max,step});out=document.createElement('output');heading.append(out);}
    input.dataset.violinParameter=id;input.setAttribute('aria-label','バイオリン：'+title);input.value=state[id];
    input.addEventListener('input',()=>{state[id]=input.type==='range'?Number(input.value):input.value;presetSelect.value='custom';refresh();changed();});
    label.append(input);panel.append(label);inputs.set(id,{input,out,unit});
  }
  panel.append(Object.assign(document.createElement('p'),{className:'hp-setting-help',textContent:'弓奏の原音には自然なビブラートがあります。追加ビブラートで揺れを強められます。短い弓奏とピチカートでは追加ビブラートを使いません。'}));
  const actions=document.createElement('div');actions.className='hp-violin-actions';panel.append(actions);
  const reset=document.createElement('button');reset.type='button';reset.className='hp-control';reset.textContent='バイオリンの標準設定に戻す';reset.dataset.violinReset='true';reset.addEventListener('click',()=>{state={...defaults};presetSelect.value='custom';refresh();changed();});actions.append(reset);
  const audition=document.createElement('button');audition.type='button';audition.className='hp-control';audition.dataset.violinAudition='true';audition.textContent='♪ 試し弾き';audition.disabled=true;audition.addEventListener('click',()=>root.dispatchEvent(new CustomEvent('hp-audition')));actions.append(audition);
  const credit=document.createElement('p');credit.className='hp-credit';credit.innerHTML='音源：<a href="https://versilian-studios.com/vsco-community/" target="_blank" rel="noopener">VSCO 2 Community Edition — Versilian Studios / Sam Gossner</a>（CC0） · <a href="/licenses/violin/CC0.txt" target="_blank" rel="noopener">利用条件</a>';panel.append(credit);
  root.querySelector('[data-effects-panel]').before(panel);
  presetSelect.addEventListener('change',()=>{if(presets[presetSelect.value]){state=sanitise(presets[presetSelect.value].settings);refresh();changed();}});
  function visibility(){panel.hidden=root.dataset.instrument!=='violin';audition.disabled=root.querySelector('[data-action="record"]').disabled;}
  new MutationObserver(visibility).observe(root,{attributes:true,attributeFilter:['data-instrument']});
  new MutationObserver(visibility).observe(root.querySelector('[data-action="record"]'),{attributes:true,attributeFilter:['disabled']});
  refresh();visibility();
})();
