# おすすめの動画の DOM 構造（実測）

工程 3 で動画の枠のセレクタを決めるための記録です。
2026-11-04 に、macOS の Chrome 156 で、ログインした状態の YouTube を Claude in Chrome から page 世界の JavaScript で調べました。
ウィンドウの幅は 944px で、動画ページは右の列が動画の下に回る 1 列の配置でした。
YouTube の変更で壊れうるので、セレクタは `src/` の 1 か所の定数にまとめ、本書の該当箇所を根拠として参照します。

記録には、動画のタイトル・チャンネル名・動画 ID を載せません。
おすすめの中身から、閲覧者の関心が分かるためです。
件数と、読み出しが一致したかどうかだけを書きます。

## まとめ

| 画面 | 動画の枠 | 部品 | 判定するか |
| --- | --- | --- | --- |
| ホーム | `ytd-rich-item-renderer`（中に `yt-lockup-view-model` か `ytm-shorts-lockup-view-model`） | 外側は古い部品、中身は新しい部品 | する |
| 動画ページの右の列 | `ytd-watch-next-secondary-results-renderer` の中の `yt-lockup-view-model` | 新しい部品 | する |
| 自動再生の次の動画 | `.ytp-autonav-endscreen-link-container`（プレーヤーの中の `a`） | プレーヤーの部品 | する |
| 終わりの候補 | `.ytp-videowall-still`（プレーヤーの中の `a`） | プレーヤーの部品 | する |
| 検索結果に差し込まれる棚 | `grid-shelf-view-model` の中の `.ytGridShelfViewModelGridShelfItem` | 新しい部品 | 工程 3 で決める（後述） |
| 検索の本来の結果 | `ytd-video-renderer` | 古い部品 | しない |

新しい部品（`*-view-model`）と古い部品（`*-renderer`）は混在しています。
同じ部品の新旧が並ぶのではなく、画面と役割で分かれていました。
動画の枠の古い部品（`ytd-compact-video-renderer` など）は、右の列には 1 件もありませんでした。

## 新しい部品 `yt-lockup-view-model` の中

ホームと右の列で同じ構造でした。

```text
yt-lockup-view-model
└ div.ytLockupViewModelHost.content-id-<動画 ID>
  ├ a.ytLockupViewModelContentImage[href="/watch?v=<動画 ID>"]   … サムネイル
  └ div.ytLockupViewModelMetadata
    └ yt-lockup-metadata-view-model
      ├ div.ytLockupMetadataViewModelAvatar                       … チャンネルのアイコン（右の列には無いことがある）
      └ div.ytLockupMetadataViewModelTextContainer
        ├ h3.ytLockupMetadataViewModelHeadingReset[title]
        │ └ a.ytLockupMetadataViewModelTitle[href]
        │   └ span.ytAttributedStringHost                         … タイトル
        └ div.ytLockupMetadataViewModelMetadata
          └ yt-content-metadata-view-model
            ├ div.ytContentMetadataViewModelMetadataRow           … 1 行目: チャンネル名
            │ └ span.ytAttributedStringHost                       … （ホームでは中に a[href="/@<ハンドル>"]）
            └ div.ytContentMetadataViewModelMetadataRow           … 2 行目: 再生回数・投稿日
```

- 動画 ID: `div.ytLockupViewModelHost` のクラス `content-id-<ID>` から読む。タイトルのリンクの `v=` は、Shorts（`/shorts/<ID>`）やプレイリストでは無いので使わない
- タイトル: `a.ytLockupMetadataViewModelTitle` の textContent。`h3` の `title` 属性と一致した（ホーム 22 件・右の列 20 件のすべて）
- チャンネル名: 最初の `div.ytContentMetadataViewModelMetadataRow` の、最初の `span.ytAttributedStringHost` の textContent。ホームでは 22 件中 20 件がチャンネルへのリンク（`a[href^="/@"]`）を持ち、右の列では 20 件すべてがリンクを持たなかった。リンクの有無に頼らず、この位置で読む
- 種類: データの `contentType` で、動画（`LOCKUP_CONTENT_TYPE_VIDEO`）とプレイリスト（`LOCKUP_CONTENT_TYPE_PLAYLIST`）、検索ではコース（`LOCKUP_CONTENT_TYPE_COURSE`）を見分けられる。プレイリストの `content-id-` はプレイリストの ID（13 文字）だった

DOM から読んだ動画 ID・タイトル・チャンネル名は、データの次の値と一致しました（ホーム 22 件・右の列 20 件のすべて）。

