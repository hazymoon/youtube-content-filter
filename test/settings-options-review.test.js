import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_MAX_CHARS } from '../src/config.js';
import { parseStoredOptions } from '../src/settings.js';

// parseStoredOptions のレビューで見つかった不具合の再発を防ぐ。

/**
 * 1 つのキーだけを書いたときの結果。
 * @param {string} key 値の名前
 * @param {unknown} value 値
 */
function parseOne(key, value) {
  return parseStoredOptions((k) => (k === key ? value : undefined));
}

test('aiTimeoutMs は setTimeout の上限（2147483647）までを使い、超えたら既定値に戻して警告する', () => {
  assert.equal(parseOne('aiTimeoutMs', 2147483647).options.aiTimeoutMs, 2147483647);
  assert.deepEqual(parseOne('aiTimeoutMs', 2147483647).warnings, []);
  const result = parseOne('aiTimeoutMs', 2147483648);
  assert.notEqual(result.options.aiTimeoutMs, 2147483648);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /aiTimeoutMs/);
});

test('aiBatchSize は 10 までを使い、超えたら既定値に戻して警告する', () => {
  assert.equal(parseOne('aiBatchSize', 10).options.aiBatchSize, 10);
  assert.deepEqual(parseOne('aiBatchSize', 10).warnings, []);
  const result = parseOne('aiBatchSize', 11);
  assert.notEqual(result.options.aiBatchSize, 11);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /aiBatchSize/);
});

test('警告は、書いた値と使う既定値を取り違えない形で示す', () => {
  const result = parseOne('aiMaxChars', 0);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], new RegExp(`書いた値: 0。既定値 ${AI_MAX_CHARS} を使います`));
});
