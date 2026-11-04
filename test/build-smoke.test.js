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
