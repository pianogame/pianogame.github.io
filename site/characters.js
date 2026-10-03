(() => {
  'use strict';

  // Add character data here; HOME, the selector and the renderer stay shared.
  // Voice paths/readings belong to a voice set, never to MotionCharacter.
  const voiceSets = {
    'home-original': {
      entries: [
        { file: 'konnani', lines: ['こんなに美しい音楽と', 'すごせる毎日…', '……ふふっ♪'], reading: 'こんなにうつくしいおんがくとすごせるまいにちふふっ' },
        { file: 'okaeri', lines: ['おかえりなさい。', '今日はどんな曲を', '一緒に奏でようか？'], reading: 'おかえりなさいきょうはどんなきょくをいっしょにかなでようか' },
        { file: 'anatano', lines: ['あなたの音を聴くと、', '自然と笑顔になるの。', '……不思議だね♪'], reading: 'あなたのおとをきくとしぜんとえがおになるのふしぎだね' },
        { file: 'sukositukare', lines: ['少し疲れちゃった？', 'ゆっくりで大丈夫。', '私もそばにいるよ。'], reading: 'すこしつかれちゃったゆっくりでだいじょうぶわたしもそばにいるよ' },
        { file: 'tuginoition', lines: ['次の一音に、', '気持ちをこめて。', '一緒に奏でよう♪'], reading: 'つぎのいちおんにきもちをこめていっしょにかなでよう' },
      ],
      greetingIndex: 1,
      rare: { interval: 20, messageIndex: 2, file: 'anatanorare', reading: 'あなたのおとをきくとしぜんとえがおになるのふしぎだね' },
      audioBasePath: '/audio',
    },
  };
  const characters = [
    {
      id: 'character01',
      name: 'キャラクター01',
      description: 'ピアニスト',
      motionDataPath: '/characters/character01',
      previewImage: '/characters/character01/reference/full-body.png',
      voiceSetId: 'home-original',
      // Acquisition can later be resolved separately, without changing the renderer.
      available: true,
    },
  ];
  const defaultId = 'character01';
  const get = id => characters.find(character => character.id === id) || null;
  window.HP_CHARACTERS = Object.freeze({
    list: () => characters.slice(), get, defaultId,
    voiceSet: character => voiceSets[character?.voiceSetId] || { entries: [] },
  });
})();
