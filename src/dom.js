/**
 * @file 動画の枠から、判定に使う動画 ID・タイトル・チャンネル名を読む。
 */

import {
  LOCKUP_CHANNEL_SELECTOR,
  LOCKUP_CONTENT_ID_PREFIX,
  LOCKUP_HOST_SELECTOR,
  LOCKUP_SELECTOR,
  LOCKUP_TITLE_SELECTOR,
  SHORTS_LOCKUP_SELECTOR,
  SHORTS_TITLE_SELECTOR,
  STILL_CHANNEL_SELECTOR,
  STILL_SELECTOR,
  STILL_TITLE_SELECTOR,
  UPNEXT_CHANNEL_SELECTOR,
  UPNEXT_SELECTOR,
  UPNEXT_TITLE_SELECTOR,
} from './selectors.js';

/**
 * 判定に使う動画の情報。
 * @typedef {object} FrameInfo
 * @property {string} id 動画 ID（プレイリストならプレイリストの ID）
 * @property {string} title タイトル
 * @property {string} channel チャンネル名。表示に無ければ空文字
 */

/**
 * 子要素の textContent を前後の空白を除いて返す。無ければ空文字。
 * @param {Element} root 探す起点
 * @param {string} selector セレクタ
 * @returns {string}
 */
function textOf(root, selector) {
  return root.querySelector(selector)?.textContent?.trim() ?? '';
}

/**
 * URL の v= を返す。無ければ空文字。
 * @param {string|null} href URL
 * @returns {string}
 */
function videoIdFromHref(href) {
  if (!href) return '';
  try {
    return new URL(href, 'https://www.youtube.com/').searchParams.get('v') ?? '';
  } catch {
    return '';
  }
}

/**
 * 新しい部品の枠を読む。動画 ID は content-id-<ID> のクラスから読む（Shorts やプレイリストのリンクには v= が無いため）。
 * @param {Element} lockup yt-lockup-view-model
 * @returns {FrameInfo}
 */
function readLockup(lockup) {
  const host = lockup.querySelector(LOCKUP_HOST_SELECTOR);
  const idClass = [...(host?.classList ?? [])].find((name) => name.startsWith(LOCKUP_CONTENT_ID_PREFIX));
  return {
    id: idClass ? idClass.slice(LOCKUP_CONTENT_ID_PREFIX.length) : '',
    title: textOf(lockup, LOCKUP_TITLE_SELECTOR),
    // 右の列ではチャンネル名がリンクにならないので、リンクの有無に頼らず位置で読む
    channel: textOf(lockup, LOCKUP_CHANNEL_SELECTOR),
  };
}

/**
 * Shorts の枠を読む。チャンネル名は表示に無い。
 * @param {Element} shorts ytm-shorts-lockup-view-model
 * @returns {FrameInfo}
 */
function readShorts(shorts) {
  const link = shorts.querySelector(SHORTS_TITLE_SELECTOR);
  const match = /^\/shorts\/([\w-]+)/.exec(link?.getAttribute('href') ?? '');
  return { id: match ? match[1] : '', title: link?.textContent?.trim() ?? '', channel: '' };
}

/**
 * 動画の枠から判定に使う情報を読む。ID かタイトルを読めなければ null（中身が入る前の枠や、広告の枠）。
 * @param {Element} frame src/selectors.js の FRAME_SELECTOR に当たる要素
 * @returns {FrameInfo|null}
 */
export function readFrame(frame) {
  /** @type {FrameInfo|null} */
  let info = null;
  if (frame.matches(STILL_SELECTOR)) {
    info = {
      id: videoIdFromHref(frame.getAttribute('href')),
      title: textOf(frame, STILL_TITLE_SELECTOR),
      channel: textOf(frame, STILL_CHANNEL_SELECTOR),
    };
  } else if (frame.matches(UPNEXT_SELECTOR)) {
    info = {
      id: videoIdFromHref(frame.getAttribute('href')),
      title: textOf(frame, UPNEXT_TITLE_SELECTOR),
      channel: textOf(frame, UPNEXT_CHANNEL_SELECTOR),
    };
  } else if (frame.matches(LOCKUP_SELECTOR)) {
    info = readLockup(frame);
  } else {
    const lockup = frame.querySelector(LOCKUP_SELECTOR);
    const shorts = lockup ? null : frame.querySelector(SHORTS_LOCKUP_SELECTOR);
    if (lockup) info = readLockup(lockup);
    else if (shorts) info = readShorts(shorts);
  }
  if (!info || info.id === '' || info.title === '') return null;
  return info;
}
