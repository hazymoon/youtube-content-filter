/**
 * @file Violentmonkey の「値」タブに書く設定の読み書き。設定ブロックの定数を上書きする値を扱う。
 *
 * スクリプト本体の定数は自動更新でスクリプトごと置き換わると既定値に戻るが、値は貼り替えても残る。
 */

import { AI_BATCH_SIZE, AI_CACHE_MAX_ENTRIES, AI_ENABLED, AI_MAX_CHARS, AI_TIMEOUT_MS, DEBUG } from './config.js';

/** 値の名前。「値」タブにこの名前で避けたい話題の配列を書く。初回の起動で空の配列として作る */
export const AVOID_TOPICS_VALUE_KEY = 'avoidTopics';

/** until に書ける日付の形 */
const TOPIC_UNTIL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * until が YYYY-MM-DD の形で、実在する日付か。
 * @param {unknown} value 値
 * @returns {boolean}
 */
function isValidTopicUntil(value) {
  if (typeof value !== 'string') return false;
  const match = TOPIC_UNTIL_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // 2 月 30 日のような日付は翌月に繰り上がるので、組み立て直して同じになるかで確かめる
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * 話題の要素が正しい形か。
 * @param {unknown} topic 要素
 * @returns {boolean}
 */
function isValidTopic(topic) {
  if (typeof topic !== 'object' || topic === null || Array.isArray(topic)) return false;
  const { name, description, until } = /** @type {Record<string, unknown>} */ (topic);
  return (
    typeof name === 'string' &&
    name !== '' &&
    typeof description === 'string' &&
    (until === undefined || isValidTopicUntil(until))
  );
}

/**
 * 「値」タブの avoidTopics を読む。
 *
 * 不正な値は既定値（空の配列）に戻さず、topics を null にして読めなかったことを返す。
 * 空に戻すと何も隠れなくなり、避けたい話題が黙って見えてしまうため、呼び出し側は全部の動画を
 * 「判定できませんでした」のぼかしで見せる。要素が 1 つでも不正なら全体を読めなかったことにする
 * （不正な要素だけを捨てると、その話題が黙って判定から抜けるため）。
 * @param {unknown} value GM_getValue の値
 * @returns {{ topics: import('./topics.js').AvoidTopic[]|null, missing: boolean, problem: string|null }}
 *   missing は値が無かったか（呼び出し側が空の配列を作る）。problem は読めなかった理由
 */
export function parseStoredAvoidTopics(value) {
  if (value === undefined || value === null) return { topics: [], missing: true, problem: null };
  const shape =
    '{ "name": 空でない文字列, "description": 文字列, "until": "YYYY-MM-DD"（省略できる） } を並べた配列で書いてください';
  if (!Array.isArray(value) || !value.every(isValidTopic)) {
    return { topics: null, missing: false, problem: `値 ${AVOID_TOPICS_VALUE_KEY}: ${shape}` };
  }
  // name は AI の応答の topic の enum になる（src/ai.js の buildResponseSchema）ので、重複させない
  const names = value.map((topic) => topic.name);
  if (new Set(names).size !== names.length) {
    return {
      topics: null,
      missing: false,
      problem: `値 ${AVOID_TOPICS_VALUE_KEY}: name が重複しないように書いてください`,
    };
  }
  const topics = value.map(({ name, description, until }) =>
    until === undefined ? { name, description } : { name, description, until },
  );
  return { topics, missing: false, problem: null };
}

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
