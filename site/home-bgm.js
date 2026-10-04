(() => {
  'use strict';
  const home = document.getElementById('hp-home-screen');
  if (!home) return;

  // Local device time: morning 05:00–11:00, afternoon 11:00–18:00,
  // evening 18:00–05:00. Keep the supplied recordings intact.
  const trackForHour = hour => hour >= 5 && hour < 11 ? 'asabgm'
    : hour >= 11 && hour < 18 ? 'hirubgm' : 'yorubgm';
  const music = new Audio();
  music.dataset.homeBgm = '';
  music.loop = true;
  music.preload = 'none';
  music.hidden = true;
  home.appendChild(music);

  let graph = null;
  let track = '';
  let activated = false;
  let warmingUp = false;
  let pageActive = true;
  let boundaryTimer = 0;
  let voiceSpeaking = false;

  const homeGain = () => canPlay() ? (voiceSpeaking ? .18 : .5) : 0;

  function canPlay() {
    return pageActive && !document.hidden && !home.hidden
      && !document.body.classList.contains('hp-booting')
      && !document.documentElement.classList.contains('hp-install-required')
      && !home.classList.contains('hp-piano-launching');
  }

  function ensureGraph() {
    if (graph) return true;
    const bridge = window.HP_AUDIO_BRIDGE?.get?.();
    if (!bridge) return false;
    const source = bridge.context.createMediaElementSource(music);
    const gain = bridge.context.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    // The existing volume setting controls BGM too, including mute on iOS.
    gain.connect(bridge.output);
    graph = { context: bridge.context, gain };
    return true;
  }

  function setGain(value) {
    if (!graph) return;
    const { context, gain } = graph;
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setTargetAtTime(value, context.currentTime, .12);
  }

  function chooseTrack() {
    const next = trackForHour(new Date().getHours());
    if (next === track) return;
    setGain(0);
    music.pause();
    track = next;
    home.dataset.bgmTrack = next;
    music.src = '/audio/' + next + '.mp3?v=1';
    music.load();
  }

  function scheduleBoundary() {
    clearTimeout(boundaryTimer);
    const now = new Date();
    const hour = now.getHours();
    const next = new Date(now);
    next.setHours(hour < 5 ? 5 : hour < 11 ? 11 : hour < 18 ? 18 : 29, 0, 0, 0);
    boundaryTimer = setTimeout(() => {
      sync();
      scheduleBoundary();
    }, Math.max(1, next.getTime() - now.getTime()));
  }

  function sync() {
    chooseTrack();
    if (!document.body.classList.contains('hp-booting')) warmingUp = false;
    const audible = canPlay();
    const warm = warmingUp && pageActive && !document.hidden && !home.hidden
      && !document.documentElement.classList.contains('hp-install-required');
    if (!activated || (!audible && !warm)) {
      setGain(0);
      music.pause();
      return;
    }
    if (!ensureGraph()) return;
    setGain(homeGain());
    if (music.paused) {
      try {
        const playback = music.play();
        playback?.catch(() => {}); // Retry at the next home gesture if required.
      } catch (_) {}
    }
  }

  function unlock() {
    activated = true;
    try {
      window.HP_AUDIO_BRIDGE?.configureSession?.();
      const resume = window.HP_AUDIO_BRIDGE?.resume?.();
      resume?.catch(() => {});
      sync();
    } catch (_) {}
  }

  // Play silently inside the curtain gesture so iOS/Android allow playback
  // when the animation reveals HOME. The opening music fades independently.
  window.addEventListener('hp-curtain-start', () => {
    warmingUp = true;
    unlock();
  });
  home.addEventListener('pointerdown', () => { if (canPlay()) unlock(); }, { capture: true, passive: true });
  home.addEventListener('keydown', () => { if (canPlay()) unlock(); }, { capture: true });
  music.addEventListener('playing', () => setGain(homeGain()));
  window.addEventListener('hp-home-voice-state', event => {
    voiceSpeaking = event.detail.playing;
    setGain(homeGain());
  });

  const observer = new MutationObserver(sync);
  observer.observe(home, { attributes: true, attributeFilter: ['hidden', 'class'] });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { sync(); scheduleBoundary(); });
  window.addEventListener('pagehide', () => { pageActive = false; sync(); clearTimeout(boundaryTimer); });
  window.addEventListener('pageshow', () => { pageActive = true; sync(); scheduleBoundary(); });
  window.addEventListener('focus', () => { sync(); scheduleBoundary(); });
  sync();
  scheduleBoundary();
})();