| 値 | ホーム（`ytd-rich-item-renderer` の `.data.content.lockupViewModel`） | 右の列（`yt-lockup-view-model` の `.componentProps.data()`） |
| --- | --- | --- |
| 動画 ID | `contentId` | `contentId` |
| 種類 | `contentType` | `contentType` |
| タイトル | `metadata.lockupMetadataViewModel.title.content` | 同じ |
| チャンネル名 | `metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0].text.content` | 同じ |

右の列の要素にはホームのような `.data` が無く、`componentProps.data` が関数でした。
読む場所が画面によって違うので、DOM から読むほうを第一にします。

## ホーム

```text
ytd-browse[page-subtype="home"]
└ ytd-rich-grid-renderer > div#contents
  ├ ytd-rich-item-renderer                       … 動画 1 件（中に yt-lockup-view-model）
  ├ ytd-rich-section-renderer                    … 棚
  │ └ ytd-rich-shelf-renderer
  │   └ div#contents > ytd-rich-item-renderer   … 棚の中の 1 件
  └ ytd-continuation-item-renderer               … 続きの読み込み
```

- 調べたときは、`ytd-rich-item-renderer` が 28 件（棚の外の動画とプレイリストが 20 件、棚の中が 8 件）だった
- 棚は 3 つ。2 つは Shorts の棚（`ytd-rich-shelf-renderer[is-shorts]`）で、中身は `ytm-shorts-lockup-view-model`。1 つは普通の動画の棚で、中身は `yt-lockup-view-model`
- 普通の動画の棚にも Shorts の動画が入っていた（タイトルのリンクが `/shorts/<ID>`、`contentType` は `LOCKUP_CONTENT_TYPE_VIDEO`）
- 動画ページへ移っても、ホームの `ytd-browse` は DOM に残る（隠れているだけ）

### Shorts の枠 `ytm-shorts-lockup-view-model`

```text
ytm-shorts-lockup-view-model
├ a.shortsLockupViewModelHostEndpoint[href="/shorts/<動画 ID>"]   … サムネイル
└ div.shortsLockupViewModelHostOutsideMetadata
  ├ h3.shortsLockupViewModelHostMetadataTitle
  │ └ a.shortsLockupViewModelHostEndpoint[href="/shorts/<動画 ID>"][title]
  │   └ span.ytAttributedStringHost                             … タイトル
  └ div.shortsLockupViewModelHostOutsideMetadataSubhead          … 再生回数
```

- 動画 ID はリンクの `/shorts/<ID>`、タイトルは `h3 a` の textContent（`title` 属性と一致）
- チャンネル名は表示に無い。判定の材料はタイトルだけになる

## 動画ページの右の列

```text
ytd-watch-next-secondary-results-renderer
└ div#items
  ├ yt-lockup-view-model                         … 動画 1 件（包む要素が無い）
  └ ytd-continuation-item-renderer
```

- 最初に調べた動画で、`#items` の子は `yt-lockup-view-model` が 20 件と `ytd-continuation-item-renderer` が 1 件だけだった。古い部品は無かった。ほかの 3 本でも `yt-lockup-view-model` は 20 件だった
- ウィンドウの幅が狭いと、この部品は `#secondary` ではなく `#below` の中に置かれた（`div#columns > div#primary > div#primary-inner > div#below > div > div#related`）。位置で探さず、部品の名前で探す
- 右の列の上に話題の絞り込み（チップ）が出る動画は、今回は無かった。チップで切り替えたときの構造は調べていない

## 自動再生の次の動画と終わりの候補

どちらもプレーヤー（`#movie_player`）の中の要素で、polymer の部品ではありません。
再生が終わったときに作られます。

```text
div.ytp-autonav-endscreen-upnext-container       … 自動再生の次の動画（カウントダウン付き）
├ div.ytp-autonav-endscreen-topbar-container     … 「次の動画」の見出し
└ a.ytp-autonav-endscreen-link-container[href="https://www.youtube.com/watch?v=<動画 ID>"]
  ├ div.ytp-autonav-endscreen-upnext-thumbnail
  └ div.ytp-autonav-endscreen-video-info
    ├ div.ytp-autonav-endscreen-upnext-title     … タイトル
    └ div.ytp-autonav-endscreen-upnext-author    … チャンネル名

a.ytp-videowall-still.ytp-modern-videowall-still[href="https://www.youtube.com/watch?v=<動画 ID>"]
├ div.ytp-videowall-still-image                  … 終わりの候補 1 件（再生が終わると 12 件出た）
└ span.ytp-videowall-still-info > … > span.ytp-videowall-still-info-content
  ├ span.ytp-videowall-still-info-title          … タイトル
  └ span.ytp-videowall-still-info-author         … チャンネル名
```

