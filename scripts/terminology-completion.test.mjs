import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../docs/prototypes/0_full-page-flow-prototype-ui-applied.html', import.meta.url), 'utf8');
function glossary() {
  const dom = new JSDOM('<div id="term-summary"></div><div id="term-status-filters"></div><div id="term-category-filters"></div><div id="term-results"></div>');
  const document = dom.window.document;
  const context = vm.createContext({ document, $: id => document.getElementById(id) });
  vm.runInContext(html.slice(html.indexOf('    const term='), html.indexOf('    function showTerminology(')), context);
  vm.runInContext('renderTerminology()', context);
  return { document, run: code => vm.runInContext(code, context) };
}

test('completed concepts are disjoint from every pending filter and survive reopening', () => {
  const g = glossary();
  const pending = g.run('terminology.filter(item=>!termIsApplied(item)).length');
  assert.equal(g.document.querySelectorAll('.term-card').length, pending);
  g.document.querySelector('[data-term-status="applied"]').click();
  assert.equal(g.document.querySelectorAll('.term-card').length, 64);
  assert.ok([...g.document.querySelectorAll('.term-state')].every(n => n.textContent === '반영완료'));
  for (const status of ['all', 'merge', 'context', 'keep', 'custom']) {
    g.document.querySelector(`[data-term-status="${status}"]`).click();
    assert.equal([...g.document.querySelectorAll('.term-state')].some(n => n.textContent === '반영완료'), false);
  }
  const reopened = glossary();
  reopened.document.querySelector('[data-term-status="applied"]').click();
  assert.equal(reopened.document.querySelectorAll('.term-card').length, 64);
});

test('completion search and category filters compose; latest user decisions win', () => {
  const g = glossary();
  g.document.querySelector('[data-term-status="applied"]').click();
  g.document.querySelector('[data-term-category="구매·입고"]').click();
  for (const term of ['결제금액', '입고 완료', '구매 내역']) {
    g.run(`termView.query=${JSON.stringify(term)};renderTerminology()`);
    assert.ok([...g.document.querySelectorAll('.term-card-title')].some(n => n.textContent === term));
  }
  assert.equal(g.run('terminology.some(item=>item.canonical==="기록한 값 합계")'), false);
  assert.equal(g.run('terminology.some(item=>item.canonical==="메뉴별 매출"&&termIsApplied(item))'), true);
  g.run('termView.query="존재하지않는검색결과";renderTerminology()');
  assert.ok(g.document.querySelector('.term-empty'));
});
