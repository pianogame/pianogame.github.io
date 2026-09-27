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
      .hp-opening-orientation{z-index:3;padding:28px;background:#fff;color:#29242c;text-align:center;opacity:1;transition:opacity .9s ease}
      .hp-opening-orientation.hp-leave{opacity:0;pointer-events:none}
      .hp-opening-orientation-inner{max-width:620px}
      .hp-opening-phone{position:relative;width:74px;height:132px;margin:0 auto 25px;border:2px solid #4c4650;border-radius:15px;animation:hp-turn 2.2s cubic-bezier(.65,0,.25,1) infinite}
      .hp-opening-phone:after{content:"";position:absolute;left:50%;bottom:7px;width:7px;height:7px;border:1px solid #77717b;border-radius:50%;transform:translateX(-50%)}
      .hp-opening-orientation strong{display:block;font-size:clamp(21px,5vw,31px);font-weight:500;letter-spacing:.08em}
      .hp-opening-orientation span{display:block;margin-top:13px;color:#77717b;font-family:system-ui,sans-serif;font-size:14px;line-height:1.8}
      .hp-opening-title{z-index:10001;background:#120713;color:#fff;opacity:0;transition:opacity 1s ease}
      .hp-opening-title.hp-show{opacity:1;cursor:pointer}
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
          <strong>横向きにしてお楽しみください</strong>
          <span>端末を横向きにすると、自動的にステージが始まります。</span>
        </div>
      </section>
      <section class="hp-opening-title" aria-label="ピアノドリームステージ">
        <i class="hp-opening-spark s1"></i><i class="hp-opening-spark s2"></i><i class="hp-opening-spark s3"></i>
        <div class="hp-opening-logo"><span class="hp-opening-en">Piano Dream Stage</span><span class="hp-opening-jp">ピアノドリームステージ</span><span class="hp-opening-tap">Tap Curtain Start</span></div>
      </section>`;
    document.body.append(opening);

    const orientation=opening.querySelector('.hp-opening-orientation');
    const title=opening.querySelector('.hp-opening-title');
    let started=false,opened=false,voicePlayed=false,bgmPlaying=false,voiceTimer=0;
    const voiceAudio=new Audio('/audio/opening-3voices.m4a?v=4');
    voiceAudio.preload='auto';
    voiceAudio.volume=.9;
    const tapAudios=['/audio/curtain-start-1.mp3?v=2','/audio/curtain-start-2.mp3?v=2','/audio/curtain-start-3.mp3?v=2','/audio/curtain-start-4.mp3?v=2'].map(url=>{
      const audio=new Audio(url);audio.preload='auto';audio.volume=.9;return audio;
    });
    const bgmUrls=['/audio/opening-bgm-01.m4a?v=2','/audio/opening-bgm-02.m4a?v=2','/audio/opening-bgm-03.m4a?v=2','/audio/opening-bgm-04.m4a?v=2','/audio/opening-bgm-05.m4a?v=2','/audio/opening-bgm-06.m4a?v=2','/audio/opening-bgm-07.m4a?v=2','/audio/opening-bgm-08.m4a?v=2','/audio/opening-bgm-09.m4a?v=2','/audio/opening-bgm-10.m4a?v=2'];
    const curtainBgm=new Audio(bgmUrls[Math.floor(Math.random()*bgmUrls.length)]);
    curtainBgm.preload='auto';
    curtainBgm.loop=true;
    curtainBgm.volume=.12;

    function playCurtainVoice(){
      if(voicePlayed||opened)return;
      try{
        voiceAudio.currentTime=0;
        const p=voiceAudio.play();
        if(p?.then)p.then(()=>{voicePlayed=true;}).catch(()=>{});
        else voicePlayed=true;
      }catch(_){}
    }

    function scheduleCurtainVoice(){
      if(voiceTimer||voicePlayed||opened)return;
      voiceTimer=setTimeout(()=>{
        voiceTimer=0;
        playCurtainVoice();
      },800);
    }

    function startOpeningAudio(){
      try{
        curtainBgm.currentTime=0;
        const p=curtainBgm.play();
        if(p?.then){
          p.then(()=>{
            bgmPlaying=true;
            scheduleCurtainVoice();
          }).catch(()=>{
            bgmPlaying=false;
          });
        }else{
          bgmPlaying=true;
          scheduleCurtainVoice();
        }
      }catch(_){
        bgmPlaying=false;
      }
    }

    let bgmFadeFrame=0;
    function stopCurtainBgm(){
      if(bgmFadeFrame){cancelAnimationFrame(bgmFadeFrame);bgmFadeFrame=0;}
      try{
        curtainBgm.pause();
        curtainBgm.currentTime=0;
        curtainBgm.volume=.12;
      }catch(_){}
      bgmPlaying=false;
    }

    function fadeOutCurtainBgm(duration=1200){
      if(!bgmPlaying||curtainBgm.paused){stopCurtainBgm();return;}
      if(bgmFadeFrame)cancelAnimationFrame(bgmFadeFrame);
      const startVolume=curtainBgm.volume;
      const startedAt=performance.now();
      const step=now=>{
        const progress=Math.min(1,(now-startedAt)/duration);
        curtainBgm.volume=Math.max(0,startVolume*(1-progress));
        if(progress<1){bgmFadeFrame=requestAnimationFrame(step);return;}
        bgmFadeFrame=0;
        stopCurtainBgm();
      };
      bgmFadeFrame=requestAnimationFrame(step);
    }

    function chime(){
      const audio=tapAudios[Math.floor(Math.random()*tapAudios.length)];
      try{
        audio.currentTime=0;
        const p=audio.play();
        p?.catch(()=>{});
      }catch(_){}
    }

    const landscape=()=>{
      const v=window.visualViewport;
      return (v?.width||innerWidth) >= (v?.height||innerHeight);
    };
    function begin(){
      if(started||!landscape())return;
      started=true;
      orientation.classList.add('hp-leave');
      setTimeout(()=>{
        orientation.hidden=true;
        title.classList.add('hp-show');
        startOpeningAudio();
        title.addEventListener('pointerup',()=>{
          if(opened)return;
          opened=true;
          fadeOutCurtainBgm(1200);
          chime();
          window.dispatchEvent(new Event('hp-curtain-start'));
          title.classList.add('hp-curtain-open');
          setTimeout(()=>{document.body.classList.remove('hp-booting');opening.style.transition='opacity .65s ease';opening.style.opacity='0';},1250);
          setTimeout(()=>opening.remove(),1950);
        },{once:true});
      },850);
    }
    window.addEventListener('resize',begin);
    window.addEventListener('orientationchange',begin);
    window.visualViewport?.addEventListener('resize',begin);
    begin();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();