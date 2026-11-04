import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiCache } from '../src/cache.js';
import { LEVEL_VERDICT_CODEC } from '../src/ai.js';

/** 保存先と予約を手で進められるキャッシュを作る。 */
function createHarness(initial) {
  let stored = initial;
  const tasks = [];
  const cache = createAiCache({
    maxEntries: 10,
    version: 'v1',
    verdictCodec: LEVEL_VERDICT_CODEC,
    storage: {
      load: () => stored,
      save: (value) => {
        stored = value;
      },
    },
    schedule: (fn) => {
      tasks.push(fn);
      return () => {};
    },
  });
  return { cache, stored: () => stored, run: () => tasks.splice(0).forEach((fn) => fn()) };
}

test('level と topic の判定を保存して読み直せる', () => {
  const first = createHarness(undefined);
  first.cache.set('a', 'h1', { level: 'likely', topic: '災害' });
  first.cache.set('b', 'h2', { level: 'maybe', topic: null });
  first.cache.set('c', 'h3', { level: 'none', topic: null });
  first.run();

  const second = createHarness(first.stored());
  assert.deepEqual(second.cache.get('a', 'h1'), { level: 'likely', topic: '災害' });
  assert.deepEqual(second.cache.get('b', 'h2'), { level: 'maybe', topic: null });
  assert.deepEqual(second.cache.get('c', 'h3'), { level: 'none', topic: null });
  assert.equal(second.cache.get('a', 'other'), null);
});

test('知らない level の保存値は捨てる', () => {
  const { cache } = createHarness({ version: 'v1', seq: 1, entries: { a: [3, null, 'h1', 1] } });
  assert.equal(cache.get('a', 'h1'), null);
});
