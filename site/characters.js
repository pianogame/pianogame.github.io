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
        { file: null, lines: ['おかえりなさい。', '……今日は、少し疲れてるように見える。', '無理してないならいいけど。'], reading: 'おかえりなさいきょうはすこしつかれてるようにみえるむりしてないならいいけど' },
        { file: null, lines: ['さっきまでピアノを弾いてた。', 'ちょうど一区切りついたところだ。', '……君も少し休んでいく？'], reading: 'さっきまでぴあのをひいてたちょうどひとくぎりついたところだきみもすこしやすんでいく' },
        { file: null, lines: ['静かな時間って、悪くないだろ。', '話したくなったら話せばいいし、', '何も言わなくても構わない。'], reading: 'しずかなじかんってわるくないだろはなしたくなったらはなせばいいしなにもいわなくてもかまわない' },
        { file: null, lines: ['君が来ると、なんとなく空気が変わるな。', '……いや、深い意味はない。', 'たぶん。'], reading: 'きみがくるとなんとなくくうきがかわるないやふかいいみはないたぶん' },
        { file: null, lines: ['今日の演奏、いつもと少し変えてみたんだ。', '君なら気づくかもしれない。', '……聴いてみる？'], reading: 'きょうのえんそういつもとすこしかえてみたんだきみならきづくかもしれないきいてみる' },
      ],
      greetingIndex: 0,
      rare: {
        interval: 20,
        file: null,
        lines: ['……今だけは、ピアニストでも執事でもなくていい？', 'ただの男として……', '君のそばにいたい。'],
        reading: 'いまだけはぴあにすとでもしつじでもなくていいただのおとことしてきみのそばにいたい',
      },
      audioBasePath: '/audio/kanato',
      audioRevision: 'kanato-20261004-1',
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
      listImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgwKCA0MCwwPDg0QFCIWFBISFCkdHxgiMSszMjArLy42PE1CNjlJOi4vQ1xESVBSV1dXNEFfZl5UZU1VV1P/2wBDAQ4PDxQSFCcWFidTNy83U1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1P/wgARCAFAAPADASIAAhEBAxEB/8QAGgAAAwEBAQEAAAAAAAAAAAAAAwQFAgEABv/EABgBAQEBAQEAAAAAAAAAAAAAAAECAAME/9oADAMBAAIQAxAAAAFF4pPWsLN/Pc78xzdSsN9btITt8ZXcE7FF8stO9Pap7fPnHpw9Nqy57j3XnsZuc3i22q3Qbc1I4pyXm77j03uS4vNUeYLLRwKeB42BjqgmwaznCPeV3pvqkr6T/OmpPsZ3xQvTneEvjzdUWlx+nn2hKa515ErXWHTER4dqcn28MaVR2pzAcDmuMmWIQBrA1q9VFw731cdVFu8OnhlLp+fM/L7RoLC+3eFXZYb255+8KiVW96n88Lm0gr4Tux5l4U1vmwm3pQ8DZmORsz9M1V6Bu8rhxUytp9CaRTsJ9eCLoN9DYj+jqTJGuF9gUJIODw5aKayIO9xyRm9859BytyNeBzqKv9ApWidPiy85LPZxDuK3Lnz9LRuGZvtCRMhpO4AfC6SQAw5KF6hXgSbODYUdtYWJzP0/zf0PK2s+W5LQMkWXgDfaHMMzusiET22d5WMbYujzwu47zfKwyC2AmO9cuu6le6wM0PuMhikmtJrYofNEnPelvs5Y2BqxrieHALU2JQ3kapMm+9Oagnk8VWVycrTXJzawq98rw6P5bR9MZOE0JV2lBKLJs+KXuRL2lg3LzYoT6k5QrejVNvCYf5k6bXS6SqJvnUXqzi81fDSUXd+TZT4L5Nr+uNbESKYCUcKRknwa8A99CsR6WyQ6Uw5m0nS2LnLlLsxLMZyjCaxY1HLK00kjmj8myiS29MF1Kavepphc5XQsKyo91onu1c2vMyN5+hSEfYfme1LDUmqWrN0zjz096clpdysvoaLINhP5s9Jen7WyCrd6hFzzbfiGlkdtJoiB5DT0uDC42q22t6j65QXooGG5xZmpwoimcjoTlfl68eQffdgGyFu9S69jqz1fpJRkiqehpan9lKvPL03KbVGSIZvA80NRSkkU2WBs8wq8gdzPVicaje2JllDWpwxVo9H3QZ1XorSaEChfY8A34QlLwBh+td+Vq8brcS5zz0dyRcxdL6rmTQvOaen752yoEVDPBFSvLan6jgzyo+3AGfXRZYZ2QeJ7mYyTK417lrF6M5VUCLC4ZqTqdpXaog2nvTa8h5vUxaWw3UjMxzV9PBRN2ZzSe552Y7qHStlXJz2g6xsUfNO6TJMjFs0yr7uQ743RcnHBnx8kMpwuqlc/m8pNY3arWluYn95qRnHRdbN0ikbPN8wPeebNc55WMp9g7wZSWle8HnNjo56gOlI3GJFh20Smpt6danTxwFcvo0ZzrLsHwactr29g9MTI2C8yA3lsMaTxilNxwD/S/K6zckD9bljLEhFHJ40hTT1vpU8yOdWZzL3bTJzzESi9nyrD6PScJi5RLh0JzGN451buxchLsRXTJke68YtFejV1JFGJCyg9voJrfSAnQmB66TnPS8n6AdRfXABfXoncf275/P0kmSZ5rJAcsdd7zgGgkWET2jOv1diCVCkeyfR8z5VjnLLYEMlG1rXXTKCxvOfQDjbLnsoMEWTfNXat3uWHfLivmiflN15TKu+YZ5rFK8ks7nPbSKnGsU4rHaaqnM9MJ/U2K+v7ICX/AP/EACgQAAICAgICAgIDAQADAAAAAAECAAMREgQhEyIxMhAjFDNBQgU0Q//aAAgBAQABBQLGRx6NoatJZYMuXJAHj+0IJM23i/b7PUgWcpmAZxyQoxBUzTGFI9bjmDMKxQCz9Mh2HYIAhh18f1SvjhIOVA/6mf2Qm5rfaMmBqcij9fi6NqRXBU2MEcP4Up1Lsnie1mlfubaypcYaz56xVXs7pgvrsy7gHZVTyS+kBmYtHsLPV7PyWxFAaU1Yrq/9p0XawR8VCywsdpVydSAvj8mofJnDYbE+O6mwseSUZiAzmsNBxyTxa1ScitXjUvsiOK0TR98S58kxgZxV1D2k1DGcaLQc2WOBLeUde3nyUpYytFJrfC2kxiYpKzkf2ooTjBiWrOCxzFXqiwhnckMSJW+LXXD/APTASik2m+o1vWu4s49SqlZlv7n8fjhUS6zc/MziYJKM1TVchbGtqYMRMQKGWxTbWKa1V6HCnM8raIx8jt7J8tickZspTMtGJQDaiWLYv7UZ77bJRZWrtyUUm3MJdye58xUyWIWbSt0YKNkxDUBOPOS4FlLCGw5ZfMvj60ZDgzYa4ybKjiu3VRT5IxIsoTDW3VOil49gMysOQs8TeOpNo5xNcx01M4VvtftsqZNGN2BS2qXaCqpspautoDua6sx0qUi0KeRaWSpS8LGP8koBsxgIMKzYCfY0p5L2VSqDx0fYqgorJySBKOr712sFQnaMtiWgKFSwbhVCS5/2bO0JWV17lqJZXl68IHu2dujTSLBr5Tb4qVGxLJ44rFZxzjkY8k19rH8VjNsNcw/OMOGJlXQuBLMyZDszYAlrCpOzBgLgY1aUNm3kMvkDgg9wUvZGzrTWtgtHjZczE+B/xwslY6B4tQDcgVoqAMw/Zfn328dZcMAO9TB1SzFpxwHNyqrfBrsZF2aKxqfJMVCT521ekVyr9bXv5ioBjVpHYA1Ya6saD82VhpyVWtOLVla19+SBtZrtoNRsJ/IcDy5i2YPkJjbgP5M6NGUCwL1n9tWFsdi7VIpYNSpe7aH5xK3Wu/YMgOwcskVt4WCy9t5xHImhaWj9liksU0QMc953AiMRb3nbaNDkrf8Abi/ZamZra2SwgIO51FGDr1piONmBequjlrlrq8WcyccktyPsG9K7QSr7F6sxk7euOpEYBV4/bW/P/QX2sVWXkVGcY4Zb8Tm2p4dP147XGUh6i+svX1wWnHA8vzZjuhju9HpQdlqI8VreJ05O7CwOL18ZrDM1iypmWWKzj6lXJssGBdOKuz+NAL2Luqlo6BEidQ/VjB7SsdlQIoEfjNE/XajYmhCC/dGGiVdNQoCtX5HRNbrAmjDWeRlX11+SrrnkCUer+ZVrtPdRVaXY4QdDE/4b4DdiFcn1wjYRx5KQ5wip4rU1cKdVYFsRPn/NMvya9IKwavHAPYqdrqzrnxxdnjqVI6N/UT6rFj/1ou0X4QwtKbcRAFttqKlLdJ/IZoj9UVhiv67MjVjmuq2xDcgaLV6rWABWPIQs5TKK7GlD6teoausEy0DdfoJnDW9QZNf3rBmQQQdkYCcj6nuDE4/jKasjJi2WXEAHYGxobya15LKF5RMu6Q3u0tsycStMr5Ghs1X/AAfQfDfVzmBYW7B9BZPLK7NoHD1J63WLFQlarSZXUXnKpVBX96h5HvTUFRECaA5DMKyfuEaX8Y1UmFfewe//ACICIy9r25Xogj89mcX+yz1tf+tf6kxt/KwtlptOuRWTS/KctPqVGazmXkbKSsrOTfcbGnFXa7kVGuz/AFeoSDMQIyxZZ7HGIBmePMoUiXAOPkaxV7c+3jxXx7NTx1y6uULVJaMaVeFUWz3saZwGGJVx3siZrsssFtWe/mCAmaVyyqsE1HDCdrFMQmL2Qg2xlnXxjWP9dTnjPvPEWc5pitmvluWP1mCYFLE1kQW+Isva/a1PxnE2i5MJgKrZbSXOIK/WA4i2YjWnCcpCqAOAqgoCX/qvrY1ywmxr/Sp9dvJW0svpCM5Mppa1mrfZlNUq1KFQZdx9AW72E2jMYzZZbnWccNyAaCR/HeeBprpLe0UVa8bl11IedSYeRx8F6ma29DKbVM5liA01pa7GsXjLvfY84vJZFd2cl1YBQC2duRb6/E6gHWDCq48eJxseHMz+Mz/yBUIdoC09odsV17NRx0exjWt1jqz7JqrKJxLlrD2bM1rFRY4iMfEqbTlWaVnsk5b6kZwWYwQHqixlnl9kcg2bKc71cx/JP9C5/K9QtqNu5/lSbs9NqJ/rQQ1BaWOg5FnkYnvMOT+H+8T7A4A8ZhbFLNmlLk8nOwrYnjK1YlHGax7afEyIGe9EWzAhUA1+srcWJzqgrWfegVkpe+OTdsw7OMKDlT9x3D26wfPjYipWxY1Qh5FKIvJpU2WeR+EjvOTezJmcRtDyGJf8cfU3XeNnuVFq8rJHu8yH7J9nOik9J0zYgbBPZBYL3PmVnV/I4bP4Pzk/irkGmpjkvrtt+v8ANfUz04lnzwvFs/3ScgwwfOpeAYh+3Ux+P/nqY9DV1/iusuzrhmVlXEZCpKEVAQAbYGbQgCrkuCXKMWooewsurD4t+ETyPZQ9Lt/SI3zAMzVY+AOO6B+RcbH3OoJlNzVRmJI2c2Lo8b8VgeRR3nMoWv8AjWfelDY9Xkq41bO9oKbWdspxH5TWg9QY0f5/Cy77Rjn8LNSZrgq2hC7H+MTHoKQASnTfiVJcdUNlVFe/8fe2jjuxfyJx+AmbOUMXt8if7oTWsb6/hB3aO6UV7GrBtZALbVCytqRLPaymoPZ/FrrraxVFt28B6q6nHu8E9SV5CpFsVW4XjAuQG7lfou5FWLCMD8KrFf8ArErTdlTMo18pfDraPJudizGMxMz1CuILCJ5IzAtWFZ0xNHw6anUz1049iJxs4B5DqGWq2mynEIxFXMP9QAMY7Stgo362OGRguYqd1qGalQzKPQ6+Nmjdn8ITnj6ubOMBL7S7vQksqdIvrTjqw+1ate9LmqKU5JathLG9fiGV1bJdUA5XvknaOVyH2tBmxAg9REpJhEHZoU7VqtXJ5PK1eyzNmdnquO7pXbL+KlSOvttoLYPjhJmm7jrsa9YcmZ1rclyARCXxMxcEyqreU1btZjdrFCziUbsqATkEfyVf99u1l1ZIc/rt41Z132d0Hk5tKKMEtWuzp6VnuWugpQUWh6GrCINTxw8tRq2MxColaAuMinYIrMJ1BKr66625uZ9jQyq1bpbL9ja/j0FzpSjetCukNGWTIHFasPkNHOq2Pk8NQ93JvNVgbdQcG6sW1tURNeh2zt1N2wfiqvY3jBlVRaWNWvF+ZxLtJbxbGlZQVP8AWitEKiWMDLvUcVcF7iLrbjqRE9ASWPH/AKwMz6RrsWNVVYLOLrGTEP4Mp+lnboMsjimyy4u8Q4VrrUZAXPLqWpE9SeSyCzk7j//EACARAAICAgMBAQEBAAAAAAAAAAABEBECIRIgMUFhMFH/2gAIAQMBAT8BLhnFsqhs436Kj4NnyK5IriJbGM9LEZOnoTLdjZotUJoxZtuK61cN0i30SMl0WNlFCOOyitFQsRGQhwunsbKsqosX7HpZihI8jEsssuPpTGKPBssRVRqhej9MsqH6OF0aEMWkXZWxmS2VsbhQutFih9FNnIc+lidliMhKa6cRqUOF+xZcaPJvpcOEuvEfRsRlr+F0NlKjEbhKi04fXcvqo+jl+F66UxFDR4j973CGxRce/wA0j4UNCEJWxoSseNTUYL/TJiUWUIRezFmQ0VNGkWPYtM16z//EACQRAAICAgIBBQEBAQAAAAAAAAABAhEQIRIxQQMTIFFhIjAy/9oACAECAQE/AX+CQhHJHuLwcXdsvixkdiRexLZaizkpDdIrRG9v4QXJbJIe0QjQ7FCXMaaQ19mksbSF1i8Qnxx26Kd484k/5E7Qx7xKVFieFOojfFnK2Rds2OuiUv40Rv4TQi8cdYdFqCs5olKys9Y9T4R2yiURooS0eDSHlOz20zilirNo7o9T/kitECPQ5XpDGIQy35LQh70SlxZy1RFqhUy6QoPsZIReHl/pxpkj+hJj+iM9UxskI8ibLzL8Pw4PkThxJaQyJsmI7OspkmNF29knolLEa8l+S0xxrNpPLf0e4On2N+EOJrDXEXRZyWJQaxFP40KG8JPyXjzhjrCJEcchEdMfxrKKKxGPk87F2PvHjD6LxR4ODKEitUJdo8YeWssWmSneLORHtlUqY/3/ABop0RX2NasgSb8EnbIsbFsZebELXY1uz8I97wyyVtHpqkM5cXsUiz01bJ9m5MjH7Ej9FG3Z/8QALhAAAgECBQMCBQUBAQAAAAAAAAERAiEQEjFBUSJhcQMyIIGRobETI0JSYnIz/9oACAEBAAY/AsEtex+0oix1tkaVO89i/tXwX0I2Yp1E6PbTdmXSvYcq5KpcDmpabH0QoLF7eWJJ3kaa3P0/oTuif41kRcj+R3q/BPquOxFKy0ofqVa6LCmmq/ct/IyxsQhP8k5klzJH3Q4vCgjSlCppunsdfT+R+oqU9mRr5HzwUU/PCO2FD2kqnSTpF6n1HR9CmrNldQ6pz9kX1M1RYXprSk6qo+Q3S07QeLIpqk6LPd8E1a7STVc0E2pehfccKEXsP03pUWs0KpxM8EXlawe/vdDeaif+j+Ef9Gvy1LZvCR7KiqjK7idVVK+clV23S7ScYZdh1v8AiZGrt6l0ULR1XYpStuNyft6f2JbIpuafUipabodLWi+pxhmWzKql/JSS9Sqol3Xcn7EwU5t2NcbEyUt8lWx/1STJFThFvaL06fNQ6nNiXZDy2WibIlZjPW5SO3BfQthKMtaVM7jnH0vuU00xC3Y6XUmzpyxwkXV/BkRTmvccF9CxPKk9N94FyLM4pp0P06rte2SqKIIvYzV5n5uN0+7mCyLvDsWP7FxU1JJ/2FTM9NmREnXV8kKhWIT0JaHTUhuOpfcnYpXzwiMPSqh6XMqUXM7URpG5GlKM1Vu45qhr7nRRblkNUrnKe1n9VhmixZSZONcIeGRjWxA+dENNSaSVJ6nR7kNFk2dVSSP5VfYmmmmk9LhihaVIyUjnbY6U35w65fgtobl7+Sml6FaiFBbfQhafk/Ur92yL4ItuKlXv1Mk2z4NR8ynIvLKoVPkjUjQh1RA278Ho0xZK5LtfcijpT1ZbUdVTilEUKKVuZVTNXcsbSWiRVPRFUez8i4R+56dLXYzznp27Hf8AGCIWw9PkW04O/CFlsWquyzu8HOoo1ZbQTbJp6qir9SZ2OBuhW5Muaw6aaupGV6lrYfg7lUttbYXG+TZHvT3ueWVZXA53IbjyNu9jdGa3zJdSkSqqVuC1RaWQ4v2IpsOKsHOwvSpR1uPuZqPUpngTrihnRfudXq0+KTopgpVegl8EFP8AZaRsZtzqFwRaBtM9zNn8j2oSyI9qE4FO5fBxwN8k61bLC9SS3ZrJf28ImIwVVSZmpZJbTgmGi46oep/0TJBYh2IzshEZhXsNt2LVXKX2E7QLxhakT0LXeFj/AF+Bcs8Yd0Q7EupH7ajuyqqpyzLzcoq/qy6aOqKu6J9Oo/ccDy3UjREXwg6T08ysUqkp00wipfQSWrM1T8LC2ElJKJE6lYvvhVlhzyT/AC5HR/L8i5i4nQlJfp7o60o5Ol3ZUlxcuNJwZostyws1RKd8HHBVm2G2QtEpKN3UMnBEEd8IZNN0dS8lXptirp1HTVryU1bvCTPT9CqNj/WGVaM0vhTTV1OMG3pBVm92+FTbjYoq4VhjjBMSw8nD4OVuPmky1fUVy2h0VZqe5SvUt4LaHSmdyGowmbmjEW15wb4/Iy5FezO2slWNXlEtwvJKUrksSteD8mvTUNalpTLpfQvTb/JVo6Y3GtYumXsoEp3L9VPkT5Iw8CHa70ITsiHvhVVzyZVYfnGOR3sihU607EF8I2J3ROpaUxyuozUacCrVkhUrYt9MPmbfQi30FXSz3M8WJKqpSg1IVsPnjQPthm74XNY8ncRmM621Mu5U9Ex1S8zNY4ZpJCRuVPc7GZqZ0Om4nFmJvcsQNLQXnHsPhliHjrpg/wDOFRLLI6hWuSiyNZK2ZUdLsrIlWeGtlphTOHgnDtB2eE4xIrkrWBJY1RoJmV3nQaZl1ix02qHTlHVUdPyLYzosO45wthrHy1PdUhxU+cLq+PPnQlmw+cPI4/iS9UrlTXI2xT9SqK7bIuSWU+Dqt5Ip9TN4WHYzR8MVJP5iyuPI6vT6l2LzIrRPwXyoiueJOhyTWTyyxeWyFHzITSn7Hu8RcWdVPuU5PTvvJ2e0nSiIZZSXOLDro03WHBqTGFqia0n3ErWNDRl5Q+B5qqk/BlSdTIrpfzM11sdFX2Leop8CTru2RmWnBE21bOilVUrlnT6dOpTOVWtCKpqmxMtljhsdrDWxf4Nbja0RTHw0rR1HYhYa28iTrpS8kP1FBapx4H7j21T5PYn5Y26FoTFP0In7FqmRES9Tr17GUl7FzgV3cht4dxw+5El9CaSV7ken21wtjmI31eMiXI7You2avsKCOBOlXW5LmWKdCryM+RTV8mZ3wae4pqI5MqwmHfDLoVS9EXqiRqmqUakSJpkozU7jg6tS90MnBuaZ4g8EL4HTl2FMW1P/AESsOnO65V7Da9HN5Jga0o3KadlhmHOuNObTc9R0uFNj04fU9SzgpVWqL4+cNS0fQY6U7PUujuZ1qrmbM55+DXCpLfDolruR8DeFM4VfqcDjB42WhceN1I2pvYvqKqu07GuGWmltkZYgWah30ND2wT03ZrSe6k9y+gsvq01W4PchLMsHCIYxCpVpIqFGzv8ABrgkZqlpoS0Rb6YOpaktiWplnTC2HVpjU2+ucIRV6tLavBaG3yfuJ/IYoFTXFtxml5+GMFbHQ6rGZO5uzhEt2NzqVUQVKKtCJjyOn9S3I6aXI3RDP0nzJU+EVruZsc+w/gtqOqvVkXMtMETYtodUvwVNaCVVSpXJNDnDhDuN5tuB5b23Jb+46VliIRmot4K3RVPkoyxEXhn7fB1Pqd8FhbTCCB3J2RnqV9kZvb2Ji5oi/wAUpQi8HuqoLZfVnjUhp0vvh/rmT1InS8kp7kO8rcVVVXW+509dPbGYUQOqr7ExoVfgtYgzPCmdxpscqbD8i/sJVX5OMEaSZW48lLotlOqlVUiVLdNUaVHVSNRqLDKtTOX6XyJaoyIjB1FNNKEQtEpHGhS+MGp1wnfbCalFrSPCIFmFTQy6juiZzQtRUu/p8DXpOGK81Fyd+CCFudWh0l1JCsuxlRm0gb32IcxjfBvZENwRol8ymFO0PCXoWRKE+46suEV2fYz6Cp9Sq3Isvs5KXQXLEYdyzy1EtSIsQ/g3+RlgjT8kKnFIikbJfpqpcs6BzYpyS6t5NbDh/IlKUxOrppxsPBZhKjTgTwncuiS+hFNlhE/DLsuTL6dMvlnVUPKjM3fgrpqp6thFDqqu9uDsZTKSz9sy1a4T8OVqxwWU/CsOlSzriuo4WN3c8lMPqFVVp+RV1R1aUltT/8QAJhABAAICAgICAgMBAQEAAAAAAQARITFBUWFxgZEQobHB0fDh8f/aAAgBAQABPyF8omv93xL/ACaqMOKFPMWFk4cTJBynWOSK0S4cbJfOSCpfBWYXQ0dxo6PI1EhazwRHyIFaGWtX4nQbfiBqnbj7hVOeGcDiqv8AZ/kFUYJRQn4iXmQXnFwJR4spuDYrP7/+yspk1MK9YPTC1ZUaiyhyib+2Cy4e8v8AgDmKecE6WeWU+Afaor4Zd460QM5izfMMVdaYaBN5FAC+iEBRpezceMlizXxKQ7FRtii3ZlzZyNZEU6FsoUePEGtf2QN+3QhxFWq+/wDCYzeiWplF0jslcbDfd6jopRZ+dTEbhRueWD7T7ni3QBm+4y6DP+kQtWpmCnWoXoTOGHPuW2SvkTd4EjK6VS+jEzAotDzCShaWkKyXXBZZcxfUMKodQsPFs7JUXaV0c/MEOnOP9mRal4OI3R9fMs2yYer8CC0nayl0C+QRjIGqoRrWDsThl9HD5mir/kwaxWYKuV36Xk5iZm9ZPomMAM+zqZ4bgamlwPNvcHiq/niMRNg5RiluPUanyC+JXivHAMAui5ZBTsIXLu1WOofTmZfEO1ROwfsSqRSyWj1P/9k=',
      // Detail view places the live MotionCharacter over the supplied star-palace background.
      profileBackground: 'data:image/jpeg;base64,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',
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
      profileBackground: '/characters/character02/profile-bg.jpg',
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
