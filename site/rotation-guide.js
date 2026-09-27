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
      .hp-loading-main{display:none}
      .hp-opening-orientation.hp-loading .hp-turn-main{display:none}
      .hp-opening-orientation.hp-loading .hp-loading-main{display:block}
      .hp-opening-orientation.hp-ready .hp-turn-main,.hp-opening-orientation.hp-ready .hp-loading-main{display:none}
      .hp-opening-orientation.hp-ready .hp-ready-main{display:block}
      .hp-ready-main em{display:block;margin-top:12px;font:600 13px system-ui,sans-serif;font-style:normal;letter-spacing:.12em;color:#a05a77}
      .hp-shards{position:absolute;inset:-4%;z-index:3;pointer-events:none}
      .hp-shard{position:absolute;background:#fff;box-shadow:0 0 0 1px #eadfe5;opacity:0}
      .hp-opening-orientation.hp-shatter .hp-opening-orientation-inner{opacity:0;transform:scale(1.09)}
      .hp-opening-orientation.hp-shatter .hp-shard{opacity:1;animation:hp-shard-fly .72s cubic-bezier(.3,.75,.2,1) forwards}
      .hp-shard:nth-child(1){left:-2%;top:-2%;width:35%;height:37%;clip-path:polygon(0 0,100% 0,78% 100%,15% 78%);--tx:-28vw;--ty:-22vh;--rot:-18deg}
      .hp-shard:nth-child(2){left:27%;top:-3%;width:28%;height:42%;clip-path:polygon(10% 0,100% 0,82% 83%,0 100%);--tx:-8vw;--ty:-28vh;--rot:12deg;animation-delay:.03s}
      .hp-shard:nth-child(3){left:51%;top:-2%;width:28%;height:38%;clip-path:polygon(0 0,100% 0,88% 100%,18% 82%);--tx:12vw;--ty:-26vh;--rot:-10deg;animation-delay:.05s}
      .hp-shard:nth-child(4){right:-3%;top:-2%;width:28%;height:44%;clip-path:polygon(0 0,100% 0,100% 80%,12% 100%);--tx:30vw;--ty:-20vh;--rot:20deg;animation-delay:.02s}
      .hp-shard:nth-child(5){left:-3%;top:30%;width:31%;height:39%;clip-path:polygon(0 10%,92% 0,100% 100%,18% 82%);--tx:-32vw;--ty:-2vh;--rot:15deg;animation-delay:.04s}
      .hp-shard:nth-child(6){left:23%;top:32%;width:30%;height:38%;clip-path:polygon(8% 0,100% 8%,82% 100%,0 84%);--tx:-14vw;--ty:8vh;--rot:-16deg;animation-delay:.07s}
      .hp-shard:nth-child(7){left:49%;top:29%;width:29%;height:41%;clip-path:polygon(0 8%,92% 0,100% 82%,18% 100%);--tx:14vw;--ty:7vh;--rot:18deg;animation-delay:.05s}
      .hp-shard:nth-child(8){right:-2%;top:30%;width:28%;height:40%;clip-path:polygon(0 0,100% 15%,84% 100%,8% 86%);--tx:33vw;--ty:2vh;--rot:-14deg;animation-delay:.08s}
      .hp-shard:nth-child(9){left:-2%;bottom:-2%;width:34%;height:36%;clip-path:polygon(0 0,88% 14%,100% 100%,0 100%);--tx:-26vw;--ty:26vh;--rot:-20deg;animation-delay:.06s}
      .hp-shard:nth-child(10){left:28%;bottom:-2%;width:28%;height:36%;clip-path:polygon(0 12%,100% 0,84% 100%,10% 100%);--tx:-7vw;--ty:29vh;--rot:15deg;animation-delay:.09s}
      .hp-shard:nth-child(11){left:52%;bottom:-2%;width:27%;height:38%;clip-path:polygon(12% 0,100% 14%,100% 100%,0 100%);--tx:10vw;--ty:28vh;--rot:-17deg;animation-delay:.08s}
      .hp-shard:nth-child(12){right:-3%;bottom:-2%;width:27%;height:38%;clip-path:polygon(0 12%,100% 0,100% 100%,14% 100%);--tx:30vw;--ty:25vh;--rot:21deg;animation-delay:.1s}
      @keyframes hp-shard-fly{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--tx),var(--ty)) rotate(var(--rot));opacity:0}}
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
          <div class="hp-ready-main"><strong>準備完了にしよう</strong><span>画面を長押しするか、好きな方向へスワイプしてください。</span><em>LONG PRESS / SWIPE</em></div>
        </div>
        <div class="hp-shards" aria-hidden="true"><i class="hp-shard"></i><i class="hp-shard"></i><i class="hp-shard"></i><i class="hp-shard"></i><i class="hp-shard"></i><i class="hp-shard"></i><i class="hp-shard"></i><i class="hp-shard"></i><i class="hp-shard"></i><i class="hp-shard"></i><i class="hp-shard"></i><i class="hp-shard"></i></div>
      </section>
      <section class="hp-opening-title" aria-label="ピアノドリームステージ">
        <i class="hp-opening-spark s1"></i><i class="hp-opening-spark s2"></i><i class="hp-opening-spark s3"></i>
        <div class="hp-opening-logo"><span class="hp-opening-en">Piano Dream Stage</span><span class="hp-opening-jp">ピアノドリームステージ</span><span class="hp-opening-tap">Tap Curtain Start</span></div>
      </section>`;
    document.body.append(opening);

    const orientation=opening.querySelector('.hp-opening-orientation');
    const title=opening.querySelector('.hp-opening-title');
    let started=false,prepared=false,opened=false,bgmPlaying=false,voiceTimer=0,lastAudioError='';
    const tapAudios=['/audio/curtain-start-1.mp3?v=5','/audio/curtain-start-2.mp3?v=5','/audio/curtain-start-3.mp3?v=5','/audio/curtain-start-4.mp3?v=5'].map(url=>{
      const audio=new Audio(url);audio.preload='auto';audio.volume=.9;audio.load();return audio;
    });
    const bgmUrls=['/audio/opening-bgm-01.m4a?v=5','/audio/opening-bgm-02.m4a?v=5','/audio/opening-bgm-03.m4a?v=5','/audio/opening-bgm-04.m4a?v=5','/audio/opening-bgm-05.m4a?v=5','/audio/opening-bgm-06.m4a?v=5','/audio/opening-bgm-07.m4a?v=5','/audio/opening-bgm-08.m4a?v=5','/audio/opening-bgm-09.m4a?v=5','/audio/opening-bgm-10.m4a?v=5'];
    const curtainBgm=new Audio(bgmUrls[Math.floor(Math.random()*bgmUrls.length)]);
    curtainBgm.preload='auto';
    curtainBgm.loop=true;
    curtainBgm.volume=.12;
    curtainBgm.load();
    const voiceAudio=new Audio('/audio/opening-3voices.m4a?v=8');
    voiceAudio.preload='auto';
    voiceAudio.volume=.9;
    voiceAudio.load();

    function scheduleVoice(){
      if(opened||voiceTimer)return;
      voiceTimer=setTimeout(()=>{
        voiceTimer=0;
        if(opened)return;
        try{
          voiceAudio.currentTime=0;
          const p=voiceAudio.play();
          p?.catch(error=>{lastAudioError='voice:'+(error?.name||'play-failed');});
        }catch(error){lastAudioError='voice:'+(error?.name||'play-failed');}
      },800);
    }

    function startOpeningMedia(){
      if(opened||bgmPlaying)return true;
      try{
        curtainBgm.currentTime=0;
        const p=curtainBgm.play();
        if(p?.then){
          p.then(()=>{
            if(opened){stopCurtainBgm();return;}
            bgmPlaying=true;
            lastAudioError='';
            scheduleVoice();
          }).catch(error=>{
            bgmPlaying=false;
            lastAudioError='bgm:'+(error?.name||'play-failed');
          });
        }else{
          bgmPlaying=true;
          scheduleVoice();
        }
        return true;
      }catch(error){
        bgmPlaying=false;
        lastAudioError='bgm:'+(error?.name||'play-failed');
        return false;
      }
    }

    let bgmFadeFrame=0;
    function stopCurtainBgm(){
      if(bgmFadeFrame){cancelAnimationFrame(bgmFadeFrame);bgmFadeFrame=0;}
      try{curtainBgm.pause();curtainBgm.currentTime=0;curtainBgm.volume=.12;}catch(_){}
      bgmPlaying=false;
    }

    function fadeOutCurtainBgm(duration=650){
      if(!bgmPlaying||curtainBgm.paused){stopCurtainBgm();return;}
      if(bgmFadeFrame)cancelAnimationFrame(bgmFadeFrame);
      const startVolume=Math.max(.01,curtainBgm.volume||.12);
      const startedAt=performance.now();
      const step=now=>{
        const p=Math.min(1,(now-startedAt)/duration);
        const eased=Math.pow(1-p,3.4);
        try{curtainBgm.volume=Math.max(0,startVolume*eased);}catch(_){}
        if(p<1){bgmFadeFrame=requestAnimationFrame(step);return;}
        bgmFadeFrame=0;
        stopCurtainBgm();
      };
      bgmFadeFrame=requestAnimationFrame(step);
    }

    function chime(){
      const audio=tapAudios[Math.floor(Math.random()*tapAudios.length)];
      try{audio.currentTime=0;const p=audio.play();p?.catch(()=>{});}catch(_){}
    }

    const landscape=()=>{
      const v=window.visualViewport;
      return (v?.width||innerWidth) >= (v?.height||innerHeight);
    };

    let gesturePointerId=null,gestureStartedAt=0,gestureStartX=0,gestureStartY=0;
    function armPreparation(){
      if(started||!landscape())return;
      started=true;
      orientation.classList.remove('hp-loading');
      orientation.classList.add('hp-ready');
      // Best-effort autoplay at the exact landscape transition.
      // Safari may reject this; the trusted swipe/hold gesture below is the fallback.
      startOpeningMedia();
    }
    function finishPreparation(event){
      if(prepared||!started||!event.isTrusted)return;
      const dx=event.clientX-gestureStartX,dy=event.clientY-gestureStartY;
      const distance=Math.hypot(dx,dy);
      const held=performance.now()-gestureStartedAt;
      if(distance<72&&held<520)return;

      // Direct HTMLMediaElement.play() in the same trusted pointerup event.
      startOpeningMedia();

      prepared=true;
      orientation.classList.remove('hp-gesture-active');
      orientation.classList.add('hp-shatter');
      setTimeout(()=>{
        orientation.classList.add('hp-leave');
        title.classList.add('hp-show');
      },260);
      setTimeout(()=>{orientation.hidden=true;},720);
    }
    orientation.addEventListener('pointerdown',event=>{
      if(!started||prepared)return;
      gesturePointerId=event.pointerId;
      gestureStartedAt=performance.now();
      gestureStartX=event.clientX;
      gestureStartY=event.clientY;
      orientation.classList.add('hp-gesture-active');
      try{orientation.setPointerCapture(event.pointerId);}catch(_){}
      event.preventDefault();
    });
    orientation.addEventListener('pointerup',event=>{
      if(event.pointerId!==gesturePointerId||prepared)return;
      finishPreparation(event);
      gesturePointerId=null;
      orientation.classList.remove('hp-gesture-active');
      event.preventDefault();
    });
    orientation.addEventListener('pointercancel',()=>{
      gesturePointerId=null;
      orientation.classList.remove('hp-gesture-active');
    });

    title.addEventListener('pointerup',()=>{
      if(opened||!prepared)return;
      opened=true;
      fadeOutCurtainBgm(650);
      chime();
      window.dispatchEvent(new Event('hp-curtain-start'));
      title.classList.add('hp-curtain-open');
      setTimeout(()=>{document.body.classList.remove('hp-booting');opening.style.transition='opacity .65s ease';opening.style.opacity='0';},1250);
      setTimeout(()=>opening.remove(),1950);
    },{once:true});

    window.addEventListener('resize',armPreparation);
    window.addEventListener('orientationchange',armPreparation);
    window.visualViewport?.addEventListener('resize',armPreparation);
    armPreparation();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();