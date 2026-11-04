/**
 * @file 設定の既定値。
 * Violentmonkey のエディタでこのブロックの値を書き換えて保存すると反映されるが、自動更新でスクリプトごと置き換わると消える。
 * 値はスクリプトを貼り替えても自動更新しても残るので、変えたい設定は Violentmonkey のスクリプトの「値」タブに書くとよい。
 *
 * 定数は、各定数のコメントにある値の名前で「値」タブに書くと上書きできる。
 * 値が無いときはこのブロックの既定値を使う。不正な値は既定値に戻し、理由を DevTools の console に出す
 * （型と範囲は src/settings.js の STORED_OPTION_SPECS）。
 * これらの値は起動時に作らない。既定値を書き込むと、後のリリースで既定値を変えても、既に使っている人には届かなくなるため。
 */

/**
 * 端末内の AI（Chrome の Prompt API）で動画を判定するか。
 * 「値」タブの aiEnabled で上書きできる。
 * @type {boolean}
 */
export const AI_ENABLED = true;

/**
 * 1 回の AI 呼び出しでまとめて判定する件数。1 にすると 1 件ずつ判定する。
 * 変更すると過去の判定結果のキャッシュは使われなくなり、判定し直す（方式を比べられるようにするため）。
 * 「値」タブの aiBatchSize で上書きできる。
 * @type {number}
 */
export const AI_BATCH_SIZE = 1;

/**
 * 1 バッチの判定にかける時間の上限（ミリ秒）。
 * 超えたものは「判定待ち」として扱い、1 回だけ判定し直す。
 * 「値」タブの aiTimeoutMs で上書きできる。
 * @type {number}
 */
export const AI_TIMEOUT_MS = 30000;

/**
 * AI に渡す 1 件の文字列の最大文字数。超えた分は切り捨てる。
 * セッションの入力枠を長文 1 件で使い切らないようにするため。
 * 「値」タブの aiMaxChars で上書きできる。
 * @type {number}
 */
export const AI_MAX_CHARS = 500;

/**
 * AI の判定結果を保存しておく件数の上限。超えたら最後に使った時期が古いものから捨てる。
 * 保存は全件をまとめて書き込むため、件数が増えるほど 1 回の書き込みが重くなる。
 * 「値」タブの aiCacheMaxEntries で上書きできる。
 * @type {number}
 */
export const AI_CACHE_MAX_ENTRIES = 5000;

/**
 * true にすると、判定の経過を DevTools の console に出す。
 * 「値」タブの debug で上書きできる。
 * @type {boolean}
 */
export const DEBUG = false;
