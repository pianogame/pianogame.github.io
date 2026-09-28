(() => {
  'use strict';
  function init() {
    if (document.getElementById('hp-opening-sequence')) return;

    const style=document.createElement('style');
    style.textContent=`
      body.hp-booting #hp-viewport{visibility:hidden!important}
      #hp-opening-sequence{position:fixed;inset:0;z-index:10000;overflow:hidden;font-family:"Times New Roman","Hiragino Mincho ProN","Yu Mincho",serif}
      #hp-opening-sequence[hidden]{display:none!important}
      .hp-opening-orientation,.hp-opening-title{position:absolute;inset:0;display:grid;place-items:center;box-sizing:border-box}
      .hp-opening-orientation{z-index:3;padding:28px;background:#fff;color:#29242c;text-align:center;opacity:1;transition:opacity .28s ease;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}
      .hp-opening-orientation.hp-ready{cursor:grab}
      .hp-opening-orientation.hp-gesture-active{cursor:grabbing}
      .hp-opening-orientation.hp-leave{opacity:0;pointer-events:none}
      .hp-opening-orientation-inner{position:relative;z-index:4;max-width:620px;transition:transform .36s ease,opacity .28s ease}
      .hp-opening-orientation.hp-ready .hp-opening-phone{animation:none;transform:rotate(90deg)}
      .hp-opening-orientation.hp-ready .hp-opening-orientation-inner{transform:scale(1.02)}
      .hp-ready-main{display:none}
      .hp-ready-wave{display:none}
      .hp-loading-main{display:none}
      .hp-opening-orientation.hp-loading .hp-turn-main{display:none}
      .hp-opening-orientation.hp-loading .hp-loading-main{display:block}
      .hp-opening-orientation.hp-ready .hp-turn-main,.hp-opening-orientation.hp-ready .hp-loading-main{display:none}
      .hp-opening-orientation.hp-ready .hp-ready-main{display:block}
      .hp-opening-orientation.hp-wave-armed .hp-ready-unlock{display:none}
      .hp-opening-orientation.hp-wave-armed .hp-ready-wave{display:block}
      .hp-ready-main em{display:block;margin-top:12px;font:600 13px system-ui,sans-serif;font-style:normal;letter-spacing:.12em;color:#a05a77}
      .hp-opening-orientation.hp-ripple-release .hp-opening-orientation-inner{opacity:0;transform:scale(1.045);transition:opacity .38s ease,transform .52s ease}
      .hp-ripple-fx{position:absolute;inset:0;z-index:10002;width:100%;height:100%;pointer-events:none}
      .hp-opening-phone{position:relative;width:74px;height:132px;margin:0 auto 25px;border:2px solid #4c4650;border-radius:15px;animation:hp-turn 2.2s cubic-bezier(.65,0,.25,1) infinite}
      .hp-opening-phone:after{content:"";position:absolute;left:50%;bottom:7px;width:7px;height:7px;border:1px solid #77717b;border-radius:50%;transform:translateX(-50%)}
      .hp-opening-orientation strong{display:block;font-size:clamp(21px,5vw,31px);font-weight:500;letter-spacing:.08em}
      .hp-opening-orientation span{display:block;margin-top:13px;color:#77717b;font-family:system-ui,sans-serif;font-size:14px;line-height:1.8}
      .hp-opening-title{z-index:10001;background:#120713;color:#fff;opacity:0;pointer-events:none;transition:opacity 1s ease}
      .hp-opening-title.hp-show{opacity:1;pointer-events:auto;cursor:pointer}
      .hp-opening-title:before,.hp-opening-title:after{content:"";position:absolute;top:0;bottom:0;width:50%;background:repeating-linear-gradient(90deg,#3b0d29 0%,#711d4b 7%,#4b102f 14%,#8a285c 21%,#45102d 28%);box-shadow:inset -28px 0 38px #14040db8,inset 16px 0 26px #c66b9a25,0 0 24px #050105aa;transition:transform 1.5s cubic-bezier(.7,0,.2,1)}
      .hp-opening-title:before{left:0;transform-origin:left;border-right:4px solid #c8a35b}
      .hp-opening-title:after{right:0;transform-origin:right;border-left:4px solid #c8a35b}
      .hp-opening-title.hp-curtain-open:before{transform:translateX(-97%)}
      .hp-opening-title.hp-curtain-open:after{transform:translateX(97%)}
      .hp-opening-logo{position:relative;z-index:1;padding:24px;text-align:center;opacity:0;transform:translateY(8px);transition:opacity 1.1s ease .25s,transform 1.1s ease .25s}
      .hp-opening-title.hp-show .hp-opening-logo{opacity:1;transform:none}
      .hp-opening-en{position:relative;display:block;font-size:clamp(29px,7vw,68px);font-weight:400;letter-spacing:.12em;background:linear-gradient(100deg,#d9b86d,#fff6d0 42%,#d2a553 57%,#f8e7b3);background-size:220% auto;-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 8px #0008);animation:hp-gold-sweep 2.8s ease-in-out infinite}
      .hp-opening-jp{display:block;margin-top:10px;color:#e9d7bd;font-size:clamp(12px,2.4vw,20px);letter-spacing:.32em}
      .hp-opening-spark{position:absolute;z-index:2;width:5px;height:5px;border-radius:50%;background:#fff5ca;box-shadow:0 0 12px #ffe39a;opacity:0;animation:hp-spark 2.4s ease-in-out infinite}
      .hp-opening-spark.s1{left:24%;top:38%}.hp-opening-spark.s2{right:22%;top:55%;animation-delay:.7s}.hp-opening-spark.s3{left:55%;top:27%;animation-delay:1.3s}
      @keyframes hp-turn{0%,22%{transform:rotate(0deg)}58%,90%{transform:rotate(90deg)}100%{transform:rotate(0deg)}}
      @keyframes hp-gold-sweep{0%,20%{background-position:100% center}70%,100%{background-position:-100% center}}
      @keyframes hp-spark{0%,100%{opacity:0;transform:scale(.3)}45%{opacity:1;transform:scale(1.5)}}
      .hp-opening-tap{display:block;margin-top:22px;font:600 14px system-ui,sans-serif;letter-spacing:.18em;color:#f5e6c8;animation:hp-tap-pulse 1.45s ease-in-out infinite;filter:drop-shadow(0 0 7px #ffe0a566)}
      @keyframes hp-tap-pulse{0%,100%{opacity:.45;transform:translateY(0) scale(.98)}50%{opacity:1;transform:translateY(-2px) scale(1.04)}}
      @media(prefers-reduced-motion:reduce){.hp-opening-phone,.hp-opening-en,.hp-opening-spark{animation:none}.hp-opening-orientation,.hp-opening-title,.hp-opening-logo,.hp-opening-title:before,.hp-opening-title:after{transition-duration:.01ms}}
    `;
    document.head.append(style);

    const opening=document.createElement('div');
    opening.id='hp-opening-sequence';
    opening.innerHTML=`
      <section class="hp-opening-orientation" aria-label="横画面のご案内">
        <div class="hp-opening-orientation-inner">
          <div class="hp-opening-phone" aria-hidden="true"></div>
          <div class="hp-turn-main"><strong>横向きにしてお楽しみください</strong><span>端末を横向きにしてください。</span></div>
          <div class="hp-loading-main"><strong>音源を準備中…</strong><span>このまま少しだけお待ちください。</span></div>
          <div class="hp-ready-main">
            <div class="hp-ready-unlock"><strong>準備完了まであと少し</strong><span>画面をタップして、音の波紋を起こしてください。</span><em>TAP TO RIPPLE</em></div>
            <div class="hp-ready-wave"><strong>準備完了にしよう</strong><span>波紋が出たら、好きな方向へスワイプしてください。</span><em>SWIPE TO START</em></div>
          </div>
        </div>
      </section>
      <canvas class="hp-ripple-fx" aria-hidden="true"></canvas>
      </section>
      <section class="hp-opening-title" aria-label="ピアノドリームステージ">
        <i class="hp-opening-spark s1"></i><i class="hp-opening-spark s2"></i><i class="hp-opening-spark s3"></i>
        <div class="hp-opening-logo"><span class="hp-opening-en">Piano Dream Stage</span><span class="hp-opening-jp">ピアノドリームステージ</span><span class="hp-opening-tap">Tap Curtain Start</span></div>
      </section>`;
    document.body.append(opening);

    const orientation=opening.querySelector('.hp-opening-orientation');
    const title=opening.querySelector('.hp-opening-title');
    const rippleCanvas=opening.querySelector('.hp-ripple-fx');
    const rippleCtx=rippleCanvas.getContext('2d');
    let started=false,prepared=false,opened=false,bgmPlaying=false,audioReady=false,audioLoadFailed=false,audioUnlocked=false,lastAudioError='';
    const tapAudios=['/audio/curtain-start-1.mp3?v=10','/audio/curtain-start-2.mp3?v=10','/audio/curtain-start-3.mp3?v=10','/audio/curtain-start-4.mp3?v=10'].map(url=>{
      const audio=new Audio(url);audio.preload='auto';audio.volume=.9;audio.load();return audio;
    });
    const bgmUrls=['/audio/opening-bgm-01.m4a?v=10','/audio/opening-bgm-02.m4a?v=10','/audio/opening-bgm-03.m4a?v=10','/audio/opening-bgm-04.m4a?v=10','/audio/opening-bgm-05.m4a?v=10','/audio/opening-bgm-06.m4a?v=10','/audio/opening-bgm-07.m4a?v=10','/audio/opening-bgm-08.m4a?v=10','/audio/opening-bgm-09.m4a?v=10','/audio/opening-bgm-10.m4a?v=10'];
    const selectedBgm=bgmUrls[Math.floor(Math.random()*bgmUrls.length)];
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    const openingAudioContext=AudioContextClass?new AudioContextClass():null;
    let bgmBuffer=null,voiceBuffer=null,tapSeBuffer=null,swipeSeBuffer=null,bgmSource=null,voiceSource=null,bgmGain=null;

    async function decodeAudio(url){
      if(!openingAudioContext)return null;
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)throw new Error('audio '+response.status);
      return openingAudioContext.decodeAudioData(await response.arrayBuffer());
    }

    const openingAudioReady=openingAudioContext
      ? Promise.all([
          decodeAudio(selectedBgm).then(buffer=>{bgmBuffer=buffer;}),
          decodeAudio('/audio/opening-3voices.m4a?v=13').then(buffer=>{voiceBuffer=buffer;}),
          decodeAudio('/audio/kiryan.m4a?v=1').then(buffer=>{tapSeBuffer=buffer;}),
          decodeAudio('/audio/pororoponponpin.m4a?v=1').then(buffer=>{swipeSeBuffer=buffer;})
        ]).then(()=>{
          audioReady=!!(bgmBuffer&&voiceBuffer&&tapSeBuffer&&swipeSeBuffer);
          maybeArmPreparation();
        }).catch(error=>{
          audioLoadFailed=true;
          lastAudioError='load:'+(error?.name||'failed');
          maybeArmPreparation();
        })
      : Promise.resolve();

    function playOpeningCue(buffer,level){
      if(!openingAudioContext||openingAudioContext.state!=='running'||!buffer)return;
      try{
        const source=openingAudioContext.createBufferSource();
        const gain=openingAudioContext.createGain();
        gain.gain.setValueAtTime(level,openingAudioContext.currentTime);
        source.buffer=buffer;
        source.connect(gain);
        gain.connect(openingAudioContext.destination);
        source.start();
        source.onended=()=>{try{source.disconnect();gain.disconnect();}catch(_){}};
      }catch(_){}
    }

    function playTapPianoCue(){
      playOpeningCue(tapSeBuffer,.9);
    }

    function playSwipePianoCue(){
      playOpeningCue(swipeSeBuffer,.78);
    }

    async function unlockOpeningAudio(){
      if(audioUnlocked||!openingAudioContext||!audioReady)return false;
      try{
        await openingAudioContext.resume();
        if(openingAudioContext.state!=='running')return false;

        // Force WebKit to establish an audible-capable AudioSession during the real tap.
        const gain=openingAudioContext.createGain();
        gain.gain.setValueAtTime(0,openingAudioContext.currentTime);
        gain.connect(openingAudioContext.destination);
        const source=openingAudioContext.createBufferSource();
        source.buffer=openingAudioContext.createBuffer(1,1,openingAudioContext.sampleRate);
        source.connect(gain);
        source.start();
        source.stop(openingAudioContext.currentTime+.02);
        source.onended=()=>{try{source.disconnect();gain.disconnect();}catch(_){}};

        audioUnlocked=true;
        lastAudioError='';
        playTapPianoCue();
        return true;
      }catch(error){
        lastAudioError='unlock:'+(error?.name||'failed');
        return false;
      }
    }

    function beginAudibleOpening(){
      if(opened||!audioUnlocked||!audioReady||!openingAudioContext||!bgmBuffer||!voiceBuffer)return false;
      try{
        const now=openingAudioContext.currentTime;

        bgmGain=openingAudioContext.createGain();
        bgmGain.gain.setValueAtTime(.18,now);
        bgmGain.connect(openingAudioContext.destination);

        bgmSource=openingAudioContext.createBufferSource();
        bgmSource.buffer=bgmBuffer;
        bgmSource.loop=true;
        bgmSource.connect(bgmGain);
        bgmSource.start(now);

        voiceSource=openingAudioContext.createBufferSource();
        voiceSource.buffer=voiceBuffer;
        voiceSource.connect(openingAudioContext.destination);
        voiceSource.start(now+1.5);

        bgmPlaying=true;
        lastAudioError='';
        return true;
      }catch(error){
        lastAudioError='audible:'+(error?.name||'failed');
        return false;
      }
    }

    function cancelPreparationAudio(){
      // Audio stays unlocked after the playful ripple tap.
    }

    function stopOpeningVoice(){
      try{voiceSource?.stop();}catch(_){}
      try{voiceSource?.disconnect();}catch(_){}
      voiceSource=null;
    }

    function stopCurtainBgm(){
      try{bgmSource?.stop();}catch(_){}
      try{bgmSource?.disconnect();}catch(_){}
      try{bgmGain?.disconnect();}catch(_){}
      bgmSource=null;
      bgmGain=null;
      bgmPlaying=false;
    }

    function fadeOutCurtainBgm(duration=.78){
      stopOpeningVoice();
      if(!bgmPlaying||!bgmGain||!openingAudioContext){stopCurtainBgm();return;}
      try{
        const now=openingAudioContext.currentTime;
        const gain=bgmGain.gain;
        const start=Math.max(.0001,gain.value||.18);
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(start,now);
        gain.setValueCurveAtTime(
          new Float32Array([start,start*.42,start*.16,start*.055,start*.012,.0001]),
          now,
          duration
        );
        setTimeout(stopCurtainBgm,Math.ceil(duration*1000)+50);
      }catch(_){stopCurtainBgm();}
    }

    function chime(){
      const audio=tapAudios[Math.floor(Math.random()*tapAudios.length)];
      try{audio.currentTime=0;const p=audio.play();p?.catch(()=>{});}catch(_){}
    }

    let rippleAnimationFrame=0;
    const rippleParticles=Array.from({length:34},(_,i)=>({
      angle:(Math.PI*2*i/34)+(((i*37)%17)-8)*.006,
      base:55+((i*29)%74),
      travel:250+((i*43)%145),
      yScale:.48+((i*11)%18)/100,
      size:2+(i%3),
      phase:(((i*19)%15)-7)*.008
    }));

    let rippleWidth=1,rippleHeight=1;
    function sizeRippleCanvas(){
      const rect=opening.getBoundingClientRect();
      const viewport=window.visualViewport;
      const width=Math.max(1,Math.round(rect.width||viewport?.width||document.documentElement.clientWidth||innerWidth));
      const height=Math.max(1,Math.round(rect.height||viewport?.height||document.documentElement.clientHeight||innerHeight));
      const ratio=Math.min(2,window.devicePixelRatio||1);
      rippleWidth=width;
      rippleHeight=height;
      rippleCanvas.style.width='100%';
      rippleCanvas.style.height='100%';
      const pixelWidth=Math.max(1,Math.round(width*ratio));
      const pixelHeight=Math.max(1,Math.round(height*ratio));
      if(rippleCanvas.width!==pixelWidth||rippleCanvas.height!==pixelHeight){
        rippleCanvas.width=pixelWidth;
        rippleCanvas.height=pixelHeight;
      }
      rippleCtx.setTransform(ratio,0,0,ratio,0,0);
    }
    sizeRippleCanvas();
    const rippleResizeObserver=window.ResizeObserver?new ResizeObserver(sizeRippleCanvas):null;
    rippleResizeObserver?.observe(opening);
    window.addEventListener('resize',sizeRippleCanvas);
    window.visualViewport?.addEventListener('resize',sizeRippleCanvas);
    window.addEventListener('pageshow',sizeRippleCanvas);
    requestAnimationFrame(()=>requestAnimationFrame(sizeRippleCanvas));
    setTimeout(sizeRippleCanvas,120);
    setTimeout(sizeRippleCanvas,360);

    const clamp01=value=>Math.max(0,Math.min(1,value));
    const easeOut=value=>1-Math.pow(1-clamp01(value),3);
    const smooth=value=>{value=clamp01(value);return value*value*(3-2*value);};

    function clearRippleFx(){
      if(rippleAnimationFrame){cancelAnimationFrame(rippleAnimationFrame);rippleAnimationFrame=0;}
      rippleCtx.clearRect(0,0,rippleWidth,rippleHeight);
    }

    function drawStaff(ctx,cx,cy,progress,alpha=1){
      const width=Math.min(rippleWidth*.42,520)*progress;
      ctx.save();
      ctx.strokeStyle='rgba(215,177,101,'+(0.72*alpha)+')';
      ctx.lineWidth=1.4;
      for(let i=0;i<5;i++){
        const y=cy-32+i*16;
        ctx.beginPath();ctx.moveTo(cx-width,y);ctx.lineTo(cx+width,y);ctx.stroke();
      }
      ctx.restore();
    }

    function drawNote(ctx,text,x,y,alpha,size=18){
      ctx.save();
      ctx.globalAlpha=alpha;
      ctx.fillStyle='#c08b4f';
      ctx.font='600 '+size+'px system-ui,sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillText(text,x,y);
      ctx.restore();
    }

    function playUnlockRipple(){
      sizeRippleCanvas();
      clearRippleFx();
      const cx=rippleWidth/2;
      const cy=rippleHeight/2;
      const startedAt=performance.now();
      const notes=['♪','♫','♩','♬','♪','♩'];
      const frame=now=>{
        const elapsed=now-startedAt;
        rippleCtx.clearRect(0,0,rippleWidth,rippleHeight);

        // Keep the first ripple visible for a short beat, then fade the entire
        // effect smoothly instead of clearing it abruptly.
        const unlockFade=1-smooth((elapsed-760)/620);
        rippleCtx.save();
        rippleCtx.globalAlpha=unlockFade;

        const staff=easeOut(elapsed/620);
        drawStaff(rippleCtx,cx,cy,staff,1);

        // Soft center glow that fades with the same curve.
        const glowProgress=clamp01(elapsed/520);
        const glowRadius=24+88*easeOut(glowProgress);
        const gradient=rippleCtx.createRadialGradient(cx,cy,0,cx,cy,glowRadius);
        gradient.addColorStop(0,'rgba(255,247,214,.72)');
        gradient.addColorStop(.35,'rgba(244,211,139,.30)');
        gradient.addColorStop(1,'rgba(244,211,139,0)');
        rippleCtx.fillStyle=gradient;
        rippleCtx.beginPath();rippleCtx.arc(cx,cy,glowRadius,0,Math.PI*2);rippleCtx.fill();

        for(let i=0;i<4;i++){
          const p=(elapsed-i*95)/820;
          if(p<=0||p>=1)continue;
          const radius=18+Math.min(rippleWidth,rippleHeight)*.30*easeOut(p);
          rippleCtx.save();
          rippleCtx.globalAlpha=(1-p)*.82;
          rippleCtx.strokeStyle='#e1b96e';
          rippleCtx.lineWidth=Math.max(.7,3.6*(1-p));
          rippleCtx.beginPath();rippleCtx.arc(cx,cy,radius,0,Math.PI*2);rippleCtx.stroke();
          rippleCtx.restore();
        }

        const orbit=clamp01(elapsed/760);
        notes.forEach((note,i)=>{
          const angle=(Math.PI*2*i/notes.length)+orbit*.85;
          const radius=62+orbit*92;
          drawNote(rippleCtx,note,cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius*.56,orbit,17);
        });

        rippleCtx.restore();

        if(elapsed<1400)rippleAnimationFrame=requestAnimationFrame(frame);
        else{
          rippleAnimationFrame=0;
          rippleCtx.clearRect(0,0,rippleWidth,rippleHeight);
        }
      };
      rippleAnimationFrame=requestAnimationFrame(frame);
    }

    function playReleaseRipple(){
      sizeRippleCanvas();
      clearRippleFx();
      const cx=rippleWidth/2;
      const cy=rippleHeight/2;
      const startedAt=performance.now();
      const notes=['♪','♫','♩','♬','♪','♩'];
      const frame=now=>{
        const elapsed=now-startedAt;
        rippleCtx.clearRect(0,0,rippleWidth,rippleHeight);

        const staffProgress=easeOut(elapsed/520);
        const staffFade=1-smooth((elapsed-650)/520);
        drawStaff(rippleCtx,cx,cy,staffProgress,staffFade);

        for(let i=0;i<5;i++){
          const p=(elapsed-i*90)/880;
          if(p<=0||p>=1)continue;
          const radius=22+Math.min(rippleWidth,rippleHeight)*.46*easeOut(p);
          rippleCtx.save();
          rippleCtx.globalAlpha=(1-p)*.78;
          rippleCtx.strokeStyle='#e7bf73';
          rippleCtx.lineWidth=Math.max(.6,4.2*(1-p));
          rippleCtx.beginPath();rippleCtx.arc(cx,cy,radius,0,Math.PI*2);rippleCtx.stroke();
          rippleCtx.restore();
        }

        const orbit=clamp01(elapsed/720);
        const noteFade=1-smooth((elapsed-700)/500);
        notes.forEach((note,i)=>{
          const angle=(Math.PI*2*i/notes.length)+orbit*1.2;
          const radius=82+orbit*130;
          drawNote(rippleCtx,note,cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius*.56,orbit*noteFade,18);
        });

        // Golden dots move outward and fade continuously to zero.
        let particleAlpha=0;
        let motion=0;
        if(elapsed<500){
          motion=smooth(elapsed/500);
          particleAlpha=smooth(elapsed/220);
        }else if(elapsed<1500){
          motion=1+((elapsed-500)/1000)*.58;
          particleAlpha=1-smooth((elapsed-500)/1000)*.92;
        }else if(elapsed<1950){
          motion=1.58+((elapsed-1500)/450)*.18;
          particleAlpha=.08*(1-smooth((elapsed-1500)/450));
        }
        if(particleAlpha>0){
          rippleParticles.forEach((particle,i)=>{
            const m=Math.max(0,motion+particle.phase);
            const distance=particle.base+particle.travel*m;
            const x=cx+Math.cos(particle.angle)*distance;
            const y=cy+Math.sin(particle.angle)*distance*particle.yScale;
            const alpha=Math.max(0,particleAlpha*(1-.1*(i%4)));
            rippleCtx.save();
            rippleCtx.globalAlpha=alpha*.18;
            rippleCtx.fillStyle='#ffe7a4';
            rippleCtx.beginPath();rippleCtx.arc(x,y,particle.size*3,0,Math.PI*2);rippleCtx.fill();
            rippleCtx.globalAlpha=alpha;
            rippleCtx.fillStyle='#ffe8a5';
            rippleCtx.beginPath();rippleCtx.arc(x,y,particle.size,0,Math.PI*2);rippleCtx.fill();
            rippleCtx.restore();
          });
        }

        if(elapsed<1980)rippleAnimationFrame=requestAnimationFrame(frame);
        else{
          rippleAnimationFrame=0;
          rippleCtx.clearRect(0,0,rippleWidth,rippleHeight);
        }
      };
      rippleAnimationFrame=requestAnimationFrame(frame);
    }

    const landscape=()=>{
      const v=window.visualViewport;
      return (v?.width||innerWidth) >= (v?.height||innerHeight);
    };

    orientation.addEventListener('click',async event=>{
      if(!started||prepared||audioUnlocked||!event.isTrusted)return;
      const unlocked=await unlockOpeningAudio();
      if(unlocked){
        orientation.classList.add('hp-wave-armed');
        playUnlockRipple();
      }
    });

    let gesturePointerId=null,gestureStartX=0,gestureStartY=0,landscapeReached=false;
    function maybeArmPreparation(){
      if(started||!landscapeReached)return;
      orientation.classList.add('hp-loading');
      if(audioLoadFailed)return;
      if(!audioReady)return;
      started=true;
      orientation.classList.remove('hp-loading');
      orientation.classList.add('hp-ready');
    }
    function armPreparation(){
      if(!landscape())return;
      landscapeReached=true;
      maybeArmPreparation();
    }
    function finishPreparation(event){
      if(prepared||!started||!audioUnlocked||!event.isTrusted)return false;
      const dx=event.clientX-gestureStartX,dy=event.clientY-gestureStartY;
      const distance=Math.hypot(dx,dy);
      if(distance<72)return false;

      if(!beginAudibleOpening())return false;
      playSwipePianoCue();
      prepared=true;
      orientation.classList.remove('hp-gesture-active');
      orientation.classList.add('hp-ripple-release');
      playReleaseRipple();
      setTimeout(()=>{
        orientation.hidden=true;
        title.classList.add('hp-show');
      },520);
      return true;
    }
    orientation.addEventListener('pointerdown',event=>{
      if(!started||prepared||!audioUnlocked)return;
      gesturePointerId=event.pointerId;
      gestureStartX=event.clientX;
      gestureStartY=event.clientY;
      orientation.classList.add('hp-gesture-active');
      try{orientation.setPointerCapture(event.pointerId);}catch(_){}
      event.preventDefault();
    });
    orientation.addEventListener('pointermove',event=>{
      if(prepared||event.pointerId!==gesturePointerId)return;
      if(finishPreparation(event)){
        gesturePointerId=null;
        event.preventDefault();
      }
    });
    orientation.addEventListener('pointerup',event=>{
      if(event.pointerId!==gesturePointerId||prepared)return;
      cancelPreparationAudio();
      gesturePointerId=null;
      orientation.classList.remove('hp-gesture-active');
      event.preventDefault();
    });
    orientation.addEventListener('pointercancel',()=>{
      if(!prepared)cancelPreparationAudio();
      gesturePointerId=null;
      orientation.classList.remove('hp-gesture-active');
    });

    let suspendedByVisibility=false;
    async function suspendOpeningForBackground(){
      if(!openingAudioContext||openingAudioContext.state!=='running')return;
      try{
        await openingAudioContext.suspend();
        suspendedByVisibility=true;
      }catch(error){
        lastAudioError='suspend:'+(error?.name||'failed');
      }
    }
    async function resumeOpeningFromBackground(){
      if(!suspendedByVisibility||!openingAudioContext||opened)return;
      try{
        await openingAudioContext.resume();
        suspendedByVisibility=false;
      }catch(error){
        lastAudioError='resume-visible:'+(error?.name||'failed');
      }
    }
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden'){
        void suspendOpeningForBackground();
      }else if(document.visibilityState==='visible'){
        void resumeOpeningFromBackground();
      }
    });
    window.addEventListener('pagehide',()=>{void suspendOpeningForBackground();});
    window.addEventListener('pageshow',()=>{
      if(document.visibilityState!=='hidden')void resumeOpeningFromBackground();
    });

    title.addEventListener('pointerup',()=>{
      if(opened||!prepared)return;
      opened=true;
      fadeOutCurtainBgm(.78);
      chime();
      window.dispatchEvent(new Event('hp-curtain-start'));
      title.classList.add('hp-curtain-open');
      setTimeout(()=>{document.body.classList.remove('hp-booting');opening.style.transition='opacity .65s ease';opening.style.opacity='0';},1250);
      setTimeout(()=>{rippleResizeObserver?.disconnect();opening.remove();},1950);
    },{once:true});

    window.addEventListener('resize',armPreparation);
    window.addEventListener('orientationchange',armPreparation);
    window.visualViewport?.addEventListener('resize',armPreparation);
    armPreparation();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();