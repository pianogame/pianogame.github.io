(() => {
  'use strict';
  const root=document.getElementById('hp-four88');
  const keyPrefs=window.HP_KEY_PREFS;
  function updateKeySizes(){
    root.style.setProperty('--hp-key-edge',keyPrefs.edge+'px');
    root.querySelectorAll('[data-key-size]').forEach(input=>{const name=input.dataset.keySize;input.value=keyPrefs[name];root.querySelector('[data-size-output="'+name+'"]').textContent=keyPrefs[name]+(name==='edge'?'px':'%');});
    try{localStorage.setItem('hp-key-sizes',JSON.stringify(keyPrefs));}catch(_){}
    window.dispatchEvent(new Event('hp-viewport-resize'));
  }
  root.querySelectorAll('[data-key-size]').forEach(input=>input.addEventListener('input',()=>{keyPrefs[input.dataset.keySize]=Number(input.value);updateKeySizes();}));
  root.querySelector('[data-action="key-size-reset"]').addEventListener('click',()=>{Object.assign(keyPrefs,{white:100,black:100,edge:8});updateKeySizes();root.querySelectorAll('[data-key-size]').forEach(input=>input.dispatchEvent(new Event('change')));});
  updateKeySizes();
  // Native range hit testing can disagree with a CSS-rotated viewport on iOS.
  // Map a captured pointer onto the visible track; keyboard input stays native.
  root.querySelectorAll('input[type="range"]').forEach(input=>{
    const row=document.createElement('div');row.className='hp-range-row';
    input.before(row);row.append(input);
    let pointer=null,rect=null,rotated=false;
    const emit=type=>input.dispatchEvent(new Event(type,{bubbles:true}));
    const paint=()=>input.style.setProperty('--range-progress',100*(Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))+'%');
    const update=event=>{
      const length=rotated?rect.height:rect.width;
      const position=rotated?event.clientY-rect.top:event.clientX-rect.left;
      const ratio=Math.max(0,Math.min(1,(position-16)/Math.max(1,length-32)));
      const min=Number(input.min),max=Number(input.max),step=Number(input.step)||1;
      input.value=String(Number(Math.min(max,Math.max(min,min+Math.round((ratio*(max-min))/step)*step)).toFixed(6)));
      emit('input');paint();
    };
    input.addEventListener('pointerdown',event=>{
      if(input.disabled||pointer!==null||(event.pointerType==='mouse'&&event.button!==0))return;
      event.preventDefault();event.stopPropagation();
      pointer=event.pointerId;rect=input.getBoundingClientRect();rotated=document.documentElement.dataset.hpRotated==='true';
      input.focus({preventScroll:true});
      try{row.setPointerCapture(pointer);}catch(_){}
      update(event);
    },{passive:false});
    row.addEventListener('pointermove',event=>{if(event.pointerId!==pointer)return;event.preventDefault();update(event);},{passive:false});
    const finish=event=>{
      if(event.pointerId!==pointer)return;
      if(event.type==='pointerup')update(event);
      pointer=null;emit('change');
    };
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>row.addEventListener(type,finish));
    for(const [symbol,direction] of [['−',-1],['＋',1]]){
      const button=document.createElement('button');button.type='button';button.className='hp-range-step';button.textContent=symbol;
      button.setAttribute('aria-label',(input.getAttribute('aria-label')||'値')+(direction<0?'を下げる':'を上げる'));
      button.addEventListener('click',event=>{event.preventDefault();if(input.disabled)return;direction<0?input.stepDown():input.stepUp();emit('input');emit('change');paint();});
      direction<0?row.prepend(button):row.append(button);
    }
    input.addEventListener('input',paint);input.addEventListener('change',paint);paint();
  });
  const wide=root.querySelector('[data-control="wide"]'),wallpaper=root.querySelector('[data-control="wallpaper"]');
  const file=root.querySelector('[data-control="photo"]'),message=root.querySelector('[data-output="photo-status"]');
  let photo='',generation=0;
  try {wide.checked=localStorage.getItem('hp-wide')!=='false';photo=localStorage.getItem('hp-wallpaper-photo')||'';wallpaper.value=localStorage.getItem('hp-wallpaper')||'default';}catch(_){}
  const save=(key,value)=>{try{localStorage.setItem(key,value);return true;}catch(_){return false;}};
  function applyWidth(){document.documentElement.dataset.hpWide=String(wide.checked);save('hp-wide',String(wide.checked));window.dispatchEvent(new Event('hp-viewport-resize'));}
  function applyWallpaper(){
    const value=wallpaper.value;
    root.dataset.wallpaper=value;
    root.style.setProperty('--hp-wallpaper',value==='photo'&&photo?'url('+JSON.stringify(photo)+')':'none');
    save('hp-wallpaper',value);
    if(value==='photo'&&!photo)message.textContent='「写真を選ぶ」から壁紙を選んでください。';
  }
  wide.addEventListener('change',applyWidth);wallpaper.addEventListener('change',()=>{generation++;applyWallpaper();});
  file.addEventListener('change',async()=>{
    const selected=file.files?.[0];if(!selected)return;
    const ticket=++generation;
    if(selected.size>25*1024*1024){message.textContent='25MB以下の写真を選んでください。';file.value='';return;}
    message.textContent='写真を準備しています…';
    const url=URL.createObjectURL(selected);
    try{
      const img=new Image();img.src=url;await img.decode();if(ticket!==generation)return;
      const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const context=canvas.getContext('2d');context.drawImage(img,0,0,canvas.width,canvas.height);
      photo=canvas.toDataURL('image/jpeg',.82);wallpaper.value='photo';applyWallpaper();
      message.textContent=save('hp-wallpaper-photo',photo)?'壁紙を保存しました。この端末のブラウザ内だけで使います。':'壁紙を表示しました。保存容量が足りないため、次回は選び直してください。';
    }catch(_){if(ticket===generation)message.textContent='写真を読み込めませんでした。JPEGかPNGで選び直してください。';}
    finally{URL.revokeObjectURL(url);file.value='';}
  });
  root.querySelector('[data-action="photo-remove"]').addEventListener('click',()=>{
    generation++;photo='';try{localStorage.removeItem('hp-wallpaper-photo');}catch(_){}
    wallpaper.value='default';applyWallpaper();message.textContent='保存した写真を削除しました。';
  });
  applyWidth();applyWallpaper();
})();
