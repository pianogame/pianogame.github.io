# ピアノドリームステージ

37鍵・88鍵、ピアノ／エレキベース／エレキギター、エフェクター、鍵盤サイズ調整、壁紙変更、録音に対応するWeb楽器「ピアノドリームステージ」です。

## 公開

GitHubのSettings → Pages → Build and deploymentで、Sourceを **GitHub Actions** に設定します。
`main` の更新はVercelの公開に使用します。GitHub Pages側ではアプリ本体を公開せず、github.io URLからはアクセスできない状態にします。

## ファイル

- `site/`: HTML、JavaScript、CSS、ホーム画面用アイコン。
- `sample-bundles/`: 音源102ファイルを楽器別にまとめたZIPの分割ファイルと `parts.json`。公開時に結合・検証・展開され、元のAACファイルがそのまま配信されます。音質変更はありません。
- `scripts/build_pages.py`: 公開フォルダー `_site/` の生成。
- `.github/workflows/pages.yml`: GitHub Pagesへの公開処理。

ローカルで確認する場合は `python3 scripts/build_pages.py` の後、`python3 -m http.server --directory _site` を実行します。

縦長の表示領域では横画面の案内を表示します。iPhone本体の縦向きロック状態を検出する機能ではありません。横画面にすると消え、「閉じる」を押したタブのセッションでは再表示しません。

## 音源クレジット

- Salamander Grand Piano / Alexander Holm: CC BY 3.0。Yamaha C5の録音をAAC 192 kbpsへ変換した30サンプル。
- Fashionbass / Karoryfer Samples: CC0。38サンプル。
- Black And Green Guitars / Karoryfer Samples・Brian Wood: CC0。34サンプル。

出典とライセンスのリンクはアプリの設定画面に記載しています。

## MotionCharacter / ホームキャラクター

`site/characters.js` がキャラクターとボイスセットの登録先です。初期の正式キャラクターは `character01`。完成ZIPのPNG・manifestは変更せず `site/characters/character01/` に配置しています。ホームの旧キャラクター画像は参照しません。

追加手順:

1. 完成ZIPを `site/characters/character02/` などへ展開する。
2. `characters.js` の `characters` にID・表示名・`motionDataPath`・`previewImage`・`voiceSetId`・`available`を追加する。
3. 必要に応じて `voiceSets` に既存音声の `file`（または `audioPath`）、メッセージ `lines`、かな表記の `reading` を追加する。

一覧・プレビュー・ホーム表示・口パク・まばたきは共通です。キャラクターの追加でHOMEやレンダラーを複製する必要はありません。`available` は将来の所持判定と分離可能です。衣装・育成・ガチャ・DBは追加していません。

- `character-settings.js`: `getHomeCharacterId()` / `getHomeCharacter()` / `setHomeCharacter()` / `subscribe()`。既存の音量設定と同様の端末localStorageを単一アダプターへ集約。保存できない場合は設定を変更せず画面にエラーを表示する。
- `motion-character.js`: `layer-motion-complete` v1のレイヤー順・配置・表示・モーション設定を共通レンダラーで読み込む。母音は2列×3行の口シート。`files.closedEyes` があれば利用し、なければLayer Motion Makerと同じ局所まぶたを使用。非表示・バックグラウンドでは描画停止。
- `character-lipsync.js`: 既存Web Audioの音声バッファ・開始時刻を利用。20ms RMSで発声/無音を判断し、readingから取り出した母音を発声時間に割り当てる。発声区間と終端は実音声時計に同期。母音の細かいタイミングはかな列からの近似で、音声認識による音素アラインメントではない。
- `home.js`: 既存の音声再生・メッセージ・ランダム選択・レア音声を維持し、選択キャラクターのボイスセットを参照。`hp-home-voice-state` に再生中キャラクターID・buffer・context・startedAt・readingを渡す。選択変更・移動・中断で古い再生を止め、遅延ダウンロードの競合を排除する。

検証: `python3 scripts/build_pages.py` の後、Playwrightで `scripts/verify_motion_character.mjs` を実行。追加キャラの検証はテスト内のレスポンス差し替えだけで行い、公開データに架空の2人目を登録しません。既存の `verify_home_voices.mjs` / `verify_home_layout.mjs` / `verify_piano_transition.mjs` も実行します。`MOTION_QA_URL` を指定するとそのURLの正式キャラクターを確認できます。
