/**
 * @file YouTube の動画の枠のメニューの「興味なし」を、利用者が押したときだけ操作する。
 * 見分け方の根拠は docs/dom-structure.md の「動画の枠のメニューと「興味なし」」。
 */

import {
  LOCKUP_SELECTOR,
  MENU_BUTTON_SELECTOR,
  MENU_ITEM_BUTTON_SELECTOR,
  MENU_ITEM_SELECTOR,
  MENU_POPUP_SELECTOR,
  SHORTS_LOCKUP_SELECTOR,
} from './selectors.js';

/** 「興味なし」の項目のアイコンの名前。文言は表示の言語で変わるので、これと命令の種類で見分ける */
const NOT_INTERESTED_ICON = 'HIDE';

/** メニューが開くのを待つ時間の上限（ミリ秒） */
const MENU_OPEN_TIMEOUT_MS = 2000;

/** メニューが開いたかを確かめる間隔（ミリ秒） */
const MENU_POLL_MS = 50;

/**
 * 枠のデータから、メニューの項目の一覧（listItemViewModel を並べた配列）を探す。
 * 動画の枠と Shorts の枠で一覧の場所が違うので、listItems を持つ最初のオブジェクトを探す。
 * @param {unknown} data 枠のデータ
 * @returns {any[]|null}
 */
export function findMenuListItems(data) {
  /** @type {Set<object>} */
  const seen = new Set();
  /**
   * @param {unknown} node 探す対象
   * @param {number} depth 深さ
   * @returns {any[]|null}
   */
  function walk(node, depth) {
    if (node === null || typeof node !== 'object' || depth > 20 || seen.has(node)) return null;
    seen.add(node);
    const listItems = /** @type {any} */ (node).listItems;
    if (Array.isArray(listItems) && listItems.some((item) => item?.listItemViewModel)) return listItems;
    for (const value of Object.values(node)) {
      const found = walk(value, depth + 1);
      if (found) return found;
    }
    return null;
  }
  return walk(data, 0);
}

/**
 * 一覧の中の「興味なし」の位置を返す。アイコンが HIDE で、押したときの命令が feedbackEndpoint の項目に限る。
 * 当てはまる項目がちょうど 1 つでなければ -1（確実に特定できないときは押さない）。
 * @param {any[]} listItems findMenuListItems の値
 * @returns {number}
 */
export function notInterestedIndex(listItems) {
  const matches = [];
  listItems.forEach((item, index) => {
    const model = item?.listItemViewModel;
    const icon = model?.leadingImage?.sources?.[0]?.clientResource?.imageName;
    const command = model?.rendererContext?.commandContext?.onTap?.innertubeCommand;
    if (icon === NOT_INTERESTED_ICON && command?.feedbackEndpoint) matches.push(index);
  });
  return matches.length === 1 ? matches[0] : -1;
}

/**
 * 要素のデータを読む。読めなければ null。
 * @param {any} element 要素
 * @returns {unknown}
 */
function elementData(element) {
  if (!element) return null;
  try {
    const props = element.componentProps;
    if (typeof props?.data === 'function') return props.data();
    if (props?.data) return props.data;
    return element.data ?? null;
  } catch {
    return null;
  }
}

/**
 * 枠のデータを読む（docs/dom-structure.md の「興味なし」の見分け方の表）。
 * @param {HTMLElement} frame 動画の枠
 * @returns {unknown}
 */
function frameData(frame) {
  const content = /** @type {any} */ (frame).data?.content;
  if (content?.lockupViewModel) return content.lockupViewModel;
  if (content?.shortsLockupViewModel) return content.shortsLockupViewModel;
  if (frame.matches(LOCKUP_SELECTOR)) return elementData(frame);
  return elementData(frame.querySelector(LOCKUP_SELECTOR)) ?? elementData(frame.querySelector(SHORTS_LOCKUP_SELECTOR));
}

/**
 * 表示されているメニューを返す。無ければ null。
 * @returns {Element|null}
 */
function openMenu() {
  return (
    [...document.querySelectorAll(MENU_POPUP_SELECTOR)].find((menu) => getComputedStyle(menu).display !== 'none') ??
    null
  );
}

/**
 * 開いているメニューを閉じる（メニューの外を押したときと同じく、body を押す）。
 */
function closeMenu() {
  if (openMenu()) document.body.click();
}

/**
 * 枠のメニューの「興味なし」を押す。利用者が帯か件数バーのボタンを押したときだけ呼ぶ。
 *
 * データで「興味なし」の位置を確かめ、メニューを開いて、項目の数と、その位置の文言がデータと一致したときだけ押す。
 * どこかで食い違えば何も押さずにメニューを閉じ、false を返す（別の項目を押すと、利用者が望まない操作になるため）。
 * @param {HTMLElement} frame 動画の枠
 * @returns {Promise<boolean>} 押したか
 */
export async function sendNotInterested(frame) {
  const listItems = findMenuListItems(frameData(frame));
  if (!listItems) return false;
  const index = notInterestedIndex(listItems);
  if (index < 0) return false;
  const button = /** @type {HTMLElement|null} */ (frame.querySelector(MENU_BUTTON_SELECTOR));
  if (!button) return false;

  closeMenu();
  button.click();
  /** @type {Element|null} */
  let menu = null;
  for (let waited = 0; waited < MENU_OPEN_TIMEOUT_MS && !menu; waited += MENU_POLL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MENU_POLL_MS));
    menu = openMenu();
  }
  if (!menu) return false;

  const items = [...menu.querySelectorAll(MENU_ITEM_SELECTOR)];
  const expectedTitle = listItems[index].listItemViewModel?.title?.content;
  const target = items[index];
  const targetButton = /** @type {HTMLElement|null|undefined} */ (target?.querySelector(MENU_ITEM_BUTTON_SELECTOR));
  if (
    items.length !== listItems.length ||
    typeof expectedTitle !== 'string' ||
    target?.textContent?.trim() !== expectedTitle ||
    !targetButton
  ) {
    closeMenu();
    return false;
  }
  targetButton.click();
  return true;
}