- 動画 ID は `href` の `v=` から読む
- 終わりの候補 12 件と自動再生の次の動画は、どれも右の列にある動画だった（2 本の動画で確かめた）。右の列の判定のキャッシュをそのまま使える
- 別の動画へ移ってから再生を終えると、終わりの候補も自動再生の次の動画も、前の動画のときと別の要素だった（使い回さない）
- 自動再生のカウントダウンは `.ytp-autonav-endscreen-upnext-cancel-button` で止められる。調べるときはこれで止めた

## 検索結果

```text
ytd-search[page-subtype="search"]
└ ytd-section-list-renderer > … > ytd-item-section-renderer
  └ div#contents
    ├ ytd-video-renderer                         … 本来の結果（古い部品）
    ├ yt-lockup-view-model                       … 本来の結果のプレイリスト・コース
    ├ ytd-channel-renderer                       … 本来の結果のチャンネル
    └ grid-shelf-view-model                      … 差し込まれる棚
      ├ yt-section-header-view-model             … 棚の見出し
      └ div > div.ytGridShelfViewModelGridShelfRow
        └ div.ytGridShelfViewModelGridShelfItem
          └ ytm-shorts-lockup-view-model-v2
            └ ytm-shorts-lockup-view-model       … 構造はホームの Shorts の枠と同じ
```

- 本来の結果と差し込まれる棚は、`div#contents` の直下の要素の名前で見分けられる。棚は `grid-shelf-view-model` で、それ以外は本来の結果
- 11 の検索語（料理・楽器・動物・旅行・ゲームなど）を試したが、「他の人はこちらも視聴」のような、検索の内容と関係なく混ざる動画の棚は 1 つも出なかった。古い部品の棚（`ytd-shelf-renderer`）も無かった。調べたのは最初のページ（続きを読み込む前）だけ
- 出た棚はすべて Shorts で、見出しは「ショート」か、検索語に近い言葉（「ギター」「鍵盤」「生活様式」など）だった。検索の内容と関係のある棚なので、判定するかは工程 3 の前に決める

## CSS だけで隠せるセレクタ

判定が終わるまで枠を隠すには、スクリプトの処理を待たずに、DOM に入った時点で隠れている必要があります。
`@run-at document-start` で `<style>` を入れておけば、後から DOM に入った要素にもその場で当たります。
次のセレクタで、それを確かめました。

| 画面 | セレクタ |
| --- | --- |
| ホーム | `ytd-browse[page-subtype="home"] ytd-rich-item-renderer` |
| 動画ページの右の列 | `ytd-watch-next-secondary-results-renderer yt-lockup-view-model` |
| 自動再生の次の動画 | `.ytp-autonav-endscreen-link-container` |
| 終わりの候補 | `.ytp-videowall-still` |
| 検索結果の棚 | `ytd-search ytd-item-section-renderer > #contents > grid-shelf-view-model .ytGridShelfViewModelGridShelfItem` |

確かめたことは次のとおりです。

- 当たる件数が、各画面の動画の枠の件数と一致した（ホーム 28 件、右の列 20 件、終わりの候補と自動再生の次の動画で 13 件、検索結果の棚 37 件）
- 検索結果の棚のセレクタは、本来の結果（`ytd-video-renderer` 22 件）に 1 件も当たらなかった
- `MutationObserver` で、DOM に入った要素を入った時点で調べると、すべて隠れていた（ホームで続きの読み込みの 224 件、右の列 20 件、終わりの候補と自動再生の次の動画 13 件）

### 隠し方は `visibility:hidden` にする

`display:none` で隠すと、枠の高さが 0 になり、YouTube が続きを読み込み続けました。

| 隠し方 | 開いた直後の件数 | 4 回スクロールした後の件数 |
| --- | --- | --- |
| 隠さない | 28 | 124 |
| `display:none` | 100 | 238 |
| `visibility:hidden` | 28 | 124 |

ホームを開き直して、同じスクロールで比べました。
`display:none` では、スクロールする前から続きを読み込んでいます。
判定が終わるまでは `visibility:hidden` で場所を残して隠し、likely と判定したものだけを消します。
消した後も同じことが起きうるので、工程 3 で、消す件数が多いときに読み込みが止まらなくならないかを確かめます。

## 調べていないこと

- 幅の広いウィンドウ（右の列が動画の横に並ぶ配置）。セレクタは部品の名前だけで書いたので、配置には左右されない想定
- 右の列のチップでの切り替え、続きの読み込みで足される分
- 検索結果の 2 ページ目以降（続きを読み込んだ後）の棚
- ログインしていない状態
