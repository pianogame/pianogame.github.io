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
      name: '神代 透花',
      reading: 'かみしろ とうか',
      description: 'テクニカル・ドラマティックピアニスト',
      motionDataPath: '/characters/character01',
      previewImage: '/characters/character01/reference/full-body.png',
      // The owned-character list uses the profile artwork crop; detail/HOME keep MotionCharacter.
      listImage: '/characters/character01/list-art.jpg',
      profile: {
        age: '20歳',
        personality: '冷静で努力家、実は面倒見がいい',
        style: 'テクニカル・ドラマティックピアニスト',
        story: '精密な指さばきと情熱的な表現を両立させる、舞台映えする実力派。',
        skill: 'ノヴァ・アルペジオ',
      },
      voiceSetId: 'home-original',
      // Only owned characters appear in the character screen or can be selected for HOME.
      // Acquisition can later update this flag from account/save data without changing the UI.
      owned: true,
      available: true,
      // Reserved for the future affinity system. It is intentionally disabled for now.
      // Later, voice unlock requirements can live here without changing MotionCharacter.
      progression: {
        affinity: { enabled: false },
        voiceUnlocks: [],
      },
    },
  ];
  const defaultId = 'character01';
  const get = id => characters.find(character => character.id === id) || null;
  const isOwned = character => Boolean(character && character.owned === true && character.available !== false);
  const ownedList = () => characters.filter(isOwned);
  window.HP_CHARACTERS = Object.freeze({
    list: () => characters.slice(),
    ownedList: () => ownedList().slice(),
    get,
    defaultId,
    isOwned,
    progression: character => character?.progression || { affinity: { enabled: false }, voiceUnlocks: [] },
    voiceSet: character => voiceSets[character?.voiceSetId] || { entries: [] },
  });
})();
