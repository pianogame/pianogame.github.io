(() => {
  'use strict';
  const root=document.getElementById('hp-four88'),host=root.querySelector('[data-effects-panel]');
  const api=window.HP_EFFECTS,state=api.loadState();
  let instrument='piano',engine=null,applying=false,changeTimer;
  const controls=new Map();
  const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;};
  const status=el('p','hp-fx-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const bassPanel=el('section','hp-fx-panel'),guitarPanel=el('section','hp-fx-panel');
  bassPanel.hidden=guitarPanel.hidden=true;
  function save(){try{localStorage.setItem('hp-effects-v3',JSON.stringify(state));}catch(_){}}
  function target(id){return id==='bass'?state.bass:id.startsWith('bass:')?state.bassFX[id.slice(5)]:state.guitar[id];}
  function describe(control,value){return control.options?control.options.find(([id])=>id===value)?.[1]:(Number.isInteger(value)?value:Number(value.toFixed(2)))+control.unit;}
  function parameter(effect,control) {
    const label=el('label','hp-fx-parameter'),heading=el('span','hp-setting-heading'),name=el('span','',control.label),out=el('output');
    heading.append(name,out);label.append(heading);
    let input;
    if(control.options){input=el('select');control.options.forEach(([value,text])=>{const o=el('option','',text);o.value=value;input.append(o);});}
    else{input=el('input');input.type='range';input.min=control.min;input.max=control.max;input.step=control.step;}
    input.dataset.effect=effect;input.dataset.parameter=control.id;input.setAttribute('aria-label',(effect==='bass'?'ベース':api.catalog.find(e=>e.id===effect.replace('bass:','')).name)+'：'+control.label);
    const refresh=()=>{const value=target(effect)[control.id];input.value=String(value);if(!control.options)input.style.setProperty('--range-progress',100*(value-control.min)/(control.max-control.min)+'%');out.textContent=describe(control,value);input.setAttribute('aria-valuetext',describe(control,value));};
    input.addEventListener('input',()=>{
      target(effect)[control.id]=control.options?input.value:Number(input.value);refresh();markCustom();
      if(effect==='wah'&&engine)engine.updateWah?.(target(effect).position);
    });
    input.addEventListener('change',()=>{save();void apply();});
    label.append(input);refresh();controls.set(effect+':'+control.id,refresh);return label;
  }
  function markCustom(){presetSelect.value='custom';}
  function sync() {
    controls.forEach(fn=>fn());
    host.querySelectorAll('[data-effect-toggle]').forEach(button=>{
      const id=button.dataset.effectToggle,on=target(id).on;
      button.setAttribute('aria-checked',String(on));button.textContent=on?'ON':'OFF';button.closest('.hp-fx-card').dataset.on=String(on);
    });
    const active=api.catalog.filter(e=>state.guitar[e.id].on);
    chainOutput.textContent=active.length?active.map(e=>e.name).join(' → '):'全OFF · 録音されたギターの原音';
    count.textContent=active.length+' / '+api.catalog.length+' ON';
  }
  async function apply() {
    clearTimeout(changeTimer);
    if(!engine){sync();save();status.textContent='演奏をはじめると、この設定で音が鳴ります。';return;}
    if(applying){await new Promise(resolve=>setTimeout(resolve,40));return apply();}
    applying=true;
    try {
      if(instrument==='guitar'||instrument==='bass') {
        const bank=instrument==='bass'?state.bassFX:state.guitar,list=instrument==='bass'?api.bassCatalog:api.catalog;
        const needs=list.some(e=>bank[e.id].on&&(e.worklet||(e.id==='reverb'&&bank.reverb.type==='shimmer')));
        if(needs&&!await engine.prepare()) {
          status.textContent='一部のエフェクトを読み込めませんでした。通信を確認して、もう一度ONにしてください。';
          list.forEach(e=>{if(e.worklet||(e.id==='reverb'&&bank.reverb.type==='shimmer'))bank[e.id].on=false;});
        } else status.textContent='設定を反映しました。試し弾きで音を確認できます。';
      } else status.textContent='設定を反映しました。試し弾きで音を確認できます。';
      engine.rebuild(instrument,state);sync();save();
    } finally {applying=false;}
  }
  function card(id,name,help,parameters) {
    const article=el('article','hp-fx-card'),top=el('div','hp-fx-card-top'),title=el('h3','',name),toggle=el('button','hp-fx-toggle');
    toggle.type='button';toggle.dataset.effectToggle=id;toggle.setAttribute('role','switch');toggle.setAttribute('aria-label',name+'を使う');
    toggle.addEventListener('click',()=>{target(id).on=!target(id).on;markCustom();sync();void apply();});
    top.append(title,toggle);article.append(top,el('p','hp-setting-help',help));
    const details=el('details','hp-fx-details'),summary=el('summary','','音を調整');
    details.append(summary);parameters.forEach(c=>details.append(parameter(id,c)));article.append(details);return article;
  }
  const bassTitle=el('h2','','ベースの音作り');bassPanel.append(bassTitle);
  bassPanel.append(card('bass','ベース用プリアンプ','「音を調整」から4種類を切り替えられます。Bass Driver風を含む、実機の傾向を参考にした音作りです。公式プラグインではありません。',api.bassControls));
  const bassPresets=el('div','hp-fx-presets');
  [['重く厚い',{body:90,drive:42,blend:45,bass:5,mid:2,treble:-1,presence:28}],['太く自然',{body:65,drive:32,blend:48,bass:3,mid:0,treble:0,presence:35}],['輪郭くっきり',{drive:52,blend:65,bass:3,mid:-2,treble:2,presence:55}],['強く歪ませる',{drive:86,blend:85,bass:2,mid:2,treble:2,presence:65}]].forEach(([name,values])=>{
    const b=el('button','hp-control',name);b.type='button';b.addEventListener('click',()=>{Object.assign(state.bass,values,{on:true,level:70});sync();void apply();});bassPresets.append(b);
  });
  bassPanel.append(bassPresets);
  const bassOff=el('button','hp-control','ベースのエフェクターを全OFF');bassOff.type='button';
  bassOff.addEventListener('click',()=>{state.bass.on=false;Object.values(state.bassFX).forEach(e=>e.on=false);sync();void apply();});bassPanel.append(bassOff);
  bassPanel.append(el('p','hp-setting-help','各エフェクターを個別にON/OFFできます。ギターとは別の設定で保存します。'));
  api.bassCatalog.forEach(e=>bassPanel.append(card('bass:'+e.id,e.name,e.help,e.controls)));
  const heading=el('div','hp-fx-heading'),title=el('h2','','ギターのエフェクター'),count=el('output','hp-fx-count');heading.append(title,count);guitarPanel.append(heading);
  const presetLabel=el('label','hp-fx-preset-label','音作りのプリセット');
  const presetSelect=el('select');presetSelect.setAttribute('aria-label','ギターのプリセット');
  const custom=el('option','','カスタム');custom.value='custom';presetSelect.append(custom);
  Object.entries(api.presets).forEach(([id,preset])=>{const option=el('option','',preset.label);option.value=id;presetSelect.append(option);});
  presetSelect.addEventListener('change',()=>{
    const preset=api.presets[presetSelect.value];if(!preset)return;
    const fresh=api.defaultState().guitar;Object.values(fresh).forEach(e=>e.on=false);
    Object.entries(preset.effects).forEach(([id,params])=>Object.assign(fresh[id],params,{on:true}));
    state.guitar=fresh;sync();void apply();
  });
  presetLabel.append(presetSelect);guitarPanel.append(presetLabel);
  const allOff=el('button','hp-control','エフェクターを全OFF');allOff.type='button';allOff.addEventListener('click',()=>{Object.values(state.guitar).forEach(e=>e.on=false);markCustom();sync();void apply();});guitarPanel.append(allOff);
  guitarPanel.append(el('p','hp-setting-help','ONのエフェクターは同時に使えます。「音を調整」を開くと、それぞれの強さを変えられます。'));
  const chainDetails=el('details','hp-fx-chain'),chainSummary=el('summary','','現在の音の通り道'),chainOutput=el('p');chainDetails.append(chainSummary,chainOutput);guitarPanel.append(chainDetails);
  const groupOrder=['歪み','アンプ','音の調整','ワウ','揺れ・広がり','音程','やまびこ・残響','特殊効果'];
  groupOrder.forEach(group=>{
    const section=el('details','hp-fx-group'),summary=el('summary','',group);section.append(summary);
    if(group==='歪み'||group==='アンプ')section.open=true;
    api.catalog.filter(e=>e.group===group).forEach(e=>section.append(card(e.id,e.name,e.help,e.controls)));guitarPanel.append(section);
  });
  const audition=el('button','hp-control hp-fx-audition','♪ 試し弾き');audition.type='button';audition.dataset.action='audition';audition.disabled=true;
  audition.addEventListener('click',()=>root.dispatchEvent(new CustomEvent('hp-audition')));
  host.append(bassPanel,guitarPanel,audition,status);host.hidden=true;sync();
  window.HP_EFFECTS_UI={
    state,
    attach(audioContext){engine=api.createEngine(audioContext,message=>status.textContent=message);void apply();return engine;},
    async setInstrument(id){instrument=id;host.hidden=id==='piano';bassPanel.hidden=id!=='bass';guitarPanel.hidden=id!=='guitar';await apply();},
    setReady(ready){audition.disabled=!ready;},
    get engine(){return engine;}
  };
})();
