# Piano Palette

37鍵・88鍵、ピアノ／エレキベース／エレキギター、エフェクター、鍵盤サイズ調整、壁紙変更、録音に対応するWeb楽器です。

## 公開

GitHubのSettings → Pages → Build and deploymentで、Sourceを **GitHub Actions** に設定します。
`main` の更新で `Publish piano` が実行され、`https://pianogame.github.io/` に公開します。

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
