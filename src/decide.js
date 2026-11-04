/**
 * @file 動画の枠をどう見せるかと、件数バーの文言を決める（純粋関数）。
 */

/**
 * 枠の見せ方。
 * - none: そのまま見せる
 * - maybe: ぼかして「〇〇の話題かもしれません」の帯を出す
 * - likely: 消す
 * - unknown: ぼかして「判定できませんでした」の帯を出す
 * @typedef {'none'|'maybe'|'likely'|'unknown'} FrameState
 */

/**
 * unknown になった理由。settings: avoidTopics を読めない、ai: AI が使えない、timeout: 時間切れ
 * @typedef {'settings'|'ai'|'timeout'} UnknownReason
 */

/** 件数バーで「興味なし」を促す、隠した・ぼかした件数の合計の下限 */
export const HINT_THRESHOLD = 5;

/**
 * 枠の見せ方を決める。判定が無ければ順番待ちに入れる（その間は CSS で隠したまま）。
 * どの分かれ道でも、決められないときは見せる側に倒さず unknown にする（CLAUDE.md の「心理的な安全を優先する」）。
 * @param {object} input
 * @param {boolean} input.topicsUnreadable avoidTopics を読めなかったか
 * @param {import('./lm.js').AiState} input.aiState AI の状態
 * @param {import('./ai.js').TopicVerdict|null} input.cached 保存済みの判定
 * @param {boolean} input.timedOut 時間切れで判定が得られなかったか
 * @returns {{ state: FrameState, topic: string|null, reason: UnknownReason|null }|{ enqueue: true }}
 */
export function decideFrame({ topicsUnreadable, aiState, cached, timedOut }) {
  // 読めない設定のもとで保存した判定は、どの話題で判定したものか分からないので使わない
  if (topicsUnreadable) return { state: 'unknown', topic: null, reason: 'settings' };
  if (cached) return { state: cached.level, topic: cached.topic, reason: null };
  if (aiState.mode !== 'ready' && aiState.mode !== 'initializing') {
    return { state: 'unknown', topic: null, reason: 'ai' };
  }
  if (timedOut) return { state: 'unknown', topic: null, reason: 'timeout' };
  return { enqueue: true };
}

/**
 * 件数バーの文言を組み立てる。
 * 画面で隠してもおすすめの仕組みは変わらないので、多いときは「興味なし」を促す。
 * @param {object} input
 * @param {number} input.hidden 消した件数
 * @param {number} input.blurred ぼかした件数（maybe と unknown）
 * @param {import('./lm.js').AiState} input.aiState AI の状態
 * @param {boolean} input.topicsUnreadable avoidTopics を読めなかったか
 * @returns {{ status: string, hint: string|null, needsActivation: boolean }}
 */
export function buildBarText({ hidden, blurred, aiState, topicsUnreadable }) {
  const counts = `避けたい話題かもしれない動画のうち、${hidden} 件を隠し、${blurred} 件をぼかしました`;
  /** @type {string[]} */
  const notes = [];
  if (topicsUnreadable) {
    notes.push('「値」タブの avoidTopics を読めないので、すべてぼかしています（DevTools の console に理由があります）');
  } else if (aiState.mode === 'initializing') {
    const progress = typeof aiState.progress === 'number' ? `（${Math.round(aiState.progress * 100)}%）` : '';
    notes.push(`AI を準備しています${progress}`);
  } else if (aiState.mode === 'needs-activation') {
    notes.push('AI のモデルのダウンロードが必要です。準備が済むまでぼかしています');
  } else if (aiState.mode === 'disabled' || aiState.mode === 'failed') {
    notes.push('この環境では AI が使えないので、判定せずにぼかしています');
  }
  return {
    status: [counts, ...notes].join('。'),
    hint:
      hidden + blurred >= HINT_THRESHOLD
        ? 'おすすめそのものを変えるには「興味なし」を送ってください（ぼかした動画は帯のボタン、消した動画は下のボタンから）'
        : null,
    needsActivation: aiState.mode === 'needs-activation',
  };
}

/**
 * 件数バーの「消した動画に興味なしを送る」の状態。
 * - idle: まだ押していない
 * - confirm: 1 回押した。もう一度押すと送る（誤って押しただけでアカウントに送らないため）
 * - sending: 送っている
 * - done: 送り終えた
 * @typedef {object} SendState
 * @property {'idle'|'confirm'|'sending'|'done'} phase 状態
 * @property {number} count 送る件数
 * @property {number} sent 送った件数
 * @property {number} failed 操作できなかった件数
 */

/**
 * 件数バーの「消した動画に興味なしを送る」のボタンの文言を返す。
 * @param {SendState} state 状態
 * @returns {string}
 */
export function sendButtonLabel({ phase, count, sent, failed }) {
  if (phase === 'confirm') return `もう一度押すと、消した ${count} 件に「興味なし」を送ります`;
  if (phase === 'sending') return `送っています（${sent + failed} / ${count}）`;
  if (phase === 'done') {
    return failed > 0 ? `${sent} 件に送りました。${failed} 件は操作できませんでした` : `${sent} 件に送りました`;
  }
  return `消した ${count} 件に「興味なし」を送る`;
}
