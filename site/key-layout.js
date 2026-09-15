(() => {
  'use strict';
  const prefs={white:100,black:100,edge:8};
  try {
    const saved=JSON.parse(localStorage.getItem('hp-key-sizes'));
    for(const [key,min,max] of [['white',60,100],['black',60,100],['edge',0,48]]) {
      if(Number.isFinite(saved?.[key]))prefs[key]=Math.max(min,Math.min(max,saved[key]));
    }
  }catch(_){}
  window.HP_KEY_PREFS=prefs;
  const floorTenth=value=>Math.floor(Math.max(0,value)*10)/10;
  const sizeFactor=value=>Math.max(.6,Math.min(1,value/100));
  window.HP_KEY_LAYOUT = (width,height,is37) => {
    // Each colour owns a fixed portion of the row. Their maximum sizes already
    // fit together, so neither slider can resize or reposition the other keys.
    const halfStep=width*.88/14;
    const gap=Math.min(5,halfStep*.12);
    const pairBudget=Math.max(0,2*(halfStep-gap));
    // Reference proportions: square natural : circular accidental = 4 : 3.
    const whiteMax=floorTenth(Math.min(pairBudget*4/7,height-12,is37?84:72));
    const blackMax=floorTenth(whiteMax*.75);
    const whiteSize=floorTenth(whiteMax*sizeFactor(prefs.white));
    const blackSize=floorTenth(blackMax*sizeFactor(prefs.black));
    const whiteCenter=height-9-whiteMax/2;
    const blackCenter=Math.max(3+blackMax/2,whiteCenter-whiteMax*.25);
    return {
      whiteWidth:whiteSize,whiteHeight:whiteSize,
      whiteTop:whiteCenter-whiteSize/2,
      blackSize,blackTop:blackCenter-blackSize/2
    };
  };
})();
