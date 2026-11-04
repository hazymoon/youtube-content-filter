import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeTopics, localDateString } from '../src/topics.js';

test('localDateString は端末の時刻の日付を YYYY-MM-DD で返す', () => {
  assert.equal(localDateString(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(localDateString(new Date(2026, 10, 30, 0, 0)), '2026-11-30');
});

test('until の無い話題はいつまでも判定する', () => {
  const topics = [{ name: '災害', description: '' }];
  assert.deepEqual(activeTopics(topics, '2099-12-31'), topics);
});

test('until の日までは判定し、その翌日から外す', () => {
  const topics = [
    { name: '事件', description: '', until: '2026-11-04' },
    { name: '災害', description: '' },
  ];
  assert.deepEqual(
    activeTopics(topics, '2026-11-04').map((topic) => topic.name),
    ['事件', '災害'],
  );
  assert.deepEqual(
    activeTopics(topics, '2026-11-05').map((topic) => topic.name),
    ['災害'],
  );
});
