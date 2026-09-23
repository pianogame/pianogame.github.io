(() => {
  'use strict';
  const root = document.getElementById('hp-four88');
  if (!root || !window.HP_INSTRUMENTS || root.dataset.multitrackReady) return;
  root.dataset.multitrackReady = 'true';

  const instruments = window.HP_INSTRUMENTS;
  const action = name => root.querySelector('[data-action="' + name + '"]');
  const recordButton = action('record');
  const playButton = action('play');
  const startButton = action('start');
  const instrumentControl = root.querySelector('[data-control="instrument"]');
  const releaseControl = root.querySelector('[data-control="release"]');
  const sustainButton = action('sustain');
  const volumeControl = root.querySelector('[data-control="volume"]');
  const status = root.querySelector('.hp-status');
  const surface = root.querySelector('.hp-surface');
  const storageKey = 'piano-palette-multitrack-v1';
  const MAX_TRACKS = 30, MAX_SECONDS = 120, MAX_NOTES = 1500;

  let tracks = [];
  let groupMutes = {piano:false,bass:false,guitar:false};
  let takeNumber = 1;
  let recording = null, recordingStartedAt = 0, recordingTimer = null;
  let playing = false, playbackEndTimer = null, playbackSources = [], playbackBuses = [];
  let engine = null, engineMaster = null, busy = false;
  const activeRecordedNotes = new Map();
  const sampleBuffers = new Map(), roundRobin = new Map();

  const now = () => performance.now()/1000;
  const clamp = (value,low,high) => Math.min(high,Math.max(low,Number(value)||0));
  const instrumentName = id => instruments[id]?.name || id;
  const say = (text,error=false) => { status.textContent=text; status.dataset.error=String(error); };

  function loadState() {
    try {
      const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
      if(!saved||!Array.isArray(saved.tracks))return;
      tracks=saved.tracks.slice(0,MAX_TRACKS).filter(t=>instruments[t.instrument]&&Array.isArray(t.notes)).map(t=>({
        id:String(t.id),instrument:t.instrument,name:String(t.name||instrumentName(t.instrument)).slice(0,64),muted:!!t.muted,
        duration:clamp(t.duration,0,MAX_SECONDS),notes:t.notes.slice(0,MAX_NOTES).filter(n=>Number.isFinite(n.midi)&&n.midi>=18&&n.midi<=108).map(n=>({
          midi:Math.round(n.midi),start:clamp(n.start,0,MAX_SECONDS),duration:clamp(n.duration,.015,MAX_SECONDS),release:clamp(n.release,.01,10),sustain:!!n.sustain
        }))
      }));
      for(const id of Object.keys(groupMutes))groupMutes[id]=!!saved.groupMutes?.[id];
      takeNumber=Math.max(1,Math.round(Number(saved.takeNumber)||1));
    }catch(_){}
  }
  function saveState(){
    try{localStorage.setItem(storageKey,JSON.stringify({tracks,groupMutes,takeNumber}));}
    catch(_){say('録音データを端末に保存できませんでした。保存容量を確認してください。',true);}
  }
  loadState();

  const curtain=document.createElement('div');
  curtain.className='hp-curtain';curtain.setAttribute('aria-hidden','true');
  curtain.innerHTML='<div class="hp-curtain-half"></div><div class="hp-curtain-half"></div><div class="hp-curtain-title">✦ Piano Palette ✦</div>';
  surface.append(curtain);
  function measureHeader(){surface.style.setProperty('--hp-stage-top',root.querySelector('.hp-header').offsetHeight+'px');}
  measureHeader();new ResizeObserver(measureHeader).observe(root.querySelector('.hp-header'));
  window.addEventListener('resize',measureHeader);window.addEventListener('hp-viewport-resize',measureHeader);
  function openCurtainWhenReady(){
    if(!startButton.hidden||curtain.hidden||curtain.classList.contains('open'))return;
    curtain.classList.add('open');setTimeout(()=>{curtain.hidden=true;},1250);
  }
  new MutationObserver(openCurtainWhenReady).observe(startButton,{attributes:true,attributeFilter:['hidden']});
  openCurtainWhenReady();

  const trackButton=document.createElement('button');
  trackButton.type='button';trackButton.className='hp-control';trackButton.textContent='🎚 録音一覧';trackButton.setAttribute('aria-expanded','false');
  root.querySelector('.hp-toolbar').insertBefore(trackButton,action('display-mode'));
  const panel=document.createElement('section');panel.className='hp-track-panel';panel.hidden=true;panel.setAttribute('aria-label','楽器別録音と保存');surface.append(panel);
  trackButton.addEventListener('click',()=>{panel.hidden=!panel.hidden;trackButton.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)renderPanel();});

  const isAudible=track=>!track.muted&&!groupMutes[track.instrument];
  const audibleTracks=()=>tracks.filter(track=>track.notes.length&&isAudible(track));
  function updatePlayButton(){
    if(playing){playButton.disabled=false;playButton.textContent='■ 停止';return;}
    playButton.textContent='▶ 全トラック再生';
    playButton.disabled=recordButton.disabled||!tracks.some(track=>track.notes.length);
  }

  function renderPanel(){
    panel.replaceChildren();
    const heading=document.createElement('h2');heading.textContent='楽器別の多重録音';panel.append(heading);
    const help=document.createElement('p');help.textContent='楽器を選んで録音するたびに新しいトラックを追加します。ミュート中のトラックは再生・音声保存に含まれません。';panel.append(help);
    for(const id of Object.keys(instruments)){
      const group=document.createElement('div');group.className='hp-track-group';
      const title=document.createElement('strong');title.textContent=instrumentName(id)+'（'+tracks.filter(t=>t.instrument===id).length+'録音）';
      const mute=document.createElement('button');mute.type='button';mute.dataset.groupMute=id;mute.setAttribute('aria-pressed',String(groupMutes[id]));mute.textContent=groupMutes[id]?'楽器ミュート解除':'楽器をミュート';
      group.append(title,mute);panel.append(group);
      for(const track of tracks.filter(t=>t.instrument===id)){
        const row=document.createElement('div');row.className='hp-track-row';
        const info=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');
        strong.textContent=track.name;small.textContent=track.notes.length+'音 · '+track.duration.toFixed(1)+'秒';info.append(strong,small);
        const muteTrack=document.createElement('button');muteTrack.type='button';muteTrack.dataset.trackMute=track.id;muteTrack.setAttribute('aria-pressed',String(track.muted));muteTrack.textContent=track.muted?'ONにする':'ミュート';
        const remove=document.createElement('button');remove.type='button';remove.dataset.removeTrack=track.id;remove.textContent='削除';
        row.append(info,muteTrack,remove);panel.append(row);
      }
    }
    const exportRow=document.createElement('div');exportRow.className='hp-export-row';
    const format=document.createElement('select');format.dataset.exportFormat='true';format.setAttribute('aria-label','保存形式');format.append(new Option('WAV（非圧縮）','wav'));
    if(window.MediaRecorder?.isTypeSupported?.('audio/mp4'))format.append(new Option('MP4（音声）','mp4'));
    if(window.MediaRecorder?.isTypeSupported?.('audio/webm;codecs=opus'))format.append(new Option('WebM（音声）','webm'));
    const save=document.createElement('button');save.type='button';save.dataset.exportMix='true';save.textContent=busy?'保存処理中…':'💾 全体の音を保存';save.disabled=busy||!audibleTracks().length;
    exportRow.append(format,save);panel.append(exportRow);
    const note=document.createElement('p');note.className='hp-track-note';note.textContent='WAVは常に選べます。MP4 / WebM は、このブラウザがその音声形式に対応している場合だけ表示します。';panel.append(note);
    updatePlayButton();
  }

  panel.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.groupMute){const id=button.dataset.groupMute;groupMutes[id]=!groupMutes[id];applyLiveMutes();saveState();renderPanel();return;}
    if(button.dataset.trackMute){const track=tracks.find(t=>t.id===button.dataset.trackMute);if(track){track.muted=!track.muted;applyLiveMutes();saveState();renderPanel();}return;}
    if(button.dataset.removeTrack){stopPlayback();tracks=tracks.filter(t=>t.id!==button.dataset.removeTrack);saveState();renderPanel();return;}
    if(button.dataset.exportMix)void exportMix(panel.querySelector('[data-export-format]').value);
  });

  function beginRecording(){
    if(recordButton.disabled||busy)return;
    stopPlayback();
    if(tracks.length>=MAX_TRACKS){say('録音は最大30トラックです。不要な録音を削除してから追加してください。',true);return;}
    const id=instrumentControl.value;
    recording={id:'take-'+Date.now()+'-'+takeNumber,instrument:id,name:instrumentName(id)+' '+takeNumber+'回目',muted:false,duration:0,notes:[]};
    takeNumber++;recordingStartedAt=now();activeRecordedNotes.clear();
    recordButton.setAttribute('aria-pressed','true');recordButton.textContent='■ 録音停止';playButton.disabled=true;
    recordingTimer=setInterval(()=>{
      if(!recording)return;const elapsed=now()-recordingStartedAt;say(instrumentName(recording.instrument)+' 録音中 · '+elapsed.toFixed(1)+'秒 · '+recording.notes.length+'音');
      if(elapsed>=MAX_SECONDS||recording.notes.length>=MAX_NOTES)finishRecording();
    },100);
    say(instrumentName(id)+' 録音中 · 0.0秒');
  }
  function finishRecording(){
    if(!recording)return;const endedAt=now();
    for(const token of [...activeRecordedNotes.keys()])endRecordedNote(token,endedAt);
    clearInterval(recordingTimer);recordingTimer=null;
    const finished=recording;recording=null;finished.duration=clamp(endedAt-recordingStartedAt,.01,MAX_SECONDS);
    recordButton.setAttribute('aria-pressed','false');recordButton.textContent='● 録音';
    if(finished.notes.length){tracks.push(finished);saveState();say(finished.name+'：'+finished.notes.length+'音を保存しました');}
    else say('演奏がなかったため、空の録音は追加しませんでした');
    renderPanel();
  }
  function beginRecordedNote(token,midi,startedAt=now()){
    if(!recording||activeRecordedNotes.has(token)||token==='audition')return;
    if(recording.notes.length>=MAX_NOTES){finishRecording();return;}
    const note={midi,start:clamp(startedAt-recordingStartedAt,0,MAX_SECONDS),duration:.06,release:clamp(releaseControl.value,.01,10),sustain:sustainButton.getAttribute('aria-pressed')==='true'};
    recording.notes.push(note);activeRecordedNotes.set(token,{note,startedAt});
  }
  function endRecordedNote(token,endedAt=now()){
    const entry=activeRecordedNotes.get(token);if(!entry)return;
    entry.note.duration=clamp(endedAt-entry.startedAt,.015,MAX_SECONDS);activeRecordedNotes.delete(token);
  }
  root.addEventListener('hp-note-on',event=>beginRecordedNote(event.detail.token,event.detail.midi));
  root.addEventListener('hp-note-off',event=>endRecordedNote(event.detail.token));
  root.addEventListener('hp-stop-sound',()=>{stopPlayback();for(const token of [...activeRecordedNotes.keys()])endRecordedNote(token);});
  instrumentControl.addEventListener('change',()=>{if(recording)finishRecording();},true);

  recordButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();recording?finishRecording():beginRecording();},true);
  playButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(playing){stopPlayback();say('再生を停止しました');}else void startPlayback();},true);
  const buttonObserver=new MutationObserver(updatePlayButton);
  buttonObserver.observe(recordButton,{attributes:true,attributeFilter:['disabled']});
  buttonObserver.observe(playButton,{attributes:true,attributeFilter:['disabled']});

  async function ensureEngine(){
    if(!engine){
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('このブラウザでは音声再生を利用できません');
      engine=new Audio({latencyHint:'interactive'});engineMaster=engine.createGain();const limiter=engine.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=12;limiter.ratio.value=4;engineMaster.connect(limiter);limiter.connect(engine.destination);
    }
    engineMaster.gain.value=clamp(volumeControl.value,0,100)/100*.55;if(engine.state!=='running')await engine.resume();
  }
  function nearestMidi(id,midi){let best=instruments[id].samples[0].midi;for(const sample of instruments[id].samples)if(Math.abs(sample.midi-midi)<Math.abs(best-midi))best=sample.midi;return best;}
  function descriptorFor(id,midi,purpose='load'){
    const anchor=nearestMidi(id,midi),variants=instruments[id].samples.filter(sample=>sample.midi===anchor);
    const key=id+':'+purpose+':'+anchor,index=roundRobin.get(key)||0;roundRobin.set(key,index+1);return variants[index%variants.length];
  }
  async function getSampleBuffer(url){
    if(sampleBuffers.has(url))return sampleBuffers.get(url);await ensureEngine();const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw new Error('音源を読み込めませんでした');
    const decoded=await engine.decodeAudioData(await response.arrayBuffer());sampleBuffers.set(url,decoded);return decoded;
  }
  async function preload(selected){
    const urls=new Set();for(const track of selected)for(const note of track.notes){const anchor=nearestMidi(track.instrument,note.midi);for(const sample of instruments[track.instrument].samples.filter(s=>s.midi===anchor))urls.add(sample.url);}
    const list=[...urls];let cursor=0;await Promise.all(Array.from({length:Math.min(4,list.length)},async()=>{while(cursor<list.length)await getSampleBuffer(list[cursor++]);}));
  }
  function scheduleNote(context,target,track,note,when,sourceList){
    const descriptor=descriptorFor(track.instrument,note.midi,'play'),buffer=sampleBuffers.get(descriptor.url);if(!buffer)return;
    const source=context.createBufferSource(),envelope=context.createGain();source.buffer=buffer;source.playbackRate.value=Math.pow(2,(note.midi-descriptor.midi)/12);
    const level=clamp(instruments[track.instrument].gain*.65,0,2),heldFor=clamp(note.duration,.015,MAX_SECONDS),releaseFor=note.sustain?Math.max(1.2,note.release):clamp(note.release,.01,10);
    envelope.gain.setValueAtTime(.00001,when);envelope.gain.linearRampToValueAtTime(level,when+.003);envelope.gain.setValueAtTime(level,when+heldFor);envelope.gain.exponentialRampToValueAtTime(.0001,when+heldFor+releaseFor);
    source.connect(envelope);envelope.connect(target);source.start(when);const natural=buffer.duration/source.playbackRate.value;source.stop(Math.min(when+natural,when+heldFor+releaseFor+.04));if(sourceList)sourceList.push(source);
  }
  function applyLiveMutes(){if(!engine)return;for(const item of playbackBuses)item.bus.gain.setTargetAtTime(isAudible(item.track)?1:0,engine.currentTime,.008);}
  function stopPlayback(){
    playing=false;clearTimeout(playbackEndTimer);playbackEndTimer=null;for(const source of playbackSources){try{source.stop();}catch(_){}}playbackSources=[];
    for(const item of playbackBuses){try{item.bus.disconnect();}catch(_){}}playbackBuses=[];updatePlayButton();
  }
  async function startPlayback(){
    if(recording)finishRecording();const selected=audibleTracks();if(!selected.length){say('再生する録音がありません。ミュート設定を確認してください。',true);return;}if(busy)return;
    busy=true;say('録音した楽器の音源を準備中…');
    try{
      await ensureEngine();await preload(selected);const startAt=engine.currentTime+.12;playing=true;playbackSources=[];playbackBuses=[];
      for(const track of selected){const bus=engine.createGain();bus.gain.value=isAudible(track)?1:0;bus.connect(engineMaster);playbackBuses.push({track,bus});for(const note of track.notes)scheduleNote(engine,bus,track,note,startAt+note.start,playbackSources);}
      const duration=Math.max(...selected.flatMap(track=>track.notes.map(note=>note.start+note.duration+(note.sustain?Math.max(1.2,note.release):note.release))))+.2;
      playbackEndTimer=setTimeout(()=>{stopPlayback();say('全トラックの再生が終わりました');},duration*1000);say('全トラック再生中 · '+selected.length+'トラック');updatePlayButton();
    }catch(error){stopPlayback();say('再生できませんでした：'+error.message,true);}finally{busy=false;if(!panel.hidden)renderPanel();}
  }

  function encodeWav(buffer){
    const length=buffer.length,bytes=44+length*4,data=new ArrayBuffer(bytes),view=new DataView(data);const write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
    write(0,'RIFF');view.setUint32(4,bytes-8,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,length*4,true);
    const left=buffer.getChannelData(0),right=buffer.getChannelData(Math.min(1,buffer.numberOfChannels-1));let offset=44;for(let i=0;i<length;i++)for(const value of [left[i],right[i]]){const sample=Math.max(-1,Math.min(1,value));view.setInt16(offset,sample<0?sample*32768:sample*32767,true);offset+=2;}
    return new Blob([data],{type:'audio/wav'});
  }
  function saveBlob(blob,extension){const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download='Piano-Palette-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+extension;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  async function encodeWithMediaRecorder(buffer,mimeType){
    if(!window.MediaRecorder?.isTypeSupported?.(mimeType))throw new Error('この端末は選択した保存形式に対応していません');const Audio=window.AudioContext||window.webkitAudioContext,audio=new Audio();
    try{await audio.resume();const destination=audio.createMediaStreamDestination(),source=audio.createBufferSource();source.buffer=buffer;source.connect(destination);const recorder=new MediaRecorder(destination.stream,{mimeType}),parts=[];
      const finished=new Promise((resolve,reject)=>{recorder.ondataavailable=event=>{if(event.data.size)parts.push(event.data);};recorder.onerror=event=>reject(event.error||new Error('音声変換に失敗しました'));recorder.onstop=()=>resolve(new Blob(parts,{type:recorder.mimeType||mimeType}));});
      recorder.start();source.start(audio.currentTime+.05);source.onended=()=>{if(recorder.state!=='inactive')recorder.stop();};return await finished;
    }finally{await audio.close();}
  }
  async function exportMix(format){
    const selected=audibleTracks();if(!selected.length||busy)return;busy=true;renderPanel();say('ミュートされていないトラックをミックス中…');
    try{
      await ensureEngine();await preload(selected);const duration=Math.max(...selected.flatMap(track=>track.notes.map(note=>note.start+note.duration+(note.sustain?Math.max(1.2,note.release):note.release))))+.2;
      const sampleRate=44100,Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw new Error('このブラウザでは音声書き出しを利用できません');
      const offline=new Offline(2,Math.ceil(duration*sampleRate),sampleRate),out=offline.createGain();out.gain.value=clamp(volumeControl.value,0,100)/100*.55;out.connect(offline.destination);
      for(const track of selected)for(const note of track.notes)scheduleNote(offline,out,track,note,.01+note.start,null);const rendered=await offline.startRendering();
      if(format==='wav')saveBlob(encodeWav(rendered),'wav');else if(format==='mp4')saveBlob(await encodeWithMediaRecorder(rendered,'audio/mp4'),'mp4');else saveBlob(await encodeWithMediaRecorder(rendered,'audio/webm;codecs=opus'),'webm');
      say(selected.length+'トラックを'+format.toUpperCase()+'で保存しました');
    }catch(error){say('保存できませんでした：'+error.message,true);}finally{busy=false;renderPanel();}
  }

  volumeControl.addEventListener('input',()=>{if(engineMaster&&engine)engineMaster.gain.setTargetAtTime(clamp(volumeControl.value,0,100)/100*.55,engine.currentTime,.01);});
  window.addEventListener('blur',()=>{if(recording)finishRecording();stopPlayback();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(recording)finishRecording();stopPlayback();}});
  renderPanel();updatePlayButton();
})();
