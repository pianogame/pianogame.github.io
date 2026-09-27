(() => {
  'use strict';
  function init() {
    if (document.getElementById('hp-opening-sequence')) return;

    const style=document.createElement('style');
    style.textContent=`
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
      .hp-opening-title{z-index:10001;background:linear-gradient(145deg,#160a20,#301333 55%,#160a20);color:#fff;opacity:0;transition:opacity 1s ease}
      .hp-opening-title.hp-show{opacity:1;cursor:pointer}
      .hp-opening-title:before,.hp-opening-title:after{content:"";position:absolute;top:0;bottom:0;width:52%;background:linear-gradient(90deg,#1c0b20,#5c244c 58%,#2a1029);box-shadow:inset -20px 0 45px #09030a66;transition:transform 1.5s cubic-bezier(.7,0,.2,1)}
      .hp-opening-title:before{left:0;transform-origin:left}
      .hp-opening-title:after{right:0;transform:scaleX(-1);transform-origin:right}
      .hp-opening-title.hp-curtain-open:before{transform:translateX(-97%)}
      .hp-opening-title.hp-curtain-open:after{transform:scaleX(-1) translateX(-97%)}
      .hp-opening-logo{position:relative;z-index:1;padding:24px;text-align:center;opacity:0;transform:translateY(8px);transition:opacity 1.1s ease .25s,transform 1.1s ease .25s}
      .hp-opening-title.hp-show .hp-opening-logo{opacity:1;transform:none}
      .hp-opening-en{position:relative;display:block;font-size:clamp(29px,7vw,68px);font-weight:400;letter-spacing:.12em;background:linear-gradient(100deg,#d9b86d,#fff6d0 42%,#d2a553 57%,#f8e7b3);background-size:220% auto;-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 8px #0008);animation:hp-gold-sweep 2.8s ease-in-out infinite}
      .hp-opening-jp{display:block;margin-top:10px;color:#e9d7bd;font-size:clamp(12px,2.4vw,20px);letter-spacing:.32em}
      .hp-opening-spark{position:absolute;z-index:2;width:5px;height:5px;border-radius:50%;background:#fff5ca;box-shadow:0 0 12px #ffe39a;opacity:0;animation:hp-spark 2.4s ease-in-out infinite}
      .hp-opening-spark.s1{left:24%;top:38%}.hp-opening-spark.s2{right:22%;top:55%;animation-delay:.7s}.hp-opening-spark.s3{left:55%;top:27%;animation-delay:1.3s}
      @keyframes hp-turn{0%,22%{transform:rotate(0deg)}58%,90%{transform:rotate(90deg)}100%{transform:rotate(0deg)}}
      @keyframes hp-gold-sweep{0%,20%{background-position:100% center}70%,100%{background-position:-100% center}}
      @keyframes hp-spark{0%,100%{opacity:0;transform:scale(.3)}45%{opacity:1;transform:scale(1.5)}}
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
        <div class="hp-opening-logo"><span class="hp-opening-en">Piano Dream Stage</span><span class="hp-opening-jp">ピアノドリームステージ</span><span style="display:block;margin-top:22px;font:14px system-ui,sans-serif;letter-spacing:.14em;color:#ead9c0">幕をタッチして開演</span></div>
      </section>`;
    document.body.append(opening);

    const orientation=opening.querySelector('.hp-opening-orientation');
    const title=opening.querySelector('.hp-opening-title');
    let started=false,opened=false;
    function chime(){try{const A=window.AudioContext||window.webkitAudioContext;const c=new A();const g=c.createGain();g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.12,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.8);g.connect(c.destination);[659.25,987.77,1318.51].forEach((f,i)=>{const o=c.createOscillator();o.type='sine';o.frequency.value=f;o.connect(g);o.start(c.currentTime+i*.06);o.stop(c.currentTime+.85);});setTimeout(()=>c.close(),1100);}catch(_){}}

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
        title.addEventListener('pointerup',()=>{if(opened)return;opened=true;chime();window.dispatchEvent(new Event('hp-curtain-start'));title.classList.add('hp-curtain-open');setTimeout(()=>{opening.style.transition='opacity .65s ease';opening.style.opacity='0';},1450);setTimeout(()=>opening.remove(),2150);},{once:true});
      },850);
    }
    window.addEventListener('resize',begin);
    window.addEventListener('orientationchange',begin);
    window.visualViewport?.addEventListener('resize',begin);
    begin();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();