import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStoredAvoidTopics } from '../src/settings.js';

// avoidTopics は隠したい話題そのものなので、読めないときに空として扱うと何も隠れなくなる。
// そのため不正な値は既定値に戻さず、読めなかったこと（topics: null）を返して、呼び出し側で全部をぼかす。

test('書いていなければ空の配列を返し、値を作るよう知らせる', () => {
  for (const value of [undefined, null]) {
    assert.deepEqual(parseStoredAvoidTopics(value), { topics: [], missing: true, problem: null });
  }
});

test('正しい値は name / description / until だけを写して使う', () => {
  const value = [
    { name: '災害', description: '地震や台風の被害', extra: 1 },
    { name: '事件', description: '', until: '2026-12-31' },
  ];
  const result = parseStoredAvoidTopics(value);
  assert.deepEqual(result, {
    topics: [
      { name: '災害', description: '地震や台風の被害' },
      { name: '事件', description: '', until: '2026-12-31' },
    ],
    missing: false,
    problem: null,
  });
  assert.notEqual(result.topics, value);
});

test('空の配列は、隠す話題が無いものとして使う', () => {
  assert.deepEqual(parseStoredAvoidTopics([]), { topics: [], missing: false, problem: null });
});

test('配列でない値や、要素が 1 つでも不正な値は読めなかったことにする', () => {
  const invalid = [
    '災害',
    { name: '災害', description: '' },
    [{ name: '', description: '' }],
    [{ name: '災害' }],
    [{ name: '災害', description: 1 }],
    [{ name: '災害', description: '' }, null],
    [{ name: '災害', description: '', until: '2026/12/31' }],
    [{ name: '災害', description: '', until: '2026-02-30' }],
    [{ name: '災害', description: '', until: 20261231 }],
  ];
  for (const value of invalid) {
    const result = parseStoredAvoidTopics(value);
    assert.equal(result.topics, null, JSON.stringify(value));
    assert.equal(result.missing, false, JSON.stringify(value));
    assert.match(result.problem ?? '', /avoidTopics/, JSON.stringify(value));
  }
});

test('name が重複していたら読めなかったことにする（AI の応答の enum に同じ値を入れないため）', () => {
  const result = parseStoredAvoidTopics([
    { name: '災害', description: 'a' },
    { name: '災害', description: 'b' },
  ]);
  assert.equal(result.topics, null);
  assert.match(result.problem ?? '', /重複/);
});
