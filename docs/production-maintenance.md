# 本番運用（pianogame/pianogame.github.io）

対象は piano-dream-stage の本番のみ。他のリポジトリ・プロジェクトを変更しない。

## 現在の公開状態
2026-10-04 21:49:01 JST、所有者から「確認出来た。一般公開宜しく」と実機確認完了と一般公開の明示許可を受領。
確認済み staging 0e6fc0f1e3dd86b73c5dadee0dc65ebbcedda6c8 の内容を一般公開する。
プロフィールを閉じた後に設定へ専用ボタンが残る修正も含む。
production-maintenance.json の mode は public、middleware.ts の MAINTENANCE_ENABLED は false。
旧所有者専用アイコン・リンクとmaintenance.htmlは通常ホームへ案内する。
所有者の指示により、こちらでの再現・画面操作テストは行わない。

## 再発防止
- 確認済み staging のアプリソースのGit blob SHAを production-maintenance.json に固定する。
- 本番ビルドはソース一致を確認する。ビルドで復元するpororoponponpin.m4aは既存のバイト数・SHA256検証に任せる。
- メンテナンス中は一般アクセス拒否、不正署名・期限切れ拒否、所有者の専用ホーム画面起動を検証する。
- 公開時は明示許可の記録と公開フラグを確認する。実機確認の代わりにビルド成功を使わない。
- デプロイのReady・Current・本番ドメイン・コミットを記録する。
- 一般ユーザー相当の表示を確認できない場合は未確認と明示し、確認ブラウザの403を回避するために保護を弱めない。

## 次回のメンテナンス
1. 開始前に所有者の署名アクセスとiPhoneの専用ホーム画面起動を準備する。
2. modeをmaintenanceへ、MAINTENANCE_ENABLEDをtrueへ変更してデプロイする。
3. 一般ブラウザでメンテナンス実表示、所有者の実機で最新画面を確認する。
4. staging反映時は本番のmiddleware、maintenance.html、package.json、vercel.json、ソース固定情報、検証スクリプト、本手順書を保持し、固定staging SHAと各ソースSHAを更新する。
5. 実機確認と明示的な一般公開許可が揃うまで解除しない。
6. 各段階で状況を報告する。待機中も1分を目安に報告する。
