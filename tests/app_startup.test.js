import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, test } from 'vitest';

// Exercise the real app's rendering and asynchronous control flow. Only module
// boundaries and the DOM sink are replaced; no UI state machine is copied here.
const appFile = process.env.LIBRARY_APP_TEST_SOURCE || resolve('src/app.js');
const appSource = readFileSync(appFile, 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replaceAll('import.meta.env.BASE_URL', JSON.stringify('/library-ontology-tutorial/'));
const evidence = JSON.parse(readFileSync(resolve('public/evidence/hermit-results.json'), 'utf8'));
const snapshot = {
  metrics: { titles: 1, copies: 2, activeLoans: 1 },
  titles: [{ id: 'little-prince', title: '어린 왕자' }],
  copies: [{ id: 'copy-one', label: '어린 왕자 · 1번 실물' }, { id: 'copy-two', label: '어린 왕자 · 2번 실물' }],
  loans: [{ copy_id: 'copy-one', status: 'active' }],
};
const waitTurn = () => new Promise(resolveTurn => setTimeout(resolveTurn, 0));
function deferred() {
  let finish;
  const promise = new Promise(resolvePromise => { finish = resolvePromise; });
  return { promise, finish };
}
function runApp({ chapter = 'books', snapshotPromise = Promise.resolve(snapshot), failedEvidence = false } = {}) {
  const root = { innerHTML: '', addEventListener() {}, querySelectorAll: () => [] };
  const context = {
    document: { querySelector: () => root },
    location: { hash: `#${chapter}`, pathname: '/', search: '' },
    localStorage: { getItem: () => null, setItem() {} },
    history: { replaceState() {} }, window: { addEventListener() {} },
    lessons: [{ id: chapter, title: '학습', tool: 'SQL', analogy: '', figure: '', alt: '', explanation: [], code: '', language: '', sources: [] }],
    glossary: [], Parser: class {},
    createLab: async () => ({ getSnapshot: () => snapshotPromise }),
    fetch: async () => {
      if (failedEvidence === 'network') throw new TypeError('Failed to fetch');
      return failedEvidence
        ? { ok: false, status: 503 }
        : { ok: true, json: async () => evidence };
    },
  };
  const finished = vm.runInNewContext(`(async () => {${appSource}\n})()`, context);
  return { root, finished };
}

describe('app startup at asynchronous engine boundaries', () => {
  test('fast evidence never marks the SQL engine ready before its snapshot exists', async () => {
    const firstSnapshot = deferred();
    const app = runApp({ snapshotPromise: firstSnapshot.promise });
    try {
      await waitTurn();
      expect(app.root.innerHTML).toContain('data-ready="false"');
      expect(app.root.innerHTML).not.toContain('어린 왕자 · 1번 실물</strong>');
    } finally {
      firstSnapshot.finish(snapshot);
      await app.finished;
    }
    expect(app.root.innerHTML).toContain('data-ready="true"');
    expect(app.root.innerHTML).toContain('어린 왕자 · 1번 실물</strong>');
  });

  test.each([
    ['HTTP failure', true, 'hermit-results.json: HTTP 503'],
    ['network failure', 'network', 'hermit-results.json'],
  ])('%s for stored evidence produces a visible error instead of perpetual loading', async (_, failedEvidence, detail) => {
    const app = runApp({ chapter: 'owl', failedEvidence });
    await app.finished;
    await waitTurn();
    expect(app.root.innerHTML).toContain('role="alert"');
    expect(app.root.innerHTML).toContain(detail);
    expect(app.root.innerHTML).not.toContain('실행 증거를 불러오는 중입니다.');
  });
});
