# 複製元

AI の判定の土台（LanguageModel との接続・順番待ち・キャッシュ・設定の読み込みなど）は、[youtube-comment-filter](https://github.com/hazymoon/youtube-comment-filter) から複製しています。
共通部分の不具合を直したら、同じ修正が youtube-comment-filter にも要るかを PR に書きます。
逆に youtube-comment-filter で共通部分が直ったときは、ここに書いた差分を見ながら取り込みます。

## 複製元のコミット

youtube-comment-filter の `origin/main` の `0d6b14c61b79988103c57b42658c2f75efe8639e` から複製しました。
作業ツリーではなく、`git show origin/main:<path>` で読んだものです。

## 複製したファイル

### そのまま複製したもの

複製元と同じ内容です（git の blob のハッシュが一致することを確かめた）。

- `src/cache.js` / `src/hash.js`
- `test/cache.test.js` / `test/hash.test.js`
- `.github/workflows/ci.yml` / `.oxfmtrc.json` / `.gitignore` / `LICENSE`

### 変えて複製したもの

| ファイル | 変えたこと |
| --- | --- |
| `test/build.test.js` | 結合の順序の確認を `normalize.js` から `main.js` に、ファイル名をこのリポジトリのものに変えた |
| `test/lm.test.js` / `test/lm-activation.test.js` / `test/lm-recreate.test.js` | カテゴリの代わりに指示文（`initialPrompts`）を渡す。`initialPrompts` の確認は、渡したものがそのまま `create()` に届くかに変えた |
| `test/queue*.test.js`（6 ファイル） | カテゴリの代わりに `test/fixtures/comment-codec.js` の codec を渡す。期待値は変えていない |
| `.github/workflows/release-please.yml` | dist のファイル名を変えた |
| `package-lock.json` | 名前とバージョンだけを変えた（依存のバージョンと取得元は同じ） |
| `src/lm.js` | `ai.js` の `buildInitialPrompts` を import せず、指示文（`initialPrompts`）を引数で受け取る。`decide.js` にあった `AiState` / `AiMode` の型を lm.js に移した |
| `src/queue.js` | `ai.js` の `buildBatchInput` / `buildResponseSchema` / `parseBatchResponse` を import せず、入力と応答の形（`AiCodec`）を引数 `codec` で受け取る。まとめた判定を 1 件ずつ判定し直す条件（複製元の `hide:true`）も `codec.needsConfirm` に移した |
| `src/settings.js` | 値の検証の仕組み（`STORED_OPTION_SPECS` と `parseStoredOptions`）と、`aiEnabled` / `aiBatchSize` / `aiTimeoutMs` / `aiMaxChars` / `aiCacheMaxEntries` / `debug` だけを残した。NG ユーザ・NG ワード・許可ユーザ・リンクのドメイン・カテゴリなど、コメント用の値は外した |
| `src/config.js` | `settings.js` に残した値の既定値だけを残した |
| `src/navigation.js` | `selectors.js` を複製せず、`WATCH_PATHNAME` をここに置いた。Shorts の扱い（`shortsIdFromUrl` など）を外した |
| `test/settings-options.test.js` / `test/settings-options-review.test.js` | 残した値だけを対象にした |
| `test/navigation.test.js` | Shorts のテストを外した |
| `test/build-smoke.test.js` | `MODULE_ORDER` の突き合わせだけを残し、起動処理の確認は何もしない `main()` が例外なく走るかにした |
| `scripts/build.mjs` | 出力のファイル名・`MODULE_ORDER`・`USERSCRIPT_META`（`@name` `@namespace` `@description` と URL）を変えた |
| `package.json` | 名前を変え、バージョンを `0.0.0` にした |
| `release-please-config.json` | 複製元のコミットを指す `bootstrap-sha` を外した |
| `CLAUDE.md` | 共通部分の節を足した |
| `CONTRIBUTING.md` | dist のファイル名を変えた |

### 新しく書いたもの

- `test/fixtures/comment-codec.js`: 複製元の `src/ai.js` の 3 関数と同じ動きの codec。queue のテストを複製元と同じ期待値で通すために使う
- `src/main.js`: 何もしない雛形

## 複製しなかったもの

- `src/ai.js`: コメント用の指示文と応答の形。この判定用のものは工程 3 で書く
- `test/cache-version.test.js`: `ai.js` の `cacheVersion` のテスト。キャッシュのバージョンの作り方は工程 3 で決める
- `test/settings.test.js` / `test/settings-link-domains*.test.js` / `test/settings-options-copy.test.js`: 外した値のテスト
- コメントの DOM・表示・ルールの判定（`dom.js` / `scanner.js` / `rules.js` / `styles.js` / `ui.js` など）

コード中のコメントにある `docs/spike.md` などの参照は、このリポジトリにはまだ無いので、`youtube-comment-filter の docs/spike.md` のように複製元を指す形にしています。
