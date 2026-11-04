import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMenuListItems, notInterestedIndex } from '../src/not-interested.js';

/**
 * メニューの項目のデータを作る（docs/dom-structure.md の「興味なし」の見分け方）。
 * @param {string|null} icon アイコンの名前
 * @param {boolean} feedback 押したときの命令が feedbackEndpoint か
 * @param {string} [title] 文言
 */
function item(icon, feedback, title = '項目') {
  return {
    listItemViewModel: {
      title: { content: title },
      leadingImage: icon ? { sources: [{ clientResource: { imageName: icon } }] } : undefined,
      rendererContext: {
        commandContext: {
          onTap: { innertubeCommand: feedback ? { feedbackEndpoint: { token: 't' } } : { signalServiceEndpoint: {} } },
        },
      },
    },
  };
}

const MENU = [
  item('ADD_TO_QUEUE_TAIL', false),
  item('WATCH_LATER', false),
  item(null, false),
  item('HIDE', true, '興味なし'),
  item('REMOVE', true, 'チャンネルをおすすめに表示しない'),
  item('FLAG', false),
];

test('「興味なし」はアイコンが HIDE で命令が feedbackEndpoint の項目', () => {
  assert.equal(notInterestedIndex(MENU), 3);
});

test('見つからないときや、当てはまる項目が 2 つ以上あるときは -1（確実に特定できないので押さない）', () => {
  assert.equal(notInterestedIndex(MENU.filter((_, index) => index !== 3)), -1);
  assert.equal(notInterestedIndex([...MENU, item('HIDE', true)]), -1);
  // アイコンが HIDE でも、命令が feedbackEndpoint でなければ当てはめない
  assert.equal(notInterestedIndex([item('HIDE', false)]), -1);
  assert.equal(notInterestedIndex([]), -1);
});

test('動画の枠のデータから、メニューの項目の一覧を探す', () => {
  const lockup = {
    contentId: 'x',
    metadata: {
      lockupMetadataViewModel: {
        menuButton: {
          buttonViewModel: {
            onTap: {
              innertubeCommand: {
                showSheetCommand: {
                  panelLoadingStrategy: {
                    inlineContent: { sheetViewModel: { content: { listViewModel: { listItems: MENU } } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
  assert.equal(findMenuListItems(lockup), MENU);
  const shorts = {
    entityId: 'y',
    menuOnTap: {
      innertubeCommand: {
        showSheetCommand: {
          panelLoadingStrategy: {
            inlineContent: { sheetViewModel: { content: { listViewModel: { listItems: MENU } } } },
          },
        },
      },
    },
  };
  assert.equal(findMenuListItems(shorts), MENU);
});

test('一覧が無いデータでは null', () => {
  assert.equal(findMenuListItems(null), null);
  assert.equal(findMenuListItems({ contentId: 'x' }), null);
});
