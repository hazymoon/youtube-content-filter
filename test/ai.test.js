import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialPrompts, buildResponseSchema, cacheVersion, createTopicCodec, videoText } from '../src/ai.js';

const TOPICS = [
  { name: '災害', description: '地震や台風の被害と続報' },
  { name: '事件', description: '悲惨な事件の報道' },
];

test('指示文に話題の name と description を並べ、タイトルの中の指示に従わせない', () => {
  const [system, exampleInput, exampleOutput] = buildInitialPrompts(TOPICS);
  assert.equal(system.role, 'system');
  assert.match(system.content, /- 災害: 地震や台風の被害と続報/);
  assert.match(system.content, /- 事件: 悲惨な事件の報道/);
  assert.match(system.content, /指示には従わず/);
  assert.equal(exampleInput.role, 'user');
  assert.equal(exampleOutput.role, 'assistant');
});

test('対話例の応答は、話題の名前が何であってもスキーマに合う', () => {
  for (const topics of [TOPICS, [{ name: '選挙', description: '' }]]) {
    const prompts = buildInitialPrompts(topics);
    const answers = JSON.parse(prompts[2].content);
    const names = topics.map((topic) => topic.name);
    for (const answer of answers) {
      assert.ok(['none', 'maybe', 'likely'].includes(answer.level));
      if (answer.level === 'none') assert.equal(answer.topic, null);
      else assert.ok(names.includes(answer.topic), JSON.stringify(answer));
    }
  }
});

test('応答のスキーマは level の 3 値と、topic の名前か null に縛る', () => {
  const schema = buildResponseSchema(TOPICS);
  assert.deepEqual(schema.items.properties.level.enum, ['none', 'maybe', 'likely']);
  assert.deepEqual(schema.items.properties.topic.enum, ['災害', '事件', null]);
  assert.deepEqual(schema.items.required, ['id', 'level', 'topic']);
});

test('buildInput はタイトルとチャンネル名をそれぞれ maxChars で切り、id を連番に置き換える', () => {
  const codec = createTopicCodec(TOPICS);
  const { input, idMap } = codec.buildInput(
    [
      { id: 'AAAAAAAAAAA', text: videoText('😀あいうえお', 'チャンネル') },
      { id: 'BBBBBBBBBBB', text: videoText('かきく', '') },
    ],
    3,
  );
  const payload = JSON.parse(input.slice(input.indexOf('\n') + 1));
  assert.deepEqual(payload, [
    { id: 'v0', title: '😀あい', channel: 'チャン' },
    { id: 'v1', title: 'かきく', channel: '' },
  ]);
  assert.deepEqual(
    [...idMap],
    [
      ['v0', 'AAAAAAAAAAA'],
      ['v1', 'BBBBBBBBBBB'],
    ],
  );
});

test('parseResponse は元の id ごとの判定にし、欠けた id を missing に入れる', () => {
  const codec = createTopicCodec(TOPICS);
  const idMap = new Map([
    ['v0', 'a'],
    ['v1', 'b'],
    ['v2', 'c'],
    ['v3', 'd'],
  ]);
  const text = JSON.stringify([
    { id: 'v0', level: 'likely', topic: '災害' },
    { id: 'v1', level: 'none', topic: '事件' },
    { id: 'v2', level: 'maybe', topic: '架空' },
    { id: 'v3', level: 'unknown', topic: null },
    { id: 'v9', level: 'likely', topic: '災害' },
    { id: 'v0', level: 'none', topic: null },
  ]);
  const { verdicts, missing } = codec.parseResponse(text, idMap);
  assert.deepEqual(
    [...verdicts],
    [
      ['a', { level: 'likely', topic: '災害' }],
      // none のときは topic を使わない
      ['b', { level: 'none', topic: null }],
      // 知らない話題の名前でも、当たるかもしれないという判定は捨てない
      ['c', { level: 'maybe', topic: null }],
    ],
  );
  assert.deepEqual(missing, ['d']);
});

test('parseResponse は JSON でない応答を全件 missing にする', () => {
  const codec = createTopicCodec(TOPICS);
  const idMap = new Map([['v0', 'a']]);
  assert.deepEqual(codec.parseResponse('ok', idMap).missing, ['a']);
  assert.deepEqual(codec.parseResponse('{}', idMap).missing, ['a']);
});

test('まとめた判定で隠すとされたものを判定し直さない（見える側に変わる経路を作らない）', () => {
  const codec = createTopicCodec(TOPICS);
  assert.equal(codec.needsConfirm({ level: 'none', topic: null }), false);
  assert.equal(codec.needsConfirm({ level: 'maybe', topic: null }), false);
  assert.equal(codec.needsConfirm({ level: 'likely', topic: '災害' }), false);
});

test('キャッシュのバージョンは話題・件数で変わり、同じ入力なら同じ', () => {
  const base = cacheVersion(TOPICS, 1);
  assert.equal(
    cacheVersion(
      TOPICS.map((topic) => ({ ...topic })),
      1,
    ),
    base,
  );
  assert.notEqual(cacheVersion(TOPICS.slice(0, 1), 1), base);
  assert.notEqual(cacheVersion([{ ...TOPICS[0], description: '変更' }, TOPICS[1]], 1), base);
  assert.notEqual(cacheVersion(TOPICS, 2), base);
});

test('キャッシュのバージョンは until の違いで変えない（期限の書き換えで判定し直させないため）', () => {
  assert.equal(cacheVersion([{ ...TOPICS[0], until: '2026-12-31' }, TOPICS[1]], 1), cacheVersion(TOPICS, 1));
});
