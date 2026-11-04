# 開発

```sh
npm ci
npm test
npm run lint
npm run fmt
npm run build
```

`npm run build` は `src/` を結合して `dist/youtube-content-filter.user.js` に書き出します。`dist/` はコミットしません。
CI は lint・整形（`npm run fmt:check`）・テスト・ビルドを確かめます。

## 手元の dist を実機で確かめる

実機で確かめるときは、開発用のビルドを使います。

```sh
npm run build:dev
```

`dist/youtube-content-filter.dev.user.js` に書き出します。`@name` は「YouTube Content Filter (dev)」で、`@namespace` も配布するものと違います。
Violentmonkey は `@name` と `@namespace` の組でスクリプトを見分けるので、Release から入れたものとは別のスクリプトとして入り、「値」タブも分かれます。
確かめるための `avoidTopics` を書いても、普段使いの値や判定の保存には混ざりません。
自動更新の URL も外してあるので、Release で上書きされることもありません。

Violentmonkey にローカルの dist を追跡させると、`npm run build:dev` のたびに読み込み直します。

1. `chrome://extensions` → Violentmonkey の「詳細」で「ファイルの URL へのアクセスを許可する」をオンにする
2. `file:///<リポジトリの絶対パス>/dist/youtube-content-filter.dev.user.js` を開き、ローカルのファイルを追跡するチェックを入れてインストールする（worktree なら、その worktree の `dist/` を開く）
3. インストール画面のタブは開いたままにする（閉じると追跡が止まる）

開発用と Release から入れたものを同時に有効にすると、両方が同じ動画を判定して表示が干渉します。確かめている間は、Release から入れたものを Violentmonkey のダッシュボードで無効にします。
ブランチを切り替えたら、`npm run build:dev` で作り直します。

「興味なし」は YouTube のアカウントに送られるので、開発用でも普段のおすすめに効きます。確かめるときは、送ってよい動画で行います。

## リリース

[release-please](https://github.com/googleapis/release-please) が、main に入った `feat:` / `fix:` からリリース PR を作ります。
リリース PR をマージすると、バージョン・[CHANGELOG.md](CHANGELOG.md)・タグが更新され、dist を添付した Release が公開されます。

Release は下書きで作り、添付が済んでから公開するので、途中で失敗してもインストール URL は前のリリースを指したままです。
下書きのまま残ったときは、ワークフローを再実行しても添付されないので、タグを checkout して手で添付・公開します。

```sh
npm run build
gh release upload <タグ> dist/youtube-content-filter.user.js
gh release edit <タグ> --draft=false
```
