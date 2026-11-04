import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEV_OUTPUT_PATH, OUTPUT_PATH, USERSCRIPT_META, buildUserscript, devMeta } from '../scripts/build.mjs';

// 開発用のビルドは、Violentmonkey に配布するものと別のスクリプトとして入れ、「値」タブを分けるために使う。
// Violentmonkey は @name と @namespace の組でスクリプトを見分ける。

test('開発用のメタデータは @name と @namespace を変え、自動更新の URL を外す', () => {
  const meta = new Map(devMeta(USERSCRIPT_META));
  const release = new Map(USERSCRIPT_META);
  assert.equal(meta.get('name'), `${release.get('name')} (dev)`);
  assert.notEqual(meta.get('namespace'), release.get('namespace'));
  // 開発用のものが Release のファイルで上書きされないようにする
  assert.equal(meta.has('downloadURL'), false);
  assert.equal(meta.has('updateURL'), false);
  for (const key of ['version', 'match', 'run-at', 'inject-into', 'noframes']) {
    assert.equal(meta.get(key), release.get(key), key);
  }
  assert.deepEqual(
    devMeta(USERSCRIPT_META)
      .filter(([key]) => key === 'grant')
      .map(([, value]) => value),
    USERSCRIPT_META.filter(([key]) => key === 'grant').map(([, value]) => value),
  );
});

test('開発用のビルドは配布するものと別のファイルに書く', () => {
  assert.notEqual(DEV_OUTPUT_PATH, OUTPUT_PATH);
  assert.match(DEV_OUTPUT_PATH, /\.user\.js$/);
});

test('開発用のメタデータでも、ビルド結果はスクリプトとしてそのまま組み立てられる', () => {
  const output = buildUserscript({ meta: devMeta(USERSCRIPT_META) });
  assert.match(output, /^\/\/ @name\s+YouTube Content Filter \(dev\)$/m);
  assert.doesNotMatch(output, /^\/\/ @(?:downloadURL|updateURL)/m);
});
