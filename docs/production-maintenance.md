# 本番メンテナンス運用（pianogame/pianogame.github.io）

対象は piano-dream-stage の本番のみ。他のリポジトリ・プロジェクトを変更しない。
所有者の実機確認と明示的な公開許可が揃うまで、メンテナンスを解除しない。

## 反映状態と今回の対策
- 検証済み staging: 68fa95fea5c7767f2d44e87578d005d96533955e。
- production-maintenance.json に、確認済み staging のアプリソースの Git blob SHA を記録する。
- scripts/verify_production_maintenance.cjs が一致を確認し、未反映・意図しないソース変更を検出する。
- ビルドで復元される site/audio/pororoponponpin.m4a は一覧から除く。既存ビルドのバイト数・SHA256チェックで検証する。
- Vercel 本番ビルドは、一般アクセス、旧インストール経路、アプリ資産のメンテナンス振分けを検証する。
- 不正署名、期限切れ、異なるスコープ、偽造Cookieを拒否することを検証する。
- 所有者の署名アクセス、Secure/HttpOnly Cookie、ホーム画面用manifest、Cookieなしの専用起動を検証する。
- ガード欠落、全経路matcher欠落、一般アクセス素通しを入れた故障例が検証に失敗することを確認済み。
- この検証は実ブラウザ・実機での本番確認の代わりにはならない。

## 次の反映手順
1. 一般ユーザー相当の本番ブラウザでメンテナンスを実表示確認する。コード・環境変数だけで完了扱いしない。
2. 反映する確認済み staging SHA を固定し、production-maintenance.json の対象ソース一覧を更新する。
3. 本番の middleware.ts、site/maintenance.html、package.json、vercel.json、production-maintenance.json、検証スクリプト、本手順書を保持する。
4. node scripts/verify_production_maintenance.cjs を実行する。失敗時は反映しない。
5. 本番デプロイの Ready、Current、本番ドメイン、反映コミットを確認し、staging SHAと記録する。
6. 一般アクセスのメンテナンスと所有者の最新画面をそれぞれ実ブラウザ・実機で確認する。
7. 自動ブラウザが403で拒否された場合は確認不能と明示し、保護を弱めない。実確認前の完了報告は禁止。

## 終了前に残る確認
- 所有者のiPhoneで、専用ホーム画面起動と最新内容を確認する。
- デプロイ後の一般ユーザー表示を本番URLで再確認する（確認ブラウザは現在403で拒否される）。
- 次回メンテナンス開始前に専用アクセスを準備し、開始直後に上記手順を実行する。
- 解除時は所有者の明示許可を記録してからガードを変更する。自動解除・期限付き解除は禁止。
