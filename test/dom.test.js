import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFrame } from '../src/dom.js';

/**
 * readFrame が使う分だけの偽の要素。selector → 子要素の表で querySelector に答える。
 * @param {{ matches?: string[], attrs?: Record<string, string>, classes?: string[], text?: string, children?: Record<string, any> }} spec
 */
function el(spec = {}) {
  const children = spec.children ?? {};
  return {
    matches: (selector) =>
      (spec.matches ?? []).some((own) =>
        selector
          .split(',')
          .map((s) => s.trim())
          .includes(own),
      ),
    querySelector: (selector) => children[selector] ?? null,
    getAttribute: (name) => spec.attrs?.[name] ?? null,
    classList: spec.classes ?? [],
    textContent: spec.text ?? '',
  };
}

const LOCKUP_CHILDREN = (id, title, channel) => ({
  '.ytLockupViewModelHost': el({ classes: ['ytLockupViewModelHost', `content-id-${id}`] }),
  'a.ytLockupMetadataViewModelTitle': el({ text: title, attrs: { href: `/watch?v=${id}` } }),
  '.ytContentMetadataViewModelMetadataRow .ytAttributedStringHost': el({ text: channel }),
});

test('右の列の yt-lockup-view-model から ID・タイトル・チャンネル名を読む', () => {
  const frame = el({
    matches: ['yt-lockup-view-model'],
    children: LOCKUP_CHILDREN('AAAAAAAAAAA', 'タイトル', 'チャンネル'),
  });
  assert.deepEqual(readFrame(frame), { id: 'AAAAAAAAAAA', title: 'タイトル', channel: 'チャンネル' });
});

test('ホームの ytd-rich-item-renderer は中の yt-lockup-view-model を読む', () => {
  const lockup = el({ matches: ['yt-lockup-view-model'], children: LOCKUP_CHILDREN('BBBBBBBBBBB', 'T', 'C') });
  const frame = el({ matches: ['ytd-rich-item-renderer'], children: { 'yt-lockup-view-model': lockup } });
  assert.deepEqual(readFrame(frame), { id: 'BBBBBBBBBBB', title: 'T', channel: 'C' });
});

test('チャンネル名が無いときは空文字にする', () => {
  const children = LOCKUP_CHILDREN('CCCCCCCCCCC', 'T', '');
  delete children['.ytContentMetadataViewModelMetadataRow .ytAttributedStringHost'];
  assert.deepEqual(readFrame(el({ matches: ['yt-lockup-view-model'], children })), {
    id: 'CCCCCCCCCCC',
    title: 'T',
    channel: '',
  });
});

test('Shorts の枠は /shorts/<ID> とタイトルを読み、チャンネル名は空にする', () => {
  const shorts = el({
    children: {
      'h3 a[href^="/shorts/"]': el({ text: 'ショートのタイトル', attrs: { href: '/shorts/DDDDDDDDDDD?feature=x' } }),
    },
  });
  const frame = el({
    matches: ['.ytGridShelfViewModelGridShelfItem'],
    children: { 'ytm-shorts-lockup-view-model': shorts },
  });
  assert.deepEqual(readFrame(frame), { id: 'DDDDDDDDDDD', title: 'ショートのタイトル', channel: '' });
});

test('終わりの候補と自動再生の次の動画は href の v= とタイトル・チャンネル名を読む', () => {
  const still = el({
    matches: ['.ytp-videowall-still'],
    attrs: { href: 'https://www.youtube.com/watch?v=EEEEEEEEEEE&t=1' },
    children: {
      '.ytp-videowall-still-info-title': el({ text: '候補' }),
      '.ytp-videowall-still-info-author': el({ text: 'ch' }),
    },
  });
  assert.deepEqual(readFrame(still), { id: 'EEEEEEEEEEE', title: '候補', channel: 'ch' });

  const upnext = el({
    matches: ['.ytp-autonav-endscreen-link-container'],
    attrs: { href: 'https://www.youtube.com/watch?v=FFFFFFFFFFF' },
    children: {
      '.ytp-autonav-endscreen-upnext-title': el({ text: '次' }),
      '.ytp-autonav-endscreen-upnext-author': el({ text: 'ch2' }),
    },
  });
  assert.deepEqual(readFrame(upnext), { id: 'FFFFFFFFFFF', title: '次', channel: 'ch2' });
});

test('ID かタイトルを読めない枠は null（中身が入る前や広告）', () => {
  assert.equal(readFrame(el({ matches: ['ytd-rich-item-renderer'] })), null);
  const children = LOCKUP_CHILDREN('GGGGGGGGGGG', '', 'C');
  assert.equal(readFrame(el({ matches: ['yt-lockup-view-model'], children })), null);
  const noId = LOCKUP_CHILDREN('', 'T', 'C');
  assert.equal(readFrame(el({ matches: ['yt-lockup-view-model'], children: noId })), null);
});
