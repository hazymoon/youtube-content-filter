/**
 * @file 動画の枠を隠す・ぼかす CSS と、件数バー・帯の CSS。
 */

import { FRAME_SELECTORS, PLAYER_FRAME_SELECTOR, STILL_SELECTOR } from './selectors.js';

/** html 要素に付ける。判定する話題があり、枠を隠して判定する間だけ付ける */
export const ACTIVE_ATTRIBUTE = 'data-ycontent-active';
/** 枠に付ける。値は src/decide.js の FrameState */
export const STATE_ATTRIBUTE = 'data-ycontent-state';
/** 枠に付ける。判定した動画の ID とタイトル・チャンネル名のハッシュ。中身が入れ替わったかを見分ける */
export const KEY_ATTRIBUTE = 'data-ycontent-key';
/** 枠に付ける。帯を押して、その場だけ見せている間だけ付ける */
export const REVEAL_ATTRIBUTE = 'data-ycontent-reveal';
/** 帯の要素のクラス */
export const BAND_CLASS = 'ycontent-band';
/** 件数バーの要素の ID */
export const BAR_ID = 'ycontent-bar';

/** ぼかす部分（サムネイル） */
const THUMBNAIL_SELECTORS = [
  'yt-thumbnail-view-model',
  '.ytLockupViewModelContentImage',
  '.shortsLockupViewModelHostEndpoint',
  '.ytp-videowall-still-image',
  '.ytp-autonav-endscreen-upnext-thumbnail',
];
/** 伏せる部分（タイトル・チャンネル名など） */
const TEXT_SELECTORS = [
  '.ytLockupViewModelMetadata',
  '.shortsLockupViewModelHostOutsideMetadata',
  '.ytp-videowall-still-info',
  '.ytp-autonav-endscreen-video-info',
];

/**
 * 各セレクタに後ろから条件を付ける。
 * @param {string[]} selectors セレクタ
 * @param {string} suffix 付ける条件
 * @returns {string}
 */
function withSuffix(selectors, suffix) {
  return selectors.map((selector) => `html[${ACTIVE_ATTRIBUTE}] ${selector}${suffix}`).join(',\n');
}

/**
 * スクリプトが入れる CSS を組み立てる。@run-at document-start で入れるので、後から DOM に入った枠にもその場で当たる。
 *
 * - 判定が済むまで（STATE_ATTRIBUTE が無い間）は visibility:hidden で隠す。display:none だと枠の高さが 0 になり、
 *   YouTube が続きを読み込み続けた（docs/dom-structure.md の「隠し方は visibility:hidden にする」）
 * - likely は消す。プレーヤーの中の要素は並びが崩れないよう、場所を残して見えなくする
 * - maybe と unknown はサムネイルをぼかし、タイトルなどを伏せる。帯で枠全体を覆い、ホバーでのプレビュー再生も止める
 * @returns {string}
 */
export function buildStyles() {
  const pending = withSuffix(FRAME_SELECTORS, `:not([${STATE_ATTRIBUTE}])`);
  const likely = withSuffix(FRAME_SELECTORS, `[${STATE_ATTRIBUTE}="likely"]`);
  const playerLikely = withSuffix([PLAYER_FRAME_SELECTOR], `[${STATE_ATTRIBUTE}="likely"]`);
  const blurredFrame = FRAME_SELECTORS.flatMap((frame) =>
    ['maybe', 'unknown'].map((state) => `${frame}[${STATE_ATTRIBUTE}="${state}"]:not([${REVEAL_ATTRIBUTE}])`),
  );
  // 終わりの候補はもともと position:absolute で並んでいるので、帯の基準にするための relative を当てない
  const shadedFrame = FRAME_SELECTORS.filter((frame) => frame !== STILL_SELECTOR).flatMap((frame) =>
    ['maybe', 'unknown'].map((state) => `${frame}[${STATE_ATTRIBUTE}="${state}"]`),
  );
  const thumbnails = withSuffix(
    blurredFrame.flatMap((frame) => THUMBNAIL_SELECTORS.map((part) => `${frame} ${part}`)),
    '',
  );
  const texts = withSuffix(
    blurredFrame.flatMap((frame) => TEXT_SELECTORS.map((part) => `${frame} ${part}`)),
    '',
  );
  return `
${pending} {
  visibility: hidden !important;
}
${likely} {
  display: none !important;
}
${playerLikely} {
  display: block !important;
  visibility: hidden !important;
}
${withSuffix(shadedFrame, '')} {
  position: relative !important;
}
${thumbnails} {
  filter: blur(24px) !important;
}
${texts} {
  visibility: hidden !important;
}
.${BAND_CLASS} {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: 0;
  border-radius: 12px;
  background: rgba(32, 32, 32, 0.72);
  color: #fff;
  font: 500 13px/1.5 Roboto, Arial, sans-serif;
  text-align: center;
  cursor: pointer;
  visibility: visible;
}
[${REVEAL_ATTRIBUTE}] > .${BAND_CLASS} {
  inset: 4px auto auto 4px;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 12px;
}
#${BAR_ID} {
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 2300;
  max-width: min(420px, calc(100vw - 24px));
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(32, 32, 32, 0.9);
  color: #fff;
  font: 400 12px/1.6 Roboto, Arial, sans-serif;
}
#${BAR_ID}[hidden] {
  display: none;
}
#${BAR_ID} button {
  margin-top: 4px;
  padding: 2px 8px;
  border: 1px solid #fff;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
`;
}
