/**
 * @file 避けたい話題（「値」タブの avoidTopics）の期限の扱い。
 */

/**
 * 避けたい話題。
 * @typedef {object} AvoidTopic
 * @property {string} name 話題の名前。帯の文言と、AI の応答の topic に使う
 * @property {string} description AI への判定基準の説明
 * @property {string} [until] この日（YYYY-MM-DD、端末の日付）まで判定する。無ければ期限なし
 */

/**
 * 端末の時刻の日付を YYYY-MM-DD で返す。
 * @param {Date} date 日時
 * @returns {string}
 */
export function localDateString(date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 期限を過ぎていない話題だけを返す。until の日の終わりまでは判定する。
 * 日付はどちらも YYYY-MM-DD なので、文字列の大小で比べられる。
 * @param {AvoidTopic[]} topics 話題
 * @param {string} today 今日の日付（YYYY-MM-DD）
 * @returns {AvoidTopic[]}
 */
export function activeTopics(topics, today) {
  return topics.filter((topic) => topic.until === undefined || topic.until >= today);
}
