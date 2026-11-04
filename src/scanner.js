/**
 * @file 動画の枠を見回り、判定の結果を当てるか、順番待ちに入れる。
 */

import { videoText } from './ai.js';
import { decideFrame } from './decide.js';
import { readFrame } from './dom.js';
import { hashString } from './hash.js';
import { FRAME_SELECTOR } from './selectors.js';
import { KEY_ATTRIBUTE, STATE_ATTRIBUTE } from './styles.js';
import { applyFrameState, resetFrameState } from './ui.js';

/**
 * @typedef {object} Scanner
 * @property {() => void} scan 全部の枠を見回る
 * @property {(id: string, text: string) => void} markTimedOut 時間切れで判定が得られなかった動画を記録する
 * @property {(id: string) => boolean} isWanted 判定待ちの枠がまだ画面にあるか（順番待ちから取り出す時点で使う）
 */

/**
 * 見回りを作る。
 *
 * - 枠には、判定した動画の ID とタイトル・チャンネル名のハッシュを KEY_ATTRIBUTE に付ける。YouTube が枠を使い回して
 *   中身を別の動画に入れ替えたら、見せ方を外して判定待ち（CSS で隠す状態）に戻す
 * - 判定待ちの枠は、保存済みの判定があれば当て、無ければ順番待ちに入れる（src/decide.js の decideFrame）
 * - AI が使えなかったために unknown にした枠は、AI が使えるようになったら判定し直す
 *
 * @param {object} options
 * @param {ParentNode} options.root 見回る範囲（document）
 * @param {boolean} options.topicsUnreadable avoidTopics を読めなかったか
 * @param {() => import('./lm.js').AiState} options.getAiState AI の状態
 * @param {import('./cache.js').AiCache|null} options.cache 判定の保存先。avoidTopics を読めないときは null
 * @param {(items: { id: string, text: string }[]) => void} options.enqueue 順番待ちに入れる
 * @param {(counts: { hidden: number, blurred: number }) => void} options.onCounts 今のページで消した・ぼかした件数
 * @returns {Scanner}
 */
export function createScanner({ root, topicsUnreadable, getAiState, cache, enqueue, onCounts }) {
  /** @type {Set<string>} 時間切れで判定が得られなかった KEY_ATTRIBUTE の値 */
  const timedOutKeys = new Set();
  /** @type {Set<string>} 直近の見回りで判定待ちだった動画 ID */
  let wantedIds = new Set();

  return {
    scan() {
      const aiState = getAiState();
      const aiUsable = aiState.mode === 'ready' || aiState.mode === 'initializing';
      /** @type {Map<string, { id: string, text: string }>} */
      const toEnqueue = new Map();
      let hidden = 0;
      let blurred = 0;
      for (const frame of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(FRAME_SELECTOR))) {
        const info = readFrame(frame);
        if (!info) {
          // 中身が抜けた枠は判定待ちに戻す（CSS で隠れる）
          if (frame.hasAttribute(KEY_ATTRIBUTE)) {
            resetFrameState(frame);
            frame.removeAttribute(KEY_ATTRIBUTE);
          }
          continue;
        }
        const text = videoText(info.title, info.channel);
        const textHash = hashString(text);
        const key = `${info.id}:${textHash}`;
        if (frame.getAttribute(KEY_ATTRIBUTE) !== key) {
          resetFrameState(frame);
          frame.setAttribute(KEY_ATTRIBUTE, key);
        }
        if (frame.getAttribute(STATE_ATTRIBUTE) === 'unknown' && frame.dataset.ycfReason === 'ai' && aiUsable) {
          resetFrameState(frame);
        }
        if (!frame.hasAttribute(STATE_ATTRIBUTE)) {
          const decision = decideFrame({
            topicsUnreadable,
            aiState,
            cached: cache ? cache.get(info.id, textHash) : null,
            timedOut: timedOutKeys.has(key),
          });
          if ('enqueue' in decision) {
            toEnqueue.set(info.id, { id: info.id, text });
          } else {
            applyFrameState(frame, decision.state, decision.topic);
            if (decision.reason) frame.dataset.ycfReason = decision.reason;
            else delete frame.dataset.ycfReason;
          }
        }
        // 前に開いたページ（隠れている ytd-browse など）の枠は数えない
        if (frame.closest('[hidden]')) continue;
        const state = frame.getAttribute(STATE_ATTRIBUTE);
        if (state === 'likely') hidden += 1;
        else if (state === 'maybe' || state === 'unknown') blurred += 1;
      }
      wantedIds = new Set(toEnqueue.keys());
      if (toEnqueue.size > 0) enqueue([...toEnqueue.values()]);
      onCounts({ hidden, blurred });
    },

    markTimedOut(id, text) {
      timedOutKeys.add(`${id}:${hashString(text)}`);
    },

    isWanted(id) {
      return wantedIds.has(id);
    },
  };
}
