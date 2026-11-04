/**
 * @file 帯と件数バーの DOM。
 */

import { BAND_CLASS, BAR_ID, REVEAL_ATTRIBUTE, STATE_ATTRIBUTE } from './styles.js';

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
    band = document.createElement('button');
    band.type = 'button';
    band.className = BAND_CLASS;
    // 枠そのものがリンク（終わりの候補など）のときも、帯を押しただけでは動画へ移らないようにする
    band.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const revealed = !frame.hasAttribute(REVEAL_ATTRIBUTE);
      frame.toggleAttribute(REVEAL_ATTRIBUTE, revealed);
      /** @type {HTMLElement} */ (event.currentTarget).textContent = bandText(
        /** @type {'maybe'|'unknown'} */ (frame.getAttribute(STATE_ATTRIBUTE)),
        frame.dataset.ycfTopic || null,
        revealed,
      );
    });
    frame.append(band);
  }
  if (topic) frame.dataset.ycfTopic = topic;
  else delete frame.dataset.ycfTopic;
  band.textContent = bandText(state, topic, false);
}

/**
 * 枠から見せ方を外し、判定待ち（CSS で隠す状態）に戻す。中身が別の動画に入れ替わったときに使う。
 * @param {HTMLElement} frame 動画の枠
 */
export function resetFrameState(frame) {
  frame.removeAttribute(STATE_ATTRIBUTE);
  frame.removeAttribute(REVEAL_ATTRIBUTE);
  delete frame.dataset.ycfTopic;
  frame.querySelector(`:scope > .${BAND_CLASS}`)?.remove();
}

/**
 * 件数バーを作る。
 * @param {() => void} onActivate 「AI を準備する」を押した（クリックの同期区間で呼ぶ）
 * @returns {{ element: HTMLElement, update: (text: { status: string, hint: string|null, needsActivation: boolean }) => void }}
 */
export function createBar(onActivate) {
  const element = document.createElement('div');
  element.id = BAR_ID;
  element.setAttribute('role', 'status');
  const status = document.createElement('div');
  const hint = document.createElement('div');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'AI を準備する（モデルをダウンロードします）';
  button.addEventListener('click', () => onActivate());
  element.append(status, hint, button);
  return {
    element,
    update(text) {
      status.textContent = text.status;
      hint.textContent = text.hint ?? '';
      hint.hidden = text.hint === null;
      button.hidden = !text.needsActivation;
    },
  };
}
