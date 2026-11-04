import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import vm from 'node:vm';
import { MODULE_ORDER, SRC_DIR, buildUserscript } from '../scripts/build.mjs';

// 結合方式では、MODULE_ORDER に無いモジュールは黙って dist から落ち、実行時に ReferenceError で止まる。
// 構文の検査（node --check）では見つからないので、一覧の突き合わせと、起動処理の実行で検出する。

test('src/ の全モジュールが MODULE_ORDER に入っている', () => {
  const sources = readdirSync(SRC_DIR)
    .filter((name) => name.endsWith('.js'))
    .sort();
  assert.deepEqual([...MODULE_ORDER].sort(), sources);
});

test('ビルド結果を実行すると、起動処理が例外なく最後まで走る', () => {
  // ブラウザにあって vm の新しいコンテキストに無いもののうち、top-level で使うものを渡す
  const context = { console, TextEncoder };
  assert.doesNotThrow(() => vm.runInNewContext(buildUserscript(), context));
});

test('話題を設定してビルド結果を実行すると、CSS を入れて見回りを始めるところまで例外なく走る', () => {
  /** @param {string} tag */
  const fakeElement = (tag) => {
    const attrs = new Map();
    const element = {
      tagName: tag.toUpperCase(),
      children: [],
      textContent: '',
      setAttribute: (name, value) => attrs.set(name, String(value)),
      getAttribute: (name) => attrs.get(name) ?? null,
      hasAttribute: (name) => attrs.has(name),
      removeAttribute: (name) => attrs.delete(name),
      append: (...children) => element.children.push(...children),
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
    };
    return element;
  };
  const html = fakeElement('html');
  const timers = [];
  const values = new Map([['avoidTopics', [{ name: '災害', description: '地震や台風の被害' }]]]);
  const context = {
    console: { ...console, warn() {}, debug() {} },
    TextEncoder,
    AbortSignal,
    AbortController,
    URL,
    document: {
      documentElement: html,
      body: null,
      createElement: fakeElement,
      addEventListener() {},
      querySelectorAll: () => [],
    },
    window: { addEventListener() {} },
    MutationObserver: class {
      observe() {}
    },
    setTimeout: (fn) => timers.push(fn),
    clearTimeout() {},
    setInterval() {},
    GM_getValue: (key) => values.get(key),
    GM_setValue: (key, value) => values.set(key, value),
  };

  assert.doesNotThrow(() => vm.runInNewContext(buildUserscript(), context));
  assert.equal(html.hasAttribute('data-ycontent-active'), true);
  assert.ok(
    html.children.some((child) => child.tagName === 'STYLE' && child.textContent.includes('visibility: hidden')),
  );
  // 予約した見回りも例外なく走る
  assert.doesNotThrow(() => timers.splice(0).forEach((fn) => fn()));
});
