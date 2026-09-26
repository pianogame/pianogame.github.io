(() => {
  'use strict';
  const root=document.getElementById('hp-four88');
  const viewport=document.getElementById('hp-viewport');
  const action=name=>root.querySelector('[data-action="'+name+'"]');
  const panel=root.querySelector('.hp-install-panel');
  const status=root.querySelector('[data-output="display-status"]');
  const guide=root.querySelector('[data-install-guide]');
  const standalone=window.matchMedia('(display-mode: standalone)');
  const fullscreen=window.matchMedia('(display-mode: fullscreen)');
  const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
  const isApp=()=>navigator.standalone===true||standalone.matches||(fullscreen.matches&&!fullscreenElement());
  let installPrompt=null;
  const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

  const gate=document.createElement('section');
  gate.className='hp-install-gate';
  gate.setAttribute('aria-labelledby','hp-install-gate-title');
  gate.innerHTML='<div class="hp-install-gate-card"><div class="hp-install-gate-mark" aria-hidden="true">♪</div><h1 id="hp-install-gate-title">ピアノドリームステージ</h1><p class="hp-install-gate-lead">ホーム画面に追加してから起動してください。</p><button type="button" class="hp-install-gate-button" hidden>ホーム画面に追加</button><div class="hp-install-gate-guide"></div><p class="hp-install-gate-note">追加後は、ホーム画面のピアノドリームステージアイコンから開くと演奏画面が表示されます。</p></div>';
  document.body.append(gate);
  const gateButton=gate.querySelector('.hp-install-gate-button');
  const gateGuide=gate.querySelector('.hp-install-gate-guide');

  function renderGate() {
    if(isApp()) {
      gate.hidden=true;
      document.documentElement.classList.remove('hp-install-required');
      viewport?.removeAttribute('aria-hidden');
      if('inert' in (viewport||{})) viewport.inert=false;
      return;
    }
    gate.hidden=false;
    document.documentElement.classList.add('hp-install-required');
    viewport?.setAttribute('aria-hidden','true');
    if('inert' in (viewport||{})) viewport.inert=true;
    if(isIOS) {
      gateButton.hidden=true;
      gateGuide.innerHTML='<p>iPhone / iPadではSafariから次の手順で追加します。</p><ol><li>Safari下部の「共有」ボタンをタップ</li><li>「ホーム画面に追加」をタップ</li><li>「Webアプリとして開く」が表示されたらON</li><li>右上の「追加」をタップ</li></ol>';
    } else if(installPrompt) {
      gateButton.hidden=false;
      gateGuide.innerHTML='<p>下のボタンからアプリとしてインストールできます。</p>';
    } else {
      gateButton.hidden=true;
      gateGuide.innerHTML='<p>ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。</p>';
    }
  }

  function refresh() {
    const app=isApp(),full=!!fullscreenElement();
    const canFullscreen=!!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen)&&document.fullscreenEnabled!==false;
    root.dataset.appDisplay=String(app);
    action('display-mode').hidden=app;
    action('display-mode').textContent=full?'全画面を解除':'全画面';
    action('fullscreen').hidden=app||(!canFullscreen&&!full);
    action('fullscreen').textContent=full?'全画面を解除':'この画面を全画面にする';
    action('install-app').hidden=app||!installPrompt;
    guide.hidden=app;
    status.textContent=app?'ホーム画面から起動しています。URLバーなしで演奏できます。':full?'全画面で表示しています。':isIOS?'ホーム画面から起動すると演奏できます。':'ホーム画面やアプリ一覧に追加すると演奏できます。';
    renderGate();
    window.dispatchEvent(new Event('hp-viewport-resize'));
  }
  function showGuide(message) {
    if(root.querySelector('.hp-settings-overlay').hidden)action('settings').click();
    if(message)status.textContent=message;
    root.querySelector('.hp-settings').scrollTop=0;
    panel.querySelector('h2').focus({preventScroll:true});
  }
  async function enterFullscreen() {
    if(isApp()){showGuide('ホーム画面から起動しています。URLバーは表示されていません。');return;}
    try {
      if(fullscreenElement()) {
        const exit=document.exitFullscreen||document.webkitExitFullscreen;
        if(exit)await exit.call(document);
      } else {
        const enter=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;
        if(!enter||document.fullscreenEnabled===false) {showGuide('この表示では直接全画面にできません。ホーム画面に追加してください。');return;}
        if(!root.querySelector('.hp-settings-overlay').hidden)action('settings-close').click();
        await enter.call(document.documentElement);
        try {if(screen.orientation?.lock)await screen.orientation.lock('landscape');}catch(_){}
      }
      refresh();
    } catch(_) {showGuide('全画面表示が許可されませんでした。ホーム画面からアプリとして開けます。');}
  }
  async function installFromPrompt() {
    if(!installPrompt){renderGate();return;}
    const prompt=installPrompt;
    installPrompt=null;
    gateButton.hidden=true;
    action('install-app').hidden=true;
    try {
      await prompt.prompt();
      const result=await prompt.userChoice;
      status.textContent=result.outcome==='accepted'?'追加したピアノドリームステージのアイコンから起動してください。':'追加をキャンセルしました。ブラウザのメニューからも追加できます。';
    } catch(_) {
      status.textContent='ブラウザのメニューからホーム画面に追加してください。';
    }
    renderGate();
  }

  gateButton.addEventListener('click',()=>void installFromPrompt());
  action('display-mode').addEventListener('click',()=>void enterFullscreen());
  action('fullscreen').addEventListener('click',()=>void enterFullscreen());
  action('install-app').addEventListener('click',()=>void installFromPrompt());
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;refresh();});
  window.addEventListener('appinstalled',()=>{installPrompt=null;refresh();status.textContent='追加したピアノドリームステージのアイコンから起動してください。';});
  document.addEventListener('fullscreenchange',refresh);
  document.addEventListener('webkitfullscreenchange',refresh);
  standalone.addEventListener?.('change',refresh);
  fullscreen.addEventListener?.('change',refresh);
  window.addEventListener('pageshow',refresh);

  if(!isIOS) {
    root.querySelector('.hp-install-browser-note').textContent='ブラウザのメニューからピアノドリームステージをアプリとしてインストールしてください。';
    const steps=root.querySelector('.hp-install-steps');
    steps.replaceChildren();
    ['ブラウザでこのサイトを開きます。','ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選びます。','追加したピアノドリームステージのアイコンから起動します。'].forEach(text=>{const li=document.createElement('li');li.textContent=text;steps.append(li);});
  }
  refresh();
})();