/**
 * @file YouTube の DOM のセレクタ。根拠は docs/dom-structure.md。
 * YouTube の変更で壊れうるので、セレクタはここにまとめる。
 */

/**
 * 判定する動画の枠。CSS だけで、DOM に入った時点から隠すのに使う（docs/dom-structure.md の「CSS だけで隠せるセレクタ」）。
 * 検索の本来の結果（ytd-video-renderer）には当たらない。
 */
export const FRAME_SELECTORS = [
  // ホーム（Shorts の棚を含む）
  'ytd-browse[page-subtype="home"] ytd-rich-item-renderer',
  // 動画ページの右の列
  'ytd-watch-next-secondary-results-renderer yt-lockup-view-model',
  // 自動再生の次の動画
  '.ytp-autonav-endscreen-link-container',
  // 終わりの候補
  '.ytp-videowall-still',
  // 検索結果に差し込まれる棚（Shorts の棚を含む）
  'ytd-search ytd-item-section-renderer > #contents > grid-shelf-view-model .ytGridShelfViewModelGridShelfItem',
];

/** FRAME_SELECTORS をまとめたもの */
export const FRAME_SELECTOR = FRAME_SELECTORS.join(', ');

/**
 * 枠を消すとき、場所を残して見えなくするだけにするもの（プレーヤーの中の要素）。
 * それ以外は display:none で消す。
 */
export const PLAYER_FRAME_SELECTOR = '.ytp-autonav-endscreen-link-container, .ytp-videowall-still';

/** 新しい部品の動画の枠 */
export const LOCKUP_SELECTOR = 'yt-lockup-view-model';
/** content-id-<ID> のクラスを持つ要素 */
export const LOCKUP_HOST_SELECTOR = '.ytLockupViewModelHost';
/** content-id-<ID> のクラスの接頭辞 */
export const LOCKUP_CONTENT_ID_PREFIX = 'content-id-';
/** タイトルのリンク */
export const LOCKUP_TITLE_SELECTOR = 'a.ytLockupMetadataViewModelTitle';
/** チャンネル名（最初のメタデータの行の、最初の文字列） */
export const LOCKUP_CHANNEL_SELECTOR = '.ytContentMetadataViewModelMetadataRow .ytAttributedStringHost';

/** Shorts の枠。検索の棚では ytm-shorts-lockup-view-model-v2 の中にある */
export const SHORTS_LOCKUP_SELECTOR = 'ytm-shorts-lockup-view-model';
/** Shorts のタイトルのリンク */
export const SHORTS_TITLE_SELECTOR = 'h3 a[href^="/shorts/"]';

/** 終わりの候補 */
export const STILL_SELECTOR = '.ytp-videowall-still';
export const STILL_TITLE_SELECTOR = '.ytp-videowall-still-info-title';
export const STILL_CHANNEL_SELECTOR = '.ytp-videowall-still-info-author';

/** 自動再生の次の動画 */
export const UPNEXT_SELECTOR = '.ytp-autonav-endscreen-link-container';
export const UPNEXT_TITLE_SELECTOR = '.ytp-autonav-endscreen-upnext-title';
export const UPNEXT_CHANNEL_SELECTOR = '.ytp-autonav-endscreen-upnext-author';

/** 動画の枠のメニューを開くボタン（docs/dom-structure.md の「メニューを開くボタン」） */
export const MENU_BUTTON_SELECTOR =
  '.ytLockupMetadataViewModelMenuButton button, .shortsLockupViewModelHostOutsideMetadataMenu button';
/** 開いたメニュー。表示中のものは display が none でない */
export const MENU_POPUP_SELECTOR = 'ytd-popup-container tp-yt-iron-dropdown';
/** メニューの項目 */
export const MENU_ITEM_SELECTOR = 'yt-list-item-view-model';
/** メニューの項目の中の、押す要素 */
export const MENU_ITEM_BUTTON_SELECTOR = 'button[role="menuitem"]';
