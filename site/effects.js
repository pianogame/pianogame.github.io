(() => {
  'use strict';
  const range=(id,label,min,max,value,step=1,unit='%')=>({id,label,min,max,value,step,unit});
  const choice=(id,label,options,value)=>({id,label,options,value});
  const drive=()=>range('drive','歪みの強さ',0,100,45);
  const tone=()=>range('tone','音の明るさ',0,100,55);
  const mix=(value=40)=>range('mix','エフェクト音の割合',0,100,value);
  const rate=(value=1)=>range('rate','揺れの速さ',.1,8,value,.1,' Hz');
  const depth=(value=50)=>range('depth','揺れの深さ',0,100,value);
  const catalog=[
    {id:'gate',group:'音の調整',name:'ノイズゲート',help:'小さくなった音を閉じます。弱い音も残したいときは、しきい値を下げます。',worklet:true,controls:[range('threshold','音を閉じるしきい値',-70,-18,-54,1,' dB')]},
    {id:'compressor',group:'音の調整',name:'コンプレッサー',help:'強い音を抑えて音量をそろえ、余韻を聴きやすくします。',controls:[range('amount','音をそろえる強さ',0,100,45)]},
    {id:'swell',group:'特殊効果',name:'スロースウェル',help:'無音の後に弾いた音が、ふわっと立ち上がります。',worklet:true,controls:[range('attack','立ち上がる時間',.05,2,.45,.05,'秒')]},
    {id:'wah',group:'ワウ',name:'ワウ',help:'スライダーを動かすと「ワウ」と音色が変わります。',controls:[range('position','ワウの位置',0,100,45)]},
    {id:'autowah',group:'ワウ',name:'オートワウ',help:'弾いた音の強弱に合わせて、ワウが自動で動きます。',worklet:true,controls:[range('depth','音色が動く幅',0,100,70),range('sensitivity','反応のよさ',1,15,6,.5,'')]},
    {id:'octave',group:'音程',name:'オクターバー',help:'1オクターブ下、または上の音を重ねます。',worklet:true,controls:[choice('direction','重ねる音',[['down','1オクターブ下'],['up','1オクターブ上']],'down'),mix(40)]},
    {id:'pitch',group:'音程',name:'ピッチシフター',help:'半音単位で音程を変えます。割合100%で変換した音だけになります。',worklet:true,controls:[range('semitones','音程の移動',-12,12,7,1,'半音'),mix(100)]},
    {id:'harmony',group:'音程',name:'ハーモナイザー',help:'一定の音程差でハモりを重ねます。曲のキーへの自動追従はありません。',worklet:true,controls:[choice('interval','ハモりの音程',[['3','短3度上'],['4','長3度上'],['7','5度上'],['-5','4度下']],'7'),mix(35)]},
    {id:'booster',group:'歪み',name:'ブースター',help:'音を押し上げます。後ろの歪みやアンプを強く鳴らすときにも使えます。',controls:[range('gain','押し上げる音量',0,12,4,.5,' dB')]},
    {id:'overdrive',group:'歪み',name:'オーバードライブ',help:'丸みを残した、あたたかい歪み。',controls:[drive(),tone()]},
    {id:'distortion',group:'歪み',name:'ディストーション',help:'輪郭のある強い歪み。ロックやメタル向け。',controls:[drive(),tone()]},
    {id:'fuzz',group:'歪み',name:'ファズ',help:'つぶれたような、太く荒々しい歪み。',controls:[drive(),tone()]},
    {id:'amp',group:'アンプ',name:'アンプシミュレーター',help:'アンプの増幅と歪みを再現した音作りです。',controls:[choice('model','アンプの音',[['clean','クリーン'],['crunch','クランチ'],['highgain','ハイゲイン']],'clean'),drive(),tone()]},
    {id:'cabinet',group:'アンプ',name:'キャビネット',help:'ギター用スピーカーの帯域と共鳴を加えます。',controls:[choice('model','スピーカーの傾向',[['combo','コンボ：軽快で明るい'],['stack','スタック：厚く引き締まる']],'combo')]},
    {id:'eq',group:'音の調整',name:'EQ',help:'低音・中音・高音の量をそれぞれ調整します。',controls:[range('bass','低音',-12,12,0,1,' dB'),range('mid','中音',-12,12,0,1,' dB'),range('treble','高音',-12,12,0,1,' dB')]},
    {id:'chorus',group:'揺れ・広がり',name:'コーラス',help:'少しずれた音を重ねて、左右に広げます。',controls:[depth(),rate(.8),mix(40)]},
    {id:'flanger',group:'揺れ・広がり',name:'フランジャー',help:'短い反射音を動かして、ジェット機のようなうねりを作ります。',controls:[depth(65),rate(.35),mix(45)]},
    {id:'phaser',group:'揺れ・広がり',name:'フェイザー',help:'音の位相を動かして、なめらかなうねりを作ります。',controls:[depth(65),rate(.6),mix(50)]},
    {id:'tremolo',group:'揺れ・広がり',name:'トレモロ',help:'音量が周期的に大きく、小さくなります。',controls:[depth(55),rate(4)]},
    {id:'vibrato',group:'揺れ・広がり',name:'ビブラート',help:'音程をなめらかに揺らします。',controls:[depth(40),rate(4)]},
    {id:'rotary',group:'揺れ・広がり',name:'ロータリー',help:'回転スピーカー風の、左右に巡る音と揺れ。',controls:[rate(2),mix(65)]},
    {id:'ring',group:'特殊効果',name:'リングモジュレーター',help:'音に別の周波数を掛け合わせ、金属的な響きを作ります。',controls:[range('frequency','金属音の周波数',20,1200,130,5,' Hz'),mix(50)]},
    {id:'crusher',group:'特殊効果',name:'ビットクラッシャー',help:'解像度と更新回数を下げ、粗い電子音にします。',worklet:true,controls:[range('bits','音の解像度',3,16,8,1,' bit'),range('hold','粗さ',1,24,4,1,'倍'),mix(50)]},
    {id:'delay',group:'やまびこ・残響',name:'ディレイ',help:'弾いた音を繰り返します。左右交互はステレオで広がります。',controls:[choice('type','繰り返す音の種類',[['digital','デジタル：くっきり'],['analog','アナログ風：丸い'],['tape','テープ風：揺れる'],['pingpong','左右交互']],'digital'),range('time','繰り返す間隔',60,1000,340,10,' ms'),range('feedback','繰り返す量',0,80,35),mix(30)]},
    {id:'reverb',group:'やまびこ・残響',name:'リバーブ',help:'空間の響きを加えます。シマーは1オクターブ上のきらめきも重なります。',controls:[choice('type','響きの種類',[['room','ルーム：小さな部屋'],['hall','ホール：大きな空間'],['plate','プレート：明るく密な余韻'],['spring','スプリング：ばねの響き'],['shimmer','シマー：幻想的な響き']],'hall'),range('decay','響きの長さ',.5,8,3,.5,'秒'),mix(30)]}
  ];
  const bassCatalog=catalog.filter(e=>['gate','compressor','autowah','octave','overdrive','fuzz','eq','chorus','delay','reverb'].includes(e.id));
  const bassControls=[choice('model','プリアンプの種類',[['driver','Bass Driver風：歪みと原音'],['tube','真空管風：丸く太い'],['modern','モダン：輪郭と重低音'],['clean','クリーンDI：自然な輪郭']],'driver'),range('body','重低音・厚み',0,100,65),range('drive','歪みの強さ（Drive）',0,100,52),range('blend','歪んだ音の割合（Blend）',0,100,65),range('bass','低音',-12,12,3,1,' dB'),range('mid','中音',-12,12,-2,1,' dB'),range('treble','高音',-12,12,2,1,' dB'),range('presence','弦の輪郭（Presence）',0,100,55),range('level','出力の大きさ',0,100,70)];
  const defaultState=()=>({bass:{on:true,...Object.fromEntries(bassControls.map(c=>[c.id,c.value]))},bassFX:Object.fromEntries(bassCatalog.map(effect=>[effect.id,{on:false,...Object.fromEntries(effect.controls.map(c=>[c.id,c.value]))}])),guitar:Object.fromEntries(catalog.map(effect=>[effect.id,{on:['amp','cabinet'].includes(effect.id),...Object.fromEntries(effect.controls.map(c=>[c.id,c.value]))}]))});
  const presets={
    clean:{label:'クリーン',effects:{compressor:{amount:25},amp:{model:'clean',drive:20},cabinet:{model:'combo'},reverb:{type:'room',decay:1.5,mix:16}}},
    rock:{label:'ロック',effects:{gate:{threshold:-58},overdrive:{drive:35,tone:58},amp:{model:'crunch',drive:48},cabinet:{model:'stack'},delay:{type:'analog',time:280,feedback:22,mix:12},reverb:{type:'plate',decay:2,mix:15}}},
    metal:{label:'メタル',effects:{gate:{threshold:-48},amp:{model:'highgain',drive:78,tone:55},cabinet:{model:'stack'},eq:{bass:3,mid:-3,treble:1},reverb:{type:'room',decay:1,mix:10}}},
    dream:{label:'幻想的',effects:{amp:{model:'clean',drive:18},cabinet:{model:'combo'},chorus:{depth:50,rate:.5,mix:35},delay:{type:'tape',time:480,feedback:42,mix:25},reverb:{type:'shimmer',decay:6,mix:45}}}
  };
  function loadState() {
    const state=defaultState();
    try {
      const saved=JSON.parse(localStorage.getItem('hp-effects-v3'));
      const read=(target,source,controls)=>{
        if(!source||typeof source!=='object')return;
        if(typeof source.on==='boolean')target.on=source.on;
        controls.forEach(c=>{
          const v=source[c.id];
          if(c.options ? c.options.some(([id])=>id===v) : typeof v==='number'&&Number.isFinite(v)&&v>=c.min&&v<=c.max) target[c.id]=v;
        });
      };
      read(state.bass,saved?.bass,bassControls);
      bassCatalog.forEach(e=>read(state.bassFX[e.id],saved?.bassFX?.[e.id],e.controls));
      catalog.forEach(e=>read(state.guitar[e.id],saved?.guitar?.[e.id],e.controls));
    } catch(_) {}
    return state;
  }
  function createEngine(ctx,onError=()=>{}) {
    const input=ctx.createGain(),output=ctx.createGain();
    let current=null,workletPromise=null,workletReady=false;
    const irCache=new Map();
    async function prepare() {
      if(workletReady)return true;
      if(!ctx.audioWorklet||typeof AudioWorkletNode==='undefined')return false;
      if(!workletPromise)workletPromise=ctx.audioWorklet.addModule('/effects-worklet.js?v=4').then(()=>{workletReady=true;return true;}).catch(()=>false).finally(()=>{workletPromise=null;});
      return workletPromise;
    }
    function makeGraph() {
      const nodes=[],sources=[];let wahNode;
      const own=node=>(nodes.push(node),node);
      const gain=(value=1)=>{const n=own(ctx.createGain());n.gain.value=value;return n;};
      const filter=(type,freq,q=.707,db=0)=>{const n=own(ctx.createBiquadFilter());n.type=type;n.frequency.value=freq;n.Q.value=q;n.gain.value=db;return n;};
      const chain=(...parts)=>{for(let i=1;i<parts.length;i++)parts[i-1].connect(parts[i]);return {input:parts[0],output:parts.at(-1)};};
      const osc=(freq,param,amount=1,type='sine')=>{const n=own(ctx.createOscillator()),g=gain(amount);n.type=type;n.frequency.value=freq;n.connect(g);g.connect(param);n.start();sources.push(n);return n;};
      const delay=time=>{const n=own(ctx.createDelay(2));n.delayTime.value=time;return n;};
      const dsp=options=>{
        if(!workletReady)throw new Error('音程・特殊エフェクトを準備できませんでした');
        const n=own(new AudioWorkletNode(ctx,'piano-palette-dsp',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],processorOptions:options}));
        n.onprocessorerror=()=>onError('エフェクトの処理が停止しました。全OFFにして、ページを開き直してください。');
        return n;
      };
      const blend=(effect,amount)=>{
        const inlet=gain(),outlet=gain(),dry=gain(1-amount),wet=gain(amount);
        inlet.connect(dry);dry.connect(outlet);inlet.connect(effect.input);effect.output.connect(wet);wet.connect(outlet);
        return {input:inlet,output:outlet};
      };
      const shape=(kind,amount)=>{
        const n=own(ctx.createWaveShaper()),curve=new Float32Array(4097);
        const intensity=kind==='fuzz'?6+amount*30:kind==='distortion'?2+amount*20:1+amount*10;
        for(let i=0;i<curve.length;i++) {
          const x=i/(curve.length-1)*2-1;
          curve[i]=kind==='fuzz'?Math.max(-.8,Math.min(.9,x*intensity+(x*x*.12))):kind==='distortion'?Math.atan(x*intensity)*2/Math.PI:Math.tanh(x*intensity)/Math.tanh(intensity);
        }
        n.curve=curve;n.oversample='2x';return n;
      };
      const driveUnit=(kind,p)=>chain(filter('highpass',kind==='fuzz'?65:90),shape(kind,p.drive/100),filter('lowpass',1500+p.tone*65),gain(kind==='fuzz'?.48:kind==='distortion'?.55:.68));
      function impulse(type,decay) {
        const key=type+':'+decay;
        if(irCache.has(key))return irCache.get(key);
        const duration=decay*1.15,buffer=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate);
        let seed=73643;
        for(let c=0;c<2;c++) {
          const data=buffer.getChannelData(c);let smooth=0,energy=0;
          for(let i=0;i<data.length;i++) {
            const t=i/ctx.sampleRate;seed=(1664525*seed+1013904223)>>>0;
            const cutoff=(type==='plate'?8500:type==='room'?4600:6500)*Math.exp(-t/Math.max(.4,decay)) + 650;
            smooth+=(1-Math.exp(-2*Math.PI*cutoff/ctx.sampleRate))*(seed/2147483648-1-smooth);
            const onset=type==='room'?.006:type==='plate'?.012:.03;
            let sample=smooth*Math.min(1,t/onset);
            if(type==='spring') {
              const chirp=Math.sin(2*Math.PI*(1500*t+95*Math.log(1+20*t))+c*.2);
              sample=.25*smooth+.65*chirp*Math.exp(-t*3);
            }
            data[i]=sample*Math.exp(-6.907755*t/decay);energy+=data[i]*data[i];
          }
          const scale=1/Math.sqrt(Math.max(energy,.00001));
          for(let i=0;i<data.length;i++)data[i]*=scale;
        }
        if(irCache.size>=4)irCache.delete(irCache.keys().next().value);
        irCache.set(key,buffer);return buffer;
      }
      function effect(id,p) {
        if(id==='booster'){const n=gain(Math.pow(10,p.gain/20));return chain(n);}
        if(['overdrive','distortion','fuzz'].includes(id))return driveUnit(id,p);
        if(id==='amp') {
          const pre=filter('highshelf',2000,.7,p.model==='clean'?1:3);
          const sh=shape(p.model==='clean'?'overdrive':'distortion',p.drive/100*(p.model==='clean'?.18:p.model==='crunch'?.6:1));
          return chain(pre,sh,filter('peaking',750,.7,p.model==='highgain'?-2:1.5),filter('lowpass',2300+p.tone*70),gain(p.model==='clean'?.95:.65));
        }
        if(id==='cabinet')return chain(filter('highpass',p.model==='stack'?80:100,.8),filter('peaking',p.model==='stack'?140:220,.8,p.model==='stack'?3:1.5),filter('peaking',1800,1.1,-3),filter('lowpass',p.model==='stack'?4600:5800,.65),filter('lowpass',7600,.7));
        if(id==='eq')return chain(filter('lowshelf',180,.7,p.bass),filter('peaking',900,.85,p.mid),filter('highshelf',3400,.7,p.treble));
        if(id==='compressor') {
          const n=own(ctx.createDynamicsCompressor());n.threshold.value=-12-p.amount*.3;n.ratio.value=1.5+p.amount*.065;n.knee.value=15;n.attack.value=.012;n.release.value=.18;
          return chain(n,gain(1+p.amount*.012));
        }
        if(id==='gate'||id==='swell')return chain(dsp({type:id,...p}));
        if(id==='autowah')return chain(dsp({type:id,sensitivity:p.sensitivity,depth:p.depth*35}));
        if(id==='wah'){wahNode=filter('bandpass',260*Math.pow(10,p.position/100),2);return chain(wahNode,gain(2));}
        if(['pitch','harmony','octave'].includes(id)) {
          const semitones=id==='pitch'?p.semitones:id==='harmony'?Number(p.interval):p.direction==='down'?-12:12;
          return blend(chain(dsp({type:'pitch',semitones})),p.mix/100);
        }
        if(id==='crusher')return blend(chain(dsp({type:'crusher',bits:p.bits,hold:p.hold})),p.mix/100);
        if(id==='ring'){const n=gain(0);osc(p.frequency,n.gain);return blend(chain(n),p.mix/100);}
        if(id==='tremolo'){const n=gain(1-p.depth/200);osc(p.rate,n.gain,p.depth/200);return chain(n);}
        if(id==='vibrato'){const n=delay(.009);osc(p.rate,n.delayTime,p.depth/100*.006);return chain(n);}
        if(id==='chorus') {
          const inlet=gain(),merger=own(ctx.createChannelMerger(2));
          for(let c=0;c<2;c++) {const n=delay(.018+c*.005),mono=gain();mono.channelCount=1;mono.channelCountMode='explicit';inlet.connect(mono);mono.connect(n);osc(p.rate*(c?1.07:1),n.delayTime,p.depth/100*.005);n.connect(merger,0,c);}
          return blend({input:inlet,output:merger},p.mix/100);
        }
        if(id==='flanger'){const n=delay(.0035),f=gain(.48);osc(p.rate,n.delayTime,p.depth/100*.0028);n.connect(f);f.connect(n);return blend(chain(n),p.mix/100);}
        if(id==='phaser') {
          const stages=[350,700,1400,2800].map(freq=>filter('allpass',freq,.7));
          stages.forEach(n=>osc(p.rate,n.frequency,n.frequency.value*p.depth/100*.85));
          return blend(chain(...stages),p.mix/100);
        }
        if(id==='rotary') {
          const n=delay(.006),amp=gain(.8),pan=own(ctx.createStereoPanner());
          osc(p.rate,n.delayTime,.0018);osc(p.rate,amp.gain,.2);osc(p.rate,pan.pan,.85);
          return blend(chain(n,filter('lowpass',5500),amp,pan),p.mix/100);
        }
        if(id==='delay') {
          const n=delay(p.time/1000),input=gain(),result=gain();input.connect(n);
          if(p.type==='pingpong') {
            const mono=gain(),right=delay(p.time/1000),merger=own(ctx.createChannelMerger(2)),feedback=gain(p.feedback/100);
            mono.channelCount=1;mono.channelCountMode='explicit';n.connect(mono);mono.connect(merger,0,0);mono.connect(right);right.connect(merger,0,1);right.connect(feedback);feedback.connect(n);merger.connect(result);
          } else {
            const damp=filter('lowpass',p.type==='digital'?15000:p.type==='analog'?2400:4500),feedback=gain(p.feedback/100);
            n.connect(damp);damp.connect(result);damp.connect(feedback);feedback.connect(n);
            if(p.type==='tape')osc(.7,n.delayTime,.0016);
          }
          return blend({input,output:result},p.mix/100);
        }
        if(id==='reverb') {
          const pre=delay(p.type==='room'?.008:.025),verb=own(ctx.createConvolver());verb.normalize=false;verb.buffer=impulse(p.type,p.decay);
          const processed=chain(pre,verb,filter('highpass',130),filter('lowpass',p.type==='plate'?8000:6200));
          return blend(processed,p.mix/100);
        }
        throw new Error('Unknown effect: '+id);
      }
      function bassStage(p) {
        const inlet=gain(),sum=gain(),clean=gain(1-p.blend/100),wet=gain(p.blend/100*.65);
        const model=p.model||'driver';
        const path=model==='clean'?chain(filter('highpass',28),filter('lowpass',9000)):
          model==='tube'?chain(filter('highpass',28),shape('overdrive',p.drive/100*.65),filter('lowpass',3600),filter('peaking',220,.7,3)):
          model==='modern'?chain(filter('highpass',30),shape('distortion',p.drive/100*.6),filter('peaking',1100,.8,3),filter('lowpass',6500)):
          chain(filter('highpass',35),filter('highshelf',1100,.7,p.presence*.075),shape('overdrive',p.drive/100),filter('lowpass',4200+p.presence*35));
        inlet.connect(clean);clean.connect(sum);inlet.connect(path.input);path.output.connect(wet);wet.connect(sum);
        const bodyComp=own(ctx.createDynamicsCompressor());
        bodyComp.threshold.value=-14;bodyComp.knee.value=10;bodyComp.ratio.value=2.5;bodyComp.attack.value=.016;bodyComp.release.value=.09;
        // Keep the bass foundation in one path to avoid phase cancellation.
        const eq=chain(sum,filter('lowshelf',130,.7,p.body*.07),filter('peaking',240,.8,p.body*.025),filter('lowshelf',80,.7,p.bass),filter('peaking',700,.8,p.mid),filter('highshelf',3000,.7,p.treble),bodyComp,gain(p.level/70));
        return {input:inlet,output:eq.output};
      }
      function finalEffect(id,p) {
        if(id!=='reverb'||p.type!=='shimmer')return effect(id,p);
        const pre=delay(.025),verb=own(ctx.createConvolver());verb.normalize=false;verb.buffer=impulse('hall',p.decay);
        const clean=gain(.6),up=dsp({type:'pitch',semitones:12}),shimmer=gain(.55),out=gain();
        pre.connect(verb);verb.connect(clean);clean.connect(out);verb.connect(up);up.connect(shimmer);shimmer.connect(out);
        const tone=chain(out,filter('highpass',160),filter('lowpass',8500));
        return blend({input:pre,output:tone.output},p.mix/100);
      }
      const inlet=gain(),outlet=gain(0);
      return {input:inlet,output:outlet,effect:finalEffect,bass:bassStage,chain,
        updateWah(position){wahNode?.frequency.setTargetAtTime(260*Math.pow(10,position/100),ctx.currentTime,.015);},
        dispose(){for(const n of sources){try{n.stop();}catch(_){}}for(const n of nodes){if(n.port){n.port.postMessage({dispose:true});n.port.close();}n.disconnect();}}
      };
    }
    function rebuild(instrument,state) {
      const next=makeGraph();
      try {
        let tail=next.input;
        const add=stage=>{tail.connect(stage.input);tail=stage.output;};
        if(instrument==='bass'){
          const before=['gate','compressor','octave','autowah'];
          before.forEach(id=>{if(state.bassFX?.[id]?.on)add(next.effect(id,state.bassFX[id]));});
          if(state.bass.on)add(next.bass(state.bass));
          bassCatalog.filter(e=>!before.includes(e.id)).forEach(e=>{if(state.bassFX?.[e.id]?.on)add(next.effect(e.id,state.bassFX[e.id]));});
        }
        if(instrument==='guitar')for(const e of catalog)if(state.guitar[e.id].on)add(next.effect(e.id,state.guitar[e.id]));
        tail.connect(next.output);input.connect(next.input);next.output.connect(output);
        const now=ctx.currentTime;next.output.gain.setValueAtTime(0,now);next.output.gain.linearRampToValueAtTime(1,now+.04);
        const previous=current;current=next;
        if(previous){previous.output.gain.cancelScheduledValues(now);previous.output.gain.setValueAtTime(previous.output.gain.value,now);previous.output.gain.linearRampToValueAtTime(0,now+.04);setTimeout(()=>{input.disconnect(previous.input);previous.dispose();},80);}
        return true;
      } catch(error){next.dispose();onError(error.message);return false;}
    }
    return {input,output,prepare,rebuild,updateWah(position){current?.updateWah(position);},dispose(){input.disconnect();current?.dispose();output.disconnect();},get workletReady(){return workletReady;}};
  }
  window.HP_EFFECTS={catalog,bassCatalog,bassControls,defaultState,loadState,presets,createEngine};
})();
