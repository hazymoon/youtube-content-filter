/**
 * @file 起動処理。設定を読み、CSS を入れ、AI の判定と見回りをつなぐ。
 */

import { LEVEL_VERDICT_CODEC, buildInitialPrompts, cacheVersion, createTopicCodec } from './ai.js';
import { createAiCache } from './cache.js';
import { buildBarText, sendButtonLabel } from './decide.js';
import { hashString } from './hash.js';
import { createLanguageModelController } from './lm.js';
import { sendNotInterested } from './not-interested.js';
import { createAiQueue } from './queue.js';
import { createScanner } from './scanner.js';
import { AVOID_TOPICS_VALUE_KEY, parseStoredAvoidTopics, parseStoredOptions } from './settings.js';
import { FRAME_SELECTOR } from './selectors.js';
import { ACTIVE_ATTRIBUTE, SENT_ATTRIBUTE, STATE_ATTRIBUTE, buildStyles } from './styles.js';
import { activeTopics, localDateString } from './topics.js';
import { createBar } from './ui.js';

/** GM_setValue に保存するキャッシュのキー */
const CACHE_STORAGE_KEY = 'aiCache';

/** 判定の結果の書き込みをまとめる待ち時間（ミリ秒） */
const CACHE_SAVE_DELAY_MS = 2000;

/** DOM の変化から見回りまでの待ち時間（ミリ秒）。続けて起きる変化をまとめる */
const SCAN_DELAY_MS = 50;

/**
 * 変化を取りこぼしても枠が隠れたままにならないよう、定期的に見回る間隔（ミリ秒）。
 * プレーヤーの中の要素は、中身だけが書き換わることがあるため
 */
const SCAN_INTERVAL_MS = 1000;

/** 件数バーの「興味なし」を 1 回押してから、もう一度押すのを待つ時間（ミリ秒）。過ぎたら最初に戻す */
const SEND_CONFIRM_MS = 5000;

/** 件数バーの「興味なし」を送り終えた文言を出しておく時間（ミリ秒） */
const SEND_DONE_MS = 8000;

/**
 * 今のページで消した枠のうち、まだ「興味なし」を送っていないものを返す。
 * @returns {HTMLElement[]}
 */
function unsentLikelyFrames() {
  return /** @type {HTMLElement[]} */ ([...document.querySelectorAll(FRAME_SELECTOR)]).filter(
    (frame) =>
      frame.getAttribute(STATE_ATTRIBUTE) === 'likely' &&
      !frame.hasAttribute(SENT_ATTRIBUTE) &&
      // 前に開いたページ（隠れている ytd-browse など）の枠には送らない
      !frame.closest('[hidden]'),
  );
}

/**
 * GM_getValue で読む。使えない環境では undefined。
 * @param {string} key 値の名前
 * @returns {unknown}
 */
function readValue(key) {
  return typeof GM_getValue === 'function' ? GM_getValue(key) : undefined;
}

/**
 * GM_setValue で書く。使えない環境では何もしない。
 * @param {string} key 値の名前
 * @param {unknown} value 値
 */
function writeValue(key, value) {
  if (typeof GM_setValue === 'function') GM_setValue(key, value);
}

/**
 * ユーザスクリプトの起動処理。
 *
 * - AI を使わない設定（aiEnabled が false）か、期限内の話題が無ければ何もしない
 * - avoidTopics を読めないときは、AI を使わずに全部の枠をぼかす（src/settings.js の parseStoredAvoidTopics）
 * - それ以外は、@run-at document-start のうちに CSS を入れて枠を隠し、判定が済んだものから見せる
 */
