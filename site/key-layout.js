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
    // Piano Dream Stage: keep the existing note map/hit targets, but size the
    // visual keys like a conventional piano instead of square/circular pads.
    const slot=width/8;
    const whiteMaxWidth=floorTenth(Math.min(slot*.985,is37?168:150));
    const whiteMaxHeight=floorTenth(Math.min(height-6,whiteMaxWidth*.68,is37?82:72));
    const blackMaxWidth=floorTenth(whiteMaxWidth*.48);
    const blackMaxHeight=floorTenth(Math.min(whiteMaxHeight*.64,height*.62));

    const whiteFactor=sizeFactor(prefs.white);
    const blackFactor=sizeFactor(prefs.black);
    const whiteWidth=floorTenth(whiteMaxWidth*whiteFactor);
    const whiteHeight=floorTenth(whiteMaxHeight*whiteFactor);
    const blackWidth=floorTenth(blackMaxWidth*blackFactor);
    const blackHeight=floorTenth(blackMaxHeight*blackFactor);

    const baseline=Math.max(3,height-4);
    const whiteTop=floorTenth(baseline-whiteHeight);
    // Black keys start at the same upper rail and overlap the upper portion of whites.
    const blackTop=floorTenth(Math.max(1,whiteTop-1));

    return {whiteWidth,whiteHeight,whiteTop,blackWidth,blackHeight,blackTop};
  };
})();