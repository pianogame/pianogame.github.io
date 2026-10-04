(() => {
  'use strict';
  const analyses = new WeakMap();
  const vowelGroups = {
    a: 'あかがさざただなはばぱまやらわぁゃゎ',
    i: 'いきぎしじちぢにひびぴみりぃ',
    u: 'うくぐすずつづぬふぶぷむゆるゔぅゅ',
    e: 'えけげせぜてでねへべぺめれぇ',
    o: 'おこごそぞとどのほぼぽもよろをぉょ',
  };
  function vowels(reading) {
    const kana = String(reading || '').normalize('NFKC').replace(/[ァ-ヶ]/g, letter => String.fromCharCode(letter.charCodeAt(0) - 0x60));
    const result = [];
    for (const letter of kana) {
      if (letter === 'ー') { if (result.length) result.push(result.at(-1)); continue; }
      if ('んっ'.includes(letter)) { result.push('closed'); continue; }
      const vowel = Object.keys(vowelGroups).find(key => vowelGroups[key].includes(letter));
      if (!vowel) continue;
      // Contracted syllables (きょ/ちゃ) have one vowel, not two.
      if ('ゃゅょぁぃぅぇぉ'.includes(letter) && result.length) result[result.length - 1] = vowel;
      else result.push(vowel);
    }
    return result;
  }
  function analyze(buffer) {
    if (analyses.has(buffer)) return analyses.get(buffer);
    const step = .02, frameSize = Math.max(1, Math.round(buffer.sampleRate * step));
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    const levels = [];
    let peak = 0;
    for (let start = 0; start < buffer.length; start += frameSize) {
      let square = 0, count = 0;
      for (const channel of channels) for (let i = start; i < Math.min(buffer.length, start + frameSize); i += 2) { square += channel[i] * channel[i]; count++; }
      const rms = Math.sqrt(square / Math.max(1, count));
      levels.push(rms); peak = Math.max(peak, rms);
    }
    const threshold = Math.max(.0025, peak * .055);
    const audible = levels.map(level => level >= threshold);
    // Bridge a single 20ms dip inside speech; preserve real pauses.
    for (let i = 1; i < audible.length - 1; i++) if (!audible[i] && audible[i - 1] && audible[i + 1]) audible[i] = true;
    let elapsedSpeech = 0;
    const positions = audible.map(active => { const position = elapsedSpeech; if (active) elapsedSpeech += step; return position; });
    const result = { step, audible, positions, speechDuration: elapsedSpeech };
    analyses.set(buffer, result);
    return result;
  }
  class LipSync {
    constructor() { this.stop(); }
    start({ characterId, buffer, context, startedAt, reading, message }) {
      this.characterId = characterId;
      this.context = context;
      this.startedAt = startedAt;
      this.duration = buffer.duration;
      this.analysis = analyze(buffer);
      this.sequence = vowels(reading || message);
    }
    sample(characterId) {
      if (!this.context || characterId !== this.characterId || this.context.state !== 'running') return 'closed';
      const time = this.context.currentTime - this.startedAt;
      if (time < 0 || time >= this.duration) return 'closed';
      const { step, audible, positions, speechDuration } = this.analysis;
      const frame = Math.floor(time / step);
      if (!audible[frame] || !this.sequence.length || !speechDuration) return 'closed';
      const index = Math.min(this.sequence.length - 1, Math.floor(positions[frame] / speechDuration * this.sequence.length));
      return this.sequence[index];
    }
    stop() { this.context = null; this.characterId = null; }
  }
  window.HP_CHARACTER_LIPSYNC = Object.freeze({ LipSync, vowels, analyze });
})();