export function main() {
  const { options, warnings } = parseStoredOptions(readValue);
  for (const warning of warnings) console.warn(`[YouTube Content Filter] ${warning}`);

  const stored = parseStoredAvoidTopics(readValue(AVOID_TOPICS_VALUE_KEY));
  // 利用者が値の名前を覚えていなくても書き込めるよう、無ければ空の配列を作る
  if (stored.missing) writeValue(AVOID_TOPICS_VALUE_KEY, []);
  if (stored.problem) console.warn(`[YouTube Content Filter] ${stored.problem}`);

  // 何もしないときも、利用者が設定の効き方を確かめられるよう理由を出す
  if (!options.aiEnabled) {
    console.info('[YouTube Content Filter] aiEnabled が false なので、何もしません');
    return;
  }
  const topics = stored.topics === null ? null : activeTopics(stored.topics, localDateString(new Date()));
  if (topics !== null && topics.length === 0) {
    console.info('[YouTube Content Filter] 判定する話題（期限内の avoidTopics）が無いので、何もしません');
    return;
  }
  const topicsUnreadable = topics === null;
  const judgedTopics = topics ?? [];

  const style = document.createElement('style');
  style.textContent = buildStyles();
  // document-start では head がまだ無いことがあるので、html 要素の直下に入れる
  document.documentElement.append(style);
  document.documentElement.setAttribute(ACTIVE_ATTRIBUTE, '');

  /** @type {ReturnType<typeof setTimeout>|null} */
  let scanTimer = null;
  function scheduleScan() {
    if (scanTimer !== null) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scanner.scan();
    }, SCAN_DELAY_MS);
  }

  const cache = topicsUnreadable
    ? null
    : createAiCache({
        maxEntries: options.aiCacheMaxEntries,
        version: cacheVersion(judgedTopics, options.aiBatchSize),
        verdictCodec: LEVEL_VERDICT_CODEC,
        storage: { load: () => readValue(CACHE_STORAGE_KEY), save: (value) => writeValue(CACHE_STORAGE_KEY, value) },
        schedule(fn) {
          const timer = setTimeout(fn, CACHE_SAVE_DELAY_MS);
          return () => clearTimeout(timer);
        },
      });

  const lm = createLanguageModelController({
    initialPrompts: buildInitialPrompts(judgedTopics),
    // 読めない設定のもとでは判定しない（モデルの読み込みもしない）
    enabled: !topicsUnreadable,
    onStateChange: () => scheduleScan(),
  });

  const queue = createAiQueue({
    cloneSession: () => lm.cloneSession(),
    waitForReady: () => lm.waitForReady(),
    batchSize: options.aiBatchSize,
    timeoutMs: options.aiTimeoutMs,
    maxChars: options.aiMaxChars,
    codec: createTopicCodec(judgedTopics),
    onVerdict(id, verdict, item) {
      if (options.debug) console.debug('[YouTube Content Filter] verdict', id, verdict);
      cache?.set(id, hashString(item.text), verdict);
      scheduleScan();
    },
    onPending(id, item) {
      if (options.debug) console.debug('[YouTube Content Filter] pending', id);
      scanner.markTimedOut(id, item.text);
      scheduleScan();
    },
    onFatal(error) {
      console.warn('[YouTube Content Filter] AI の判定を止めました', error);
      lm.markFailed(error);
      scheduleScan();
    },
    onSessionStale: () => lm.recreate(),
    isWanted: (id) => scanner.isWanted(id),
  });

  /** @type {ReturnType<typeof createBar>|null} */
  let bar = null;
  let counts = { hidden: 0, blurred: 0 };
  /** @type {import('./decide.js').SendState} */
  let sendState = { phase: 'idle', count: 0, sent: 0, failed: 0 };
  /** @type {ReturnType<typeof setTimeout>|null} */
  let sendTimer = null;

  function updateBar() {
    if (!bar) return;
    bar.update(buildBarText({ ...counts, aiState: lm.getState(), topicsUnreadable }));
    if (sendState.phase === 'idle') {
      const count = unsentLikelyFrames().length;
      bar.setSendButton(count > 0 ? sendButtonLabel({ ...sendState, count }) : null, false);
    } else {
      bar.setSendButton(sendButtonLabel(sendState), sendState.phase === 'sending');
    }
  }

  /**
   * 状態を変えて件数バーに出す。idle 以外は、決めた時間が過ぎたら idle に戻す。
   * @param {import('./decide.js').SendState} next 次の状態
   * @param {number|null} resetAfterMs idle に戻すまでの時間
   */
  function setSendState(next, resetAfterMs) {
    if (sendTimer !== null) clearTimeout(sendTimer);
    sendTimer = null;
    sendState = next;
    if (resetAfterMs !== null) {
      sendTimer = setTimeout(() => setSendState({ phase: 'idle', count: 0, sent: 0, failed: 0 }, null), resetAfterMs);
    }
    updateBar();
  }

  /**
   * 件数バーの「消した動画に興味なしを送る」を押した。1 回目は確かめるだけで、もう一度押すと 1 件ずつ送る。
   * 消した動画は画面に無いので、帯のボタンの代わりにここから送る。
   */
  async function onSend() {
    if (sendState.phase === 'sending') return;
    const frames = unsentLikelyFrames();
    if (frames.length === 0) return;
    if (sendState.phase !== 'confirm') {
      setSendState({ phase: 'confirm', count: frames.length, sent: 0, failed: 0 }, SEND_CONFIRM_MS);
      return;
    }
    const progress = { phase: /** @type {const} */ ('sending'), count: frames.length, sent: 0, failed: 0 };
    setSendState(progress, null);
    for (const frame of frames) {
      // メニューは 1 つずつしか開けないので、順に送る
      const sent = await sendNotInterested(frame);
      frame.setAttribute(SENT_ATTRIBUTE, sent ? 'sent' : 'failed');
      if (sent) progress.sent += 1;
      else progress.failed += 1;
      setSendState({ ...progress }, null);
    }
    setSendState({ ...progress, phase: 'done' }, SEND_DONE_MS);
  }

  const scanner = createScanner({
    root: document,
    topicsUnreadable,
    getAiState: () => lm.getState(),
    cache,
    enqueue: (items) => queue.enqueue(items),
    onCounts(next) {
      counts = next;
      updateBar();
    },
  });

  new MutationObserver(() => scheduleScan()).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => scanner.scan(), SCAN_INTERVAL_MS);

  function mountBar() {
    bar = createBar(
      () => lm.activate(),
      () => void onSend(),
    );
    document.body.append(bar.element);
    updateBar();
  }
  if (document.body) mountBar();
  else document.addEventListener('DOMContentLoaded', mountBar, { once: true });

  window.addEventListener('pagehide', () => cache?.flush());
  void lm.init();
  scheduleScan();
}
