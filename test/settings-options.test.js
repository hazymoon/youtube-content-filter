import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_BATCH_SIZE, AI_CACHE_MAX_ENTRIES, AI_ENABLED, AI_MAX_CHARS, AI_TIMEOUT_MS, DEBUG } from '../src/config.js';
import { parseStoredOptions } from '../src/settings.js';

// 設定ブロックの値は自動更新でスクリプトごと置き換わると消えるので、「値」タブの個別の値で上書きできるようにする。
// 値が無ければ config.js の既定値を使い、不正な値は既定値に戻して警告する。

const DEFAULTS = {
  aiEnabled: AI_ENABLED,
  aiBatchSize: AI_BATCH_SIZE,
  aiTimeoutMs: AI_TIMEOUT_MS,
  aiMaxChars: AI_MAX_CHARS,
  aiCacheMaxEntries: AI_CACHE_MAX_ENTRIES,
  debug: DEBUG,
};

/**
 * キー → 値の表から read 関数を作る。
 * @param {Record<string, unknown>} values 値
 */
function readerOf(values) {
  return (key) => values[key];
}

/**
 * 1 つのキーだけを書いたときの結果。
 * @param {string} key 値の名前
 * @param {unknown} value 値
 */
function parseOne(key, value) {
  return parseStoredOptions(readerOf({ [key]: value }));
}

test('値が無ければ（undefined / null）すべて config.js の既定値を使い、警告しない', () => {
  assert.deepEqual(parseStoredOptions(readerOf({})), { options: DEFAULTS, warnings: [] });
  const allNull = Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, null]));
  assert.deepEqual(parseStoredOptions(readerOf(allNull)), { options: DEFAULTS, warnings: [] });
});

test('読むのは対象の値の名前だけ', () => {
  const keys = [];
  parseStoredOptions((key) => {
    keys.push(key);
    return undefined;
  });
  assert.deepEqual(keys.toSorted(), Object.keys(DEFAULTS).toSorted());
});

test('正しい値はそのまま使う', () => {
  const values = {
    aiEnabled: false,
    aiBatchSize: 4,
    aiTimeoutMs: 15000,
    aiMaxChars: 200,
    aiCacheMaxEntries: 100,
    debug: true,
  };
  assert.deepEqual(parseStoredOptions(readerOf(values)), { options: values, warnings: [] });
});

test('真偽値の値に真偽値以外を書くと既定値に戻して警告する', () => {
  for (const key of ['aiEnabled', 'debug']) {
    for (const value of ['false', 0, 1, [], {}]) {
      const result = parseOne(key, value);
      assert.equal(result.options[key], DEFAULTS[key], `${key}: ${JSON.stringify(value)}`);
      assert.equal(result.warnings.length, 1, `${key}: ${JSON.stringify(value)}`);
      assert.match(result.warnings[0], new RegExp(key));
    }
  }
});

test('数値の値に整数以外を書くと既定値に戻して警告する', () => {
  for (const key of ['aiBatchSize', 'aiTimeoutMs', 'aiMaxChars', 'aiCacheMaxEntries']) {
    for (const value of ['10', 1.5, Number.NaN, Number.POSITIVE_INFINITY, true, [10]]) {
      const result = parseOne(key, value);
      assert.equal(result.options[key], DEFAULTS[key], `${key}: ${String(value)}`);
      assert.equal(result.warnings.length, 1, `${key}: ${String(value)}`);
      assert.match(result.warnings[0], new RegExp(key));
    }
  }
});

test('数値の値が下限より小さいと既定値に戻して警告する', () => {
  const tooSmall = { aiBatchSize: 0, aiTimeoutMs: 0, aiMaxChars: 0, aiCacheMaxEntries: 0 };
  for (const [key, value] of Object.entries(tooSmall)) {
    const result = parseOne(key, value);
    assert.equal(result.options[key], DEFAULTS[key], key);
    assert.equal(result.warnings.length, 1, key);
    assert.match(result.warnings[0], new RegExp(key));
  }
});

test('数値の値は下限ちょうどなら使う', () => {
  const lowest = { aiBatchSize: 1, aiTimeoutMs: 1, aiMaxChars: 1, aiCacheMaxEntries: 1 };
  for (const [key, value] of Object.entries(lowest)) {
    const result = parseOne(key, value);
    assert.equal(result.options[key], value, key);
    assert.deepEqual(result.warnings, [], key);
  }
});

test('不正な値が複数あれば、それぞれ警告し、正しい値は使う', () => {
  const result = parseStoredOptions(readerOf({ aiEnabled: 'yes', aiBatchSize: 0, aiMaxChars: 12 }));
  assert.equal(result.options.aiEnabled, AI_ENABLED);
  assert.equal(result.options.aiBatchSize, AI_BATCH_SIZE);
  assert.equal(result.options.aiMaxChars, 12);
  assert.equal(result.warnings.length, 2);
});
