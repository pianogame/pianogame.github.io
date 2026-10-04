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
      rare: {
        interval: 20,
        file: 'neerare',
        lines: [
          '……ねえ、もう少しだけ近くに来て。',
          '今だけは、あなたの音を誰より近くで感じていたいの。',
          '……ふふっ、そんなに緊張しなくてもいいのに。',
        ],
        reading: 'ねえもうすこしだけちかくにきていまだけはあなたのおとをだれよりちかくでかんじていたいのふふっそんなにきんちょうしなくてもいいのに',
      },
      audioBasePath: '/audio',
      audioRevision: 'touka-20261004-1',
    },
    'home-kanato': {
      entries: [
        { file: 'okaeri', lines: ['おかえりなさい。', '……今日は、少し疲れてるように見える。', '無理してないならいいけど。'], reading: 'おかえりなさいきょうはすこしつかれてるようにみえるむりしてないならいいけど' },
        { file: 'sakkimade', lines: ['さっきまでピアノを弾いてた。', 'ちょうど一区切りついたところだ。', '……君も少し休んでいく？'], reading: 'さっきまでぴあのをひいてたちょうどひとくぎりついたところだきみもすこしやすんでいく' },
        { file: 'sizukana', lines: ['静かな時間って、悪くないだろ。', '話したくなったら話せばいいし、', '何も言わなくても構わない。'], reading: 'しずかなじかんってわるくないだろはなしたくなったらはなせばいいしなにもいわなくてもかまわない' },
        { file: 'kimiga', lines: ['君が来ると、なんとなく空気が変わるな。', '……いや、深い意味はない。', 'たぶん。'], reading: 'きみがくるとなんとなくくうきがかわるないやふかいいみはないたぶん' },
        { file: 'kyonoensou', lines: ['今日の演奏、いつもと少し変えてみたんだ。', '君なら気づくかもしれない。', '……聴いてみる？'], reading: 'きょうのえんそういつもとすこしかえてみたんだきみならきづくかもしれないきいてみる' },
      ],
      greetingIndex: 0,
      rare: {
        interval: 20,
        file: 'imadakewarare',
        lines: ['……今だけは、ピアニストでも執事でもなくていい？', 'ただの男として……', '君のそばにいたい。'],
        reading: 'いまだけはぴあにすとでもしつじでもなくていいただのおとことしてきみのそばにいたい',
      },
      audioBasePath: '/audio/kanato',
      audioRevision: 'kanato-20261004-2',
    },
  };
  // Shared profile schema. Required fields stay visible for every character so
  // new characters do not silently lose common profile information.
  const profileFields = Object.freeze([
    { key: 'age', label: '年齢', required: true },
    { key: 'birthday', label: '誕生日', required: true },
    { key: 'zodiac', label: '星座', required: true },
    { key: 'height', label: '身長', required: true },
    { key: 'bloodType', label: '血液型', required: true },
    { key: 'dominantHand', label: '利き手', required: true },
    { key: 'hometown', label: '出身地', required: true },
    { key: 'type', label: 'タイプ', required: true },
    { key: 'personality', label: '性格', required: true, wide: true },
    { key: 'strengths', label: '長所', required: true },
    { key: 'weaknesses', label: '短所', required: true },
    { key: 'hobby', label: '趣味', required: true, wide: true },
    { key: 'specialty', label: '特技', required: true, wide: true },
    { key: 'likes', label: '好きなもの', required: true, wide: true },
    { key: 'dislikes', label: '苦手なもの', required: true, wide: true },
    { key: 'favoriteFoods', label: '好きな食べ物', required: true },
    { key: 'dislikedFoods', label: '苦手な食べ物', required: true },
    { key: 'holiday', label: '休日の過ごし方', required: true, wide: true },
    { key: 'pianoHistory', label: 'ピアノ歴', required: true },
    { key: 'style', label: '演奏スタイル', required: true, wide: true },
    { key: 'favoriteTone', label: '得意な曲調', required: true, wide: true },
    { key: 'difficultTone', label: '苦手な曲調', required: true, wide: true },
    { key: 'pianoStart', label: 'ピアノを始めたきっかけ', required: true, wide: true },
    { key: 'technique', label: '得意な演奏技術', required: true, wide: true },
    { key: 'selfIntroduction', label: '自己紹介', required: true, wide: true },
    { key: 'skill', label: 'スキル', required: true, wide: true },
  ]);
  const characters = [
    {
      id: 'character01',
      name: '神代 透花',
      reading: 'かみしろ とうか',
      description: 'テクニカル・ドラマティックピアニスト',
      motionDataPath: '/characters/character01',
      previewImage: '/characters/character01/reference/full-body.png',
      // The owned-character list uses the supplied piano artwork; detail/HOME keep MotionCharacter.
      listImage: 'data:image/jpeg;base64,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',
      // Detail view places the live MotionCharacter over the supplied star-palace background.
      profileBackground: '/characters/character01/profile-bg.jpg?v=20261005-restored',
      profile: {
        age: '20歳',
        birthday: '11月17日',
        zodiac: 'さそり座',
        height: '166cm',
        bloodType: 'AB型',
        dominantHand: '右',
        hometown: '長野県',
        type: 'クール・エレガント',
        personality: '冷静で観察力に優れた努力家。面倒見がよい一方、完璧主義で自分の中に抱え込みがち。',
        strengths: '観察力・継続力',
        weaknesses: '完璧主義で、人に頼るのが遅い',
        hobby: '夜の散歩・星空や夜景の撮影・楽譜への書き込み',
        specialty: '演奏の特徴を細かく記憶すること・会場の響きの違いを敏感に捉えること',
        likes: '静かな場所、夜空、月や星の小物、古い楽譜、雨音',
        dislikes: '大人数で騒ぐ場、急な予定変更、人に頼ること',
        favoriteFoods: '洋梨のタルト、ビターチョコレート',
        dislikedFoods: '極端に辛い料理',
        holiday: '午前はゆっくり過ごし、午後に練習。夜は一人で散歩することが多い。',
        pianoHistory: '14年（6歳から）',
        style: '精密なタッチと大胆なダイナミクスを組み合わせ、音で物語や景色を描くドラマティックな演奏。',
        favoriteTone: '幻想的・叙情的・ドラマティックな曲',
        difficultTone: '即興性の高い軽快な曲、ジャズ的なスウィング',
        pianoStart: '6歳の頃、小さなホールで聴いた演奏をきっかけに、音によって景色の見え方が変わることへ興味を持った。',
        technique: 'アルペジオ・ペダリング・内声表現',
        selfIntroduction: '「音で、まだ見ぬ景色を一緒に見に行きましょう。」',
        skill: 'ノヴァ・アルペジオ',
        skillEffect: '一定時間、アルペジオ系ノーツの判定をサポートし、PERFECT時のスコアを上昇させる。※数値・発動条件はゲームバランス調整時に確定予定。',
      },
      voiceSetId: 'home-original',
      owned: true,
      available: true,
      progression: {
        affinity: { enabled: false },
        voiceUnlocks: [],
      },
      // Public credits are opt-in. Add an entry only after the credited person has
      // approved the display name/text. Entries can appear in both character detail
      // and the global Settings > Credits section.
      credits: [],
    },
    {
      id: 'character02',
      name: '桐生 奏斗',
      reading: 'きりゅう かなと',
      description: '静寂に輪郭を与える、硝子のピアニスト',
      motionDataPath: '/characters/character02',
      previewImage: '/characters/character02/reference/full-body.jpg',
      listImage: '/characters/character02/list-art.jpg',
      profileBackground: '/characters/character02/profile-bg.jpg?v=20261005',
      profile: {
        age: '23歳',
        birthday: '1月17日',
        zodiac: '山羊座',
        height: '181cm',
        bloodType: 'AB型',
        dominantHand: '右',
        hometown: '兵庫県神戸市',
        type: '静謐ストイック',
        personality: '物静かで慎重。観察力が高く、細部まで整えたい完璧主義者。上品で執事のような気遣いを見せる。',
        strengths: '集中力・洞察力・時間厳守',
        weaknesses: '完璧主義・考えすぎ・人に頼るのが苦手',
        hobby: '衣装・服飾デザイン、コーヒー、映像編集、夜の散歩',
        specialty: 'コーディネート・初見演奏',
        likes: '静かな夜、ガラス細工、整った空間',
        dislikes: '騒がしい場所、急な予定変更',
        favoriteFoods: 'ビターチョコレート、カヌレ、深煎りコーヒー',
        dislikedFoods: '極端に甘いクリーム',
        holiday: 'コーヒーを淹れ、服飾や映像の制作をしながら静かに過ごす。夜は散歩に出ることもある。',
        pianoHistory: '幼少期から継続',
        style: '繊細なタッチと明瞭な音の輪郭を活かした端正なピアノ。',
        favoriteTone: '叙情的で静かな曲、透明感のある旋律',
        difficultTone: '勢い任せで荒々しい演奏',
        pianoStart: '一音ごとの響きと意味を丁寧に組み立てることに惹かれ、演奏を続けてきた。',
        technique: '初見演奏・音のバランス調整',
        selfIntroduction: '「一音ずつ、ちゃんと意味を持たせたい。」',
        skill: 'グラス・カンタービレ',
        skillEffect: '繊細な演奏精度を活かすピアニストスキル。※数値・発動条件はゲームバランス調整時に確定予定。',
      },
      voiceSetId: 'home-kanato',
      owned: true,
      available: true,
      progression: { affinity: { enabled: false }, voiceUnlocks: [] },
      credits: [],
    },
  ];
  const defaultId = 'character01';
  const get = id => characters.find(character => character.id === id) || null;
  const isOwned = character => Boolean(character && character.owned === true && character.available !== false);
  const ownedList = () => characters.filter(isOwned);
  const creditsFor = character => (Array.isArray(character?.credits) ? character.credits : [])
    .filter(entry => entry && entry.enabled !== false && String(entry.name || '').trim())
    .map(entry => ({
      type: String(entry.type || 'contributor'),
      label: String(entry.label || '協力'),
      name: String(entry.name).trim(),
      note: String(entry.note || '').trim(),
      url: String(entry.url || '').trim(),
      detail: entry.detail !== false,
      global: entry.global !== false,
    }));
  const globalCredits = () => characters
    .filter(character => character.available !== false)
    .flatMap(character => creditsFor(character)
      .filter(entry => entry.global)
      .map(entry => ({ ...entry, characterId: character.id, characterName: character.name })));
  window.HP_CHARACTERS = Object.freeze({
    list: () => characters.slice(),
    ownedList: () => ownedList().slice(),
    get,
    defaultId,
    isOwned,
    progression: character => character?.progression || { affinity: { enabled: false }, voiceUnlocks: [] },
    voiceSet: character => voiceSets[character?.voiceSetId] || { entries: [] },
    profileFields: () => profileFields.slice(),
    creditsFor,
    globalCredits,
  });
})();
