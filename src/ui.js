/**
 * @file 帯と件数バーの DOM。
 */

import { sendNotInterested } from './not-interested.js';
import { PLAYER_FRAME_SELECTOR } from './selectors.js';
import {
  BAND_CLASS,
  BAND_NOT_INTERESTED_CLASS,
  BAND_TOGGLE_CLASS,
  BAR_ID,
  REVEAL_ATTRIBUTE,
  SENT_ATTRIBUTE,
  STATE_ATTRIBUTE,
} from './styles.js';

/**
 * 帯の文言を返す。
 * @param {'maybe'|'unknown'} state 枠の見せ方
 * @param {string|null} topic 当たった話題の name
 * @param {boolean} revealed その場だけ見せているか
 * @returns {string}
 */
export function bandText(state, topic, revealed) {
  if (revealed) return '隠す';
  if (state === 'unknown') return '判定できませんでした（押すと表示）';
  return topic ? `「${topic}」の話題かもしれません（押すと表示）` : '避けたい話題かもしれません（押すと表示）';
}

/**
 * 帯を作る。帯のどこを押しても、その場だけ見せる・戻すを切り替える。
 * 「興味なし」のボタンは、押したときだけ YouTube のメニューの「興味なし」を操作する（src/not-interested.js）。
 * 終わりの候補・自動再生の次の動画にはメニューが無いので、ボタンを置かない。
 * @param {HTMLElement} frame 動画の枠
 * @returns {HTMLElement}
 */
function createBand(frame) {
  const band = document.createElement('div');
  band.className = BAND_CLASS;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = BAND_TOGGLE_CLASS;
  band.append(toggle);
  // 枠そのものがリンク（終わりの候補など）のときも、帯を押しただけでは動画へ移らないようにする
  band.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const revealed = !frame.hasAttribute(REVEAL_ATTRIBUTE);
    frame.toggleAttribute(REVEAL_ATTRIBUTE, revealed);
    toggle.textContent = bandText(
      /** @type {'maybe'|'unknown'} */ (frame.getAttribute(STATE_ATTRIBUTE)),
      frame.dataset.ycontentTopic || null,
      revealed,
    );
  });
  if (!frame.matches(PLAYER_FRAME_SELECTOR)) {
    const notInterested = document.createElement('button');
    notInterested.type = 'button';
    notInterested.className = BAND_NOT_INTERESTED_CLASS;
    notInterested.textContent = '興味なし';
    notInterested.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (notInterested.disabled) return;
      notInterested.disabled = true;
      notInterested.textContent = '送っています…';
      const sent = await sendNotInterested(frame);
      frame.setAttribute(SENT_ATTRIBUTE, sent ? 'sent' : 'failed');
      notInterested.textContent = sent ? '「興味なし」を送りました' : '操作できませんでした';
    });
    band.append(notInterested);
  }
  return band;
}

/**
 * 枠に見せ方を当てる。maybe と unknown には帯を置き、それ以外では帯を外す。
 * 帯を押すとその場だけ見せ、もう一度押すと戻す。見せたことは保存しない。
 * @param {HTMLElement} frame 動画の枠
 * @param {import('./decide.js').FrameState} state 見せ方
 * @param {string|null} topic 当たった話題の name
 */
export function applyFrameState(frame, state, topic) {
  frame.setAttribute(STATE_ATTRIBUTE, state);
  frame.removeAttribute(REVEAL_ATTRIBUTE);
  let band = /** @type {HTMLElement|null} */ (frame.querySelector(`:scope > .${BAND_CLASS}`));
  if (state !== 'maybe' && state !== 'unknown') {
    band?.remove();
    return;
  }
  if (!band) {
    band = createBand(frame);
    frame.append(band);
  }
  if (topic) frame.dataset.ycontentTopic = topic;
  else delete frame.dataset.ycontentTopic;
  const toggle = band.querySelector(`.${BAND_TOGGLE_CLASS}`);
  if (toggle) toggle.textContent = bandText(state, topic, false);
}

/**
 * 枠から見せ方を外し、判定待ち（CSS で隠す状態）に戻す。中身が別の動画に入れ替わったときに使う。
 * @param {HTMLElement} frame 動画の枠
 */
export function resetFrameState(frame) {
  frame.removeAttribute(STATE_ATTRIBUTE);
  frame.removeAttribute(REVEAL_ATTRIBUTE);
  frame.removeAttribute(SENT_ATTRIBUTE);
  delete frame.dataset.ycontentTopic;
  frame.querySelector(`:scope > .${BAND_CLASS}`)?.remove();
}

/**
 * 件数バーを作る。
 * @param {() => void} onActivate 「AI を準備する」を押した（クリックの同期区間で呼ぶ）
 * @param {() => void} onSend 「消した動画に興味なしを送る」を押した
 * @returns {{
 *   element: HTMLElement,
 *   update: (text: { status: string, hint: string|null, needsActivation: boolean }) => void,
 *   setSendButton: (label: string|null, disabled: boolean) => void,
 * }}
 */
export function createBar(onActivate, onSend) {
  const element = document.createElement('div');
  element.id = BAR_ID;
  element.setAttribute('role', 'status');
  const status = document.createElement('div');
  const hint = document.createElement('div');
  const activate = document.createElement('button');
  activate.type = 'button';
  activate.textContent = 'AI を準備する（モデルをダウンロードします）';
  activate.addEventListener('click', () => onActivate());
  const send = document.createElement('button');
  send.type = 'button';
  send.hidden = true;
  send.addEventListener('click', () => onSend());
  element.append(status, hint, activate, send);
  return {
    element,
    update(text) {
      status.textContent = text.status;
      hint.textContent = text.hint ?? '';
      hint.hidden = text.hint === null;
      activate.hidden = !text.needsActivation;
    },
    setSendButton(label, disabled) {
      send.hidden = label === null;
      send.textContent = label ?? '';
      send.disabled = disabled;
    },
  };
}
