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
      listImage: '/characters/character01/list-art-v2.webp',
      // Detail view places the live MotionCharacter over the supplied star-palace background.
      profileBackground: '/characters/character01/profile-bg.jpg?v=20261005-touka-correct',
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
