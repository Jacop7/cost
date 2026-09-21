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
  assert.equal(g.document.querySelectorAll('.term-card').length, 61);
  assert.ok([...g.document.querySelectorAll('.term-state')].every(n => n.textContent === '반영완료'));
  for (const status of ['all', 'merge', 'context', 'keep', 'custom']) {
    g.document.querySelector(`[data-term-status="${status}"]`).click();
    assert.equal([...g.document.querySelectorAll('.term-state')].some(n => n.textContent === '반영완료'), false);
  }
  const reopened = glossary();
  reopened.document.querySelector('[data-term-status="applied"]').click();
  assert.equal(reopened.document.querySelectorAll('.term-card').length, 61);
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

test('current Korean baseline keeps material, sales lifecycle, and settings contexts distinct', () => {
  const g = glossary();
  for (const canonical of ['재료', '재료명', '재료 카테고리', '(−) 재료 원가', '재료 원가']) {
    assert.equal(g.run(`terminology.some(item=>item.canonical===${JSON.stringify(canonical)})`), true);
  }
  for (const stale of ['식재료', '식재료명', '식재료 카테고리', '(−) 식재료 원가', '식재료 원가']) {
    assert.equal(g.run(`terminology.some(item=>item.canonical===${JSON.stringify(stale)})`), false);
  }
  for (const stale of ['마감 완료', '미입력']) {
    assert.equal(g.run(`terminology.some(item=>item.canonical===${JSON.stringify(stale)})`), false);
  }
  for (const status of ['미작성', '작성 중', '작성 완료']) {
    assert.equal(g.run(`terminology.some(item=>item.category==='상태·기록'&&item.canonical===${JSON.stringify(status)}&&termIsApplied(item))`), true);
  }
  assert.equal(g.run(`terminology.some(item=>item.category==='매장·설정'&&item.canonical==='재료 설정')`), true);
  assert.equal(g.run(`terminology.some(item=>item.category==='매장·설정'&&item.canonical==='메뉴 설정')`), true);
  assert.equal(g.run(`terminology.some(item=>!['merge','context','keep','custom'].includes(item.status))`), false);
  assert.equal(g.run(`appliedTermKeys.size`), 61);
  assert.equal(g.run(`[...appliedTermKeys].every(key=>terminology.some(item=>key===item.category+'::'+item.canonical))`), true);
  assert.equal(g.document.querySelector('#term-summary b')?.textContent, '2026-09-21');
});

test('source-wide audit supplement is complete, categorized, and collision free', () => {
  const g = glossary();
  assert.equal(g.run('terminology.length'), 311);
  assert.equal(g.run('terminology.length-appliedTermKeys.size'), 250);
  assert.equal(g.run(`new Set(terminology.map(item=>item.category+'::'+item.canonical)).size`), 311);
  assert.equal(g.run(`terminology.every(item=>termCategoryOrder.includes(item.category))`), true);
  assert.equal(g.run(`terminology.every(item=>['merge','context','keep','custom'].includes(item.status))`), true);
  assert.equal(g.run(`terminology.every(item=>!item.variants.includes(item.canonical)&&new Set(item.variants).size===item.variants.length)`), true);
  for (const [category, canonical] of [
    ['재료·재고', '실사'],
    ['구매·입고', '입고 취소'],
    ['메뉴', '판매 상태'],
    ['메뉴', '재료 부족'],
    ['매출·손익', '손익 계산'],
    ['세금·통화', '세금 정책'],
    ['매장·설정', '지역 설정'],
    ['매장·설정', '지원 언어'],
    ['계정·인증', '로그인'],
    ['상태·기록', '미산출'],
    ['상태·기록', '최신 내역으로 다시 입력'],
  ]) {
    assert.equal(g.run(`terminology.some(item=>item.category===${JSON.stringify(category)}&&item.canonical===${JSON.stringify(canonical)})`), true);
  }
  for (const stale of ['철회', '발주 건', '추가 지출 배분', '언어 · 통화', '언어 · 지역', '재료 설정 / 메뉴 설정', '사용 안 함', '마지막 기록', '오늘 기록 기준', '원화 (KRW)', '추가 세금 항목']) {
    assert.equal(g.run(`terminology.some(item=>item.canonical===${JSON.stringify(stale)})`), false);
  }
  assert.equal(g.run(`terminology.some(item=>item.category==='발주'&&item.canonical==='발주 취소'&&termIsApplied(item))`), true);
  assert.equal(g.run(`terminology.some(item=>item.category==='구매·입고'&&item.canonical==='입고 취소'&&termIsApplied(item))`), true);
  assert.equal(g.run(`terminology.some(item=>item.canonical==='추가 지출'&&item.rule.includes('임의 배분하지 않습니다'))`), true);
  assert.equal(g.run(`terminology.some(item=>item.canonical==='지역 설정'&&item.variants.includes('언어 · 통화')&&item.variants.includes('언어 · 지역'))`), true);
  assert.equal(g.run(`terminology.some(item=>item.canonical==='사용하지 않는 채널'&&item.variants.includes('사용 안 함')&&item.variants.includes('비활성'))`), true);
  assert.equal(g.run(`terminology.some(item=>item.category==='세금·통화'&&item.canonical==='통화 최소 단위'&&item.variants.includes('통화 소수 자릿수')&&item.rule.includes('사용자가 고르는 설정이나 별도 페이지가 아니며'))`), true);
  assert.equal(g.run(`terminology.some(item=>item.category==='세금·통화'&&item.canonical==='통화 소수 자릿수')`), false);
  assert.equal(g.run(`terminology.some(item=>item.canonical==='단가 소수 자릿수'&&item.rule.includes('총금액·결제금액에는 적용하지 않으며'))`), true);
  assert.equal(g.run(`terminology.some(item=>item.canonical==='통화·단가 입력 표기'&&item.rule.includes('1,200원 · 4.00원/g')&&item.rule.includes('두 자릿수를 같게 맞추지 않습니다'))`), true);
  assert.equal(g.run(`terminology.some(item=>item.canonical==='12,000원'&&item.rule.includes('소수점 없이 표시합니다'))`), true);
  assert.equal(g.run(`termCategoryOrder.includes('재료·재고')`), true);
  assert.equal(g.run(`termCategoryOrder.includes('계정·인증')`), true);
});
