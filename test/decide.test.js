import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HINT_THRESHOLD, buildBarText, decideFrame, sendButtonLabel } from '../src/decide.js';

const READY = { mode: 'ready' };

test('保存済みの判定があればそれを使う', () => {
  assert.deepEqual(
    decideFrame({
      topicsUnreadable: false,
      aiState: READY,
      cached: { level: 'likely', topic: '災害' },
      timedOut: false,
    }),
    {
      state: 'likely',
      topic: '災害',
      reason: null,
    },
  );
});

test('判定が無く AI が使えるなら順番待ちに入れる', () => {
  assert.deepEqual(decideFrame({ topicsUnreadable: false, aiState: READY, cached: null, timedOut: false }), {
    enqueue: true,
  });
  // 準備中も順番待ちに入れて待つ（枠は隠したまま）
  assert.deepEqual(
    decideFrame({
      topicsUnreadable: false,
      aiState: { mode: 'initializing', progress: null },
      cached: null,
      timedOut: false,
    }),
    { enqueue: true },
  );
});

test('avoidTopics を読めないときは、保存済みの判定があっても判定できなかったことにする', () => {
  assert.deepEqual(
    decideFrame({ topicsUnreadable: true, aiState: READY, cached: { level: 'none', topic: null }, timedOut: false }),
    { state: 'unknown', topic: null, reason: 'settings' },
  );
});

test('AI が使えないときは判定できなかったことにする', () => {
  for (const aiState of [
    { mode: 'needs-activation' },
    { mode: 'disabled', disabledReason: 'unsupported' },
    { mode: 'disabled', disabledReason: 'unavailable' },
    { mode: 'failed' },
  ]) {
    assert.deepEqual(decideFrame({ topicsUnreadable: false, aiState, cached: null, timedOut: false }), {
      state: 'unknown',
      topic: null,
      reason: 'ai',
    });
  }
});

test('時間切れで判定が得られなかったものは判定できなかったことにする', () => {
  assert.deepEqual(decideFrame({ topicsUnreadable: false, aiState: READY, cached: null, timedOut: true }), {
    state: 'unknown',
    topic: null,
    reason: 'timeout',
  });
});

test('件数バーは隠した件数とぼかした件数を出し、多いときだけ「興味なし」を促す', () => {
  const few = buildBarText({ hidden: 1, blurred: 1, aiState: READY, topicsUnreadable: false });
  assert.match(few.status, /1 件を隠し/);
  assert.match(few.status, /1 件をぼかし/);
  assert.equal(few.hint, null);

  const many = buildBarText({ hidden: HINT_THRESHOLD, blurred: 0, aiState: READY, topicsUnreadable: false });
  assert.match(many.hint ?? '', /興味なし/);
});

test('件数バーは AI の状態と設定の誤りを知らせる', () => {
  const base = { hidden: 0, blurred: 0, topicsUnreadable: false };
  assert.match(buildBarText({ ...base, aiState: { mode: 'initializing', progress: 0.42 } }).status, /準備.*42%/);
  assert.equal(buildBarText({ ...base, aiState: { mode: 'needs-activation' } }).needsActivation, true);
  assert.match(buildBarText({ ...base, aiState: { mode: 'failed' } }).status, /AI が使えない/);
  assert.match(buildBarText({ ...base, aiState: READY, topicsUnreadable: true }).status, /avoidTopics/);
});

test('件数バーの「興味なし」のボタンは、送る前にもう一度押させて確かめる', () => {
  assert.equal(sendButtonLabel({ phase: 'idle', count: 3, sent: 0, failed: 0 }), '消した 3 件に「興味なし」を送る');
  assert.match(sendButtonLabel({ phase: 'confirm', count: 3, sent: 0, failed: 0 }), /もう一度押すと.*3 件/);
  assert.equal(sendButtonLabel({ phase: 'sending', count: 3, sent: 1, failed: 0 }), '送っています（1 / 3）');
  assert.equal(
    sendButtonLabel({ phase: 'done', count: 3, sent: 2, failed: 1 }),
    '2 件に送りました。1 件は操作できませんでした',
  );
  assert.equal(sendButtonLabel({ phase: 'done', count: 2, sent: 2, failed: 0 }), '2 件に送りました');
});

test('「興味なし」を促す文言は、帯と件数バーのボタンを指す', () => {
  const many = buildBarText({ hidden: HINT_THRESHOLD, blurred: 0, aiState: READY, topicsUnreadable: false });
  assert.match(many.hint ?? '', /帯/);
  assert.match(many.hint ?? '', /下のボタン/);
});
