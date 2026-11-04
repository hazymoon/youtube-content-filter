/**
 * @file queue のテスト用の codec。youtube-comment-filter の src/ai.js の buildResponseSchema / buildBatchInput /
 * parseBatchResponse と同じ動きにする。queue.js を複製元から codec を受け取る形に変えたので、
 * 複製元のテストを期待値を変えずに通し、順番待ちの動きが複製元と同じかを確かめるために使う。
 */

const BATCH_INPUT_HEADER = '次のコメントを判定してください。';

/**
 * コメント用の codec を作る。
 * @param {{ name: string, description: string }[]} categories カテゴリ
 * @returns {import('../../src/queue.js').AiCodec<{ hide: boolean, category: string|null }>}
 */
export function createCommentCodec(categories) {
  const knownCategories = new Set(categories.map((category) => category.name));
  return {
    responseSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          hide: { type: 'boolean' },
          category: { type: ['string', 'null'], enum: [...categories.map((category) => category.name), null] },
        },
        required: ['id', 'hide', 'category'],
        additionalProperties: false,
      },
    },

    buildInput(items, maxChars) {
      /** @type {Map<string, string>} */
      const idMap = new Map();
      const payload = items.map((item, index) => {
        const seqId = `c${index}`;
        idMap.set(seqId, item.id);
        const text = Array.from(String(item.text ?? ''))
          .slice(0, maxChars)
          .join('');
        return { id: seqId, text };
      });
      return { input: `${BATCH_INPUT_HEADER}\n${JSON.stringify(payload)}`, idMap };
    },

    parseResponse(text, idMap) {
      /** @type {Map<string, { hide: boolean, category: string|null }>} */
      const verdicts = new Map();
      const allIds = [...idMap.values()];
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { verdicts, missing: allIds };
      }
      if (!Array.isArray(parsed)) return { verdicts, missing: allIds };
      /** @type {Set<string>} */
      const seen = new Set();
      for (const element of parsed) {
        if (element === null || typeof element !== 'object') continue;
        const seqId = element.id;
        if (typeof seqId !== 'string' || !idMap.has(seqId) || seen.has(seqId)) continue;
        seen.add(seqId);
        if (typeof element.hide !== 'boolean') continue;
        const category =
          typeof element.category === 'string' && knownCategories.has(element.category) ? element.category : null;
        verdicts.set(/** @type {string} */ (idMap.get(seqId)), { hide: element.hide, category });
      }
      return { verdicts, missing: allIds.filter((id) => !verdicts.has(id)) };
    },

    needsConfirm: (verdict) => verdict.hide,
  };
}
