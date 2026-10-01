(() => {
  'use strict';
  const root=document.getElementById('hp-four88');
  const shapes={
    '●':'<circle cx="12" cy="12" r="7"/>',
    '■':'<path d="M5 5h14v14H5Z"/>',
    '▶':'<path d="M6 4v16l14-8Z"/>',
    '♪':'<path d="M11 3h3v13c0 4-7 5-8 1-1-3 3-5 5-4Zm3 0 7 2v5l-7-2Z"/>',
    '↑':'<path d="m5 11 7-7 7 7-2 2-4-4v11h-2V9l-4 4Z"/>',
    '↓':'<path d="m5 13 7 7 7-7-2-2-4 4V4h-2v11l-4-4Z"/>',
    '−':'<path d="M4 11h16v2H4Z"/>',
    '＋':'<path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7Z"/>',
    '💾':'<path d="M4 3h14l3 3v15H3V3Zm2 2v6h11V5Zm1 9v5h10v-5Z" fill-rule="evenodd"/>',
    '📤':'<path d="m6 8 6-6 6 6-2 2-3-3v9h-2V7l-3 3ZM3 14h2v6h14v-6h2v8H3Z"/>'
  };
  function icon(shape){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    svg.classList.add('hp-ui-icon');svg.innerHTML=shape;return svg;
  }
  function centreButton(button){
    if(button.querySelector(':scope > .hp-control-content'))return;
    if(button.dataset.align==='left'||getComputedStyle(button).textAlign==='left')return;
    button.classList.add('hp-centred-button');
    const text=button.textContent.trim(),first=[...text][0],symbol=shapes[first]?first:'';
    const svg=symbol?icon(shapes[symbol]):button.querySelector('svg')?.cloneNode(true);
    const content=document.createElement('span');content.className='hp-control-content';
    if(svg)content.append(svg);
    if(symbol){
      // Retain existing textContent state comparisons while the actual mark is
      // a centred SVG, rather than a font glyph with a different baseline.
      const original=document.createElement('span');original.className='hp-control-original-mark';
      original.setAttribute('aria-hidden','true');original.textContent=symbol+' ';content.append(original);
    }
    const label=document.createElement('span');label.className='hp-control-label';
    label.textContent=symbol?text.slice(symbol.length).trim():text;content.append(label);
    button.replaceChildren(content);
  }
  const selector='button.hp-control,button.hp-range-step,button.hp-fx-toggle,.hp-track-panel button';
  function centreButtons(){root.querySelectorAll(selector).forEach(centreButton);}
  centreButtons();
  // Recording/playback replace button text as their state changes. Rewrap only
  // unformatted controls; observing our own wrapper is therefore a no-op.
  const observer=new MutationObserver(records=>{
    for(const record of records){
      const button=record.target.closest?.('button');
      if(button?.matches(selector))centreButton(button);
      for(const node of record.addedNodes){
        if(node.nodeType!==1)continue;
        if(node.matches(selector))centreButton(node);
        node.querySelectorAll(selector).forEach(centreButton);
      }
    }
  });
  observer.observe(root,{childList:true,subtree:true});
  document.querySelectorAll('.hp-install-gate-button').forEach(centreButton);

  const select=root.querySelector('[data-control="layout"]'),holder=select.closest('label');
  holder.classList.add('hp-layout-centred');
  const content=document.createElement('span');content.className='hp-layout-content';content.setAttribute('aria-hidden','true');
  content.append(icon('<path d="m5 9 7-7 7 7-2 2-5-5-5 5Zm0 6 7 7 7-7-2-2-5 5-5-5Z"/>'));
  const label=document.createElement('span');label.className='hp-control-label';content.append(label);holder.append(content);
  function updateLayout(){label.textContent=select.selectedOptions[0].textContent;}
  select.addEventListener('change',updateLayout);updateLayout();
})();
