(() => {
  'use strict';
  function init() {
    if (document.getElementById('hp-rotation-guide')) return;
    const style = document.createElement('style');
    style.textContent = `
      #hp-rotation-guide[hidden]{display:none!important}
      #hp-rotation-guide{position:fixed;z-index:10000;top:max(12px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));max-width:420px;margin:0 auto;padding:16px;box-sizing:border-box;background:#fffafc;color:#423749;border:1px solid #c8b8cf;border-radius:16px;box-shadow:0 6px 24px #302b3a40;font:15px/1.6 system-ui,sans-serif;text-align:left;max-height:calc(100dvh - 32px);overflow:auto;touch-action:pan-y}
      #hp-rotation-guide p{margin:0 0 10px}
      #hp-rotation-guide strong{display:block;font-size:17px;margin-bottom:6px}
      #hp-rotation-guide button{display:block;margin-left:auto;min-width:88px;min-height:44px;padding:8px 20px;border:1px solid #b4a1bc;border-radius:10px;background:#eee3f2;color:#423749;font:inherit;cursor:pointer;touch-action:manipulation}
      #hp-rotation-guide button:focus-visible{outline:3px solid #73558c;outline-offset:3px}
    `;
    document.head.append(style);
    const panel = document.createElement('aside');
    panel.id = 'hp-rotation-guide';
    panel.hidden = true;
    panel.setAttribute('aria-label', '横画面のご案内');
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    const title = document.createElement('strong');
    title.textContent = '横向きにすると広い画面で演奏できます';
    const text = document.createElement('span');
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    text.textContent = ios
      ? '端末を横にしても切り替わらない場合は、コントロールセンターを開き、縦向きロック（🔒↻）を解除してください。ホームボタンのないiPhoneは、画面右上から下にスワイプすると開けます。'
      : '端末を横にしても切り替わらない場合は、端末の画面回転の設定を確認してください。';
    message.append(title, text);
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '閉じる';
    panel.append(message, close);
    // Outside any CSS-rotated piano container: measure the actual viewport.
    document.body.append(panel);
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('hp-rotation-guide-dismissed') === '1'; } catch (_) {}
    function update() {
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      panel.hidden = dismissed || height <= width;
    }
    close.addEventListener('click', () => {
      dismissed = true;
      try { sessionStorage.setItem('hp-rotation-guide-dismissed', '1'); } catch (_) {}
      update();
    });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('pageshow', update);
    window.visualViewport?.addEventListener('resize', update);
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
