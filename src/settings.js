/**
 * @file Violentmonkey の「値」タブに書く設定の読み書き。設定ブロックの定数を上書きする値を扱う。
 *
 * スクリプト本体の定数は自動更新でスクリプトごと置き換わると既定値に戻るが、値は貼り替えても残る。
 */

import { AI_BATCH_SIZE, AI_CACHE_MAX_ENTRIES, AI_ENABLED, AI_MAX_CHARS, AI_TIMEOUT_MS, DEBUG } from './config.js';

/**
 * 「値」タブで設定ブロックの定数を上書きする値。各プロパティの説明は対応する config.js の定数。
 * @typedef {object} StoredOptions
 * @property {boolean} aiEnabled AI_ENABLED
 * @property {number} aiBatchSize AI_BATCH_SIZE
 * @property {number} aiTimeoutMs AI_TIMEOUT_MS
 * @property {number} aiMaxChars AI_MAX_CHARS
 * @property {number} aiCacheMaxEntries AI_CACHE_MAX_ENTRIES
 * @property {boolean} debug DEBUG
 */

/**
 * 値が真偽値かを確かめる。
 * @param {unknown} value 値
 * @returns {string|null} 不正なら理由、正しければ null
 */
function checkStoredBoolean(value) {
  return typeof value === 'boolean' ? null : 'true か false で書いてください';
}

/**
 * 値が下限以上の整数かを確かめる関数を作る。
 * @param {number} min 下限（含む）
 * @returns {(value: unknown) => string|null} 不正なら理由、正しければ null を返す関数
 */
function storedIntegerAtLeast(min) {
  return (value) => (Number.isInteger(value) && Number(value) >= min ? null : `${min} 以上の整数で書いてください`);
}

/**
 * 値が下限以上・上限以下の整数かを確かめる関数を作る。
 * @param {number} min 下限（含む）
 * @param {number} max 上限（含む）
 * @returns {(value: unknown) => string|null} 不正なら理由、正しければ null を返す関数
 */
function storedIntegerBetween(min, max) {
  return (value) =>
    Number.isInteger(value) && Number(value) >= min && Number(value) <= max
      ? null
      : `${min} 以上 ${max} 以下の整数で書いてください`;
}

/**
 * setTimeout が受け付ける待ち時間の上限（ミリ秒。32 ビットの符号付き整数の最大値）。
 * 超える値はタイマーの範囲外で、すぐ発火するなど、指定どおりに待たない（Node では 1 ミリ秒に丸められた）
 */
const MAX_STORED_TIMEOUT_MS = 2147483647;

/** aiBatchSize の上限。まとめた判定の所要時間と正確さを計測したのが 10 件までのため（youtube-comment-filter の docs/spike.md） */
const MAX_STORED_BATCH_SIZE = 10;

/**
 * 設定ブロックの定数を上書きする値の表（値の名前 → 既定値・検査・読んだ値の写し方）。
 * 下限は、その値を下回ると動きが壊れる境目にする。
 * - aiEnabled / debug: 真偽値
 * - aiBatchSize: 1 以上 10 以下の整数（1 で 1 件ずつ判定する。上限は youtube-comment-filter の docs/spike.md で計測した件数）
 * - aiTimeoutMs: 1 以上 2147483647 以下の整数（ミリ秒。0 以下では判定がすぐ打ち切られる。上限は setTimeout の上限）
 * 上限は、超えると動きが壊れるか計測していない範囲に入るキーにだけ付ける。
 * - aiMaxChars: 1 以上の整数（0 では AI に文字列が渡らない）
 * - aiCacheMaxEntries: 1 以上の整数（0 では判定結果を保存できない）
 * @type {Record<keyof StoredOptions, { defaultValue: unknown, defaultLabel?: string, check: (value: unknown) => string|null, copy?: (value: any) => unknown }>}
 */
const STORED_OPTION_SPECS = {
  aiEnabled: { defaultValue: AI_ENABLED, check: checkStoredBoolean },
  aiBatchSize: { defaultValue: AI_BATCH_SIZE, check: storedIntegerBetween(1, MAX_STORED_BATCH_SIZE) },
  aiTimeoutMs: { defaultValue: AI_TIMEOUT_MS, check: storedIntegerBetween(1, MAX_STORED_TIMEOUT_MS) },
  aiMaxChars: { defaultValue: AI_MAX_CHARS, check: storedIntegerAtLeast(1) },
  aiCacheMaxEntries: { defaultValue: AI_CACHE_MAX_ENTRIES, check: storedIntegerAtLeast(1) },
  debug: { defaultValue: DEBUG, check: checkStoredBoolean },
};

/**
 * 「値」タブで設定ブロックの定数を上書きする値を読む。値の名前と範囲は STORED_OPTION_SPECS にある。
 * 値が無い（undefined / null）ときは config.js の既定値を使う。
 * 不正な値は例外にせず既定値に戻し、理由を warnings に入れる（設定の 1 か所の誤りでスクリプト全体を止めないため）。
 * @param {(key: string) => unknown} read 値の名前から値を読む関数（GM_getValue）
 * @returns {{ options: StoredOptions, warnings: string[] }}
 */
export function parseStoredOptions(read) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {Record<string, unknown>} */
  const options = {};
  for (const [key, spec] of Object.entries(STORED_OPTION_SPECS)) {
    const value = read(key);
    let chosen = value;
    if (value === undefined || value === null) {
      chosen = spec.defaultValue;
    } else {
      const problem = spec.check(value);
      if (problem) {
        // 書いた値と既定値を取り違えないよう、どちらの値かを名指しして並べる
        const defaultText = spec.defaultLabel ?? JSON.stringify(spec.defaultValue);
        warnings.push(`値 ${key}: ${problem}。書いた値: ${JSON.stringify(value)}。既定値 ${defaultText} を使います`);
        chosen = spec.defaultValue;
      }
    }
    // 既定値も写す。config.js の配列をそのまま渡すと、受け取った側の変更が既定値に及ぶため
    options[key] = spec.copy ? spec.copy(chosen) : chosen;
  }
  return { options: /** @type {StoredOptions} */ (options), warnings };
}
