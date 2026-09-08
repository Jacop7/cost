// Evidence accounting, not an implementation or release approval gate.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = 'ad775d756cba2cf415b2da4f258b0c089f12e488';
const registryPath = 'apps/mobile/src/dev/surfaceRegistry.generated.json';
const auditPath = 'docs/prototypes/full-page-flow-prototype-render-audit.json';
const reportBase = 'docs/ai-review/evidence/PROTOTYPE-EXPO-P3-';
const reports = {
  ingredients: `${reportBase}INGREDIENTS-ASTRA-20260908.md`,
  recipes: `${reportBase}RECIPES-REVIEW-20260909.md`,
  orders: `${reportBase}ORDERS-REVIEW-20260909.md`,
  sales: `${reportBase}SALES-REVIEW-20260909.md`,
};
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const requireValue = (value, message) => { if (!value) throw Error(message); };
const read = path => readFileSync(resolve(root, path), 'utf8');
const registry = JSON.parse(read(registryPath));
const audit = JSON.parse(read(auditPath));
const refs = new Set([registryPath, auditPath, ...Object.values(reports)]);
const assessments = new Map();
const validStatuses = ['SAMPLE_REVIEWED', 'PARTIAL', 'UNASSESSED', 'HIDDEN'];
function group(status, targets, report, section, scope, remaining, extra = []) {
  requireValue(validStatuses.includes(status), `bad status ${status}`);
  for (const ref of extra) refs.add(ref);
  for (const target of targets.split(/\s+/).filter(Boolean)) {
    requireValue(!assessments.has(target), `duplicate assessment ${target}`);
    assessments.set(target, { status, evidence: [{ path: reports[report], section }, ...extra.map(path => ({ path }))], scope, remaining });
  }
}

// Explicit state/host assignments. A shared component PASS is never expanded to
// every owning prototype target. Alias hosts stay PARTIAL until separately mapped.
group('SAMPLE_REVIEWED', 'screen:recipe_main popup:recipe_sort@recipe_main popup:recipe_status@recipe_main popup:recipe_target@recipe_main', 'recipes', 'RCP-01', '목록·검색·정렬·판매상태·목표 필터 웹 표본과 내부 검수', 'FAB/안내 겹침·추가 데이터·native·최종 게이트', ['docs/prototypes/three-surface-p3-recipes-visual/list-common-filters-20260909/recipes-list-evidence.json']);
group('SAMPLE_REVIEWED', 'screen:recipe_detail screen:recipe_add screen:recipe_edit screen:recipe_price_sim', 'recipes', '사용자 정정: 월평균 / 판매가 시뮬레이션', '폼·상세·시뮬레이션의 명시된 변경 및 시각 표본 한정 내부 PASS', '상세 도넛 잔여, app_capabilities404/보고 쓰기 차단으로 전체 캡처 exit1; 전체 화면 PASS 아님', ['docs/prototypes/three-surface-p3-recipes-visual/monthly-retirement-after-20260909/recipe-forms-evidence.json']);
group('SAMPLE_REVIEWED', 'screen:recipe_ingredient_search screen:recipe_material_search', 'recipes', '식재료·부자재 검색', '검색 목록 이름/배지 배치 및 실제 host 시험', '사용량 팝업 별도, 장목록·native', ['docs/prototypes/three-surface-p3-recipes-visual/search-breakdown-after-20260909/recipe-forms-evidence.json']);
group('SAMPLE_REVIEWED', 'screen:recipe_changes popup:recipe_change_detail@recipe_changes', 'ingredients', '공유 수정 이력 / 상세·스크롤 후속 / 페이지 연결', '메뉴 entity의 공용 이력 목록·첫 사건 상세 웹 표본과 내부 검수', '실제 pagination 스크롤·모든 사건·native');
group('SAMPLE_REVIEWED', 'screen:profit popup:profit_detail@profit', 'recipes', '손익 변동 공용화', '합성 읽기 이력 목록·원인/결과 시트 표본', '실DB·전체 목록 끝·native', ['docs/prototypes/three-surface-p3-recipes-visual/profit-history-after-20260909/recipe-forms-evidence.json']);
group('SAMPLE_REVIEWED', 'screen:recipe_category screen:recipe_material_category screen:recipe_materials popup:material_add@recipe_materials popup:material_edit@recipe_materials', 'recipes', '부자재 관리·카테고리 공용 소비', '실제 recipes 경로의 목록·추가·수정, 카테고리 목록 웹 표본', '카테고리/삭제 팝업 시각·다른 prototype host 동등성·native', ['docs/prototypes/three-surface-p3-recipes-visual/material-manage-final-20260909/recipe-forms-evidence.json']);
group('PARTIAL', 'popup:recipe_memo@recipe_detail', 'ingredients', '공용 메모 재조회 보호', 'RecipeDetail 실제 host 시험4건, 공용 메모 표본은 식재료 host', '메뉴 host 메모 실렌더·pending/IME', ['apps/mobile/tests/recipeDetailMemo.test.tsx']);
group('PARTIAL', 'popup:recipe_category_pick@recipe_add popup:recipe_category_pick@recipe_edit popup:recipe_ingredient_usage@recipe_edit', 'recipes', '추가/수정 폼', '실제 폼 카테고리·사용량 연결 시험. 양 host별 시각 PASS는 아님', '추가·수정별 팝업 실렌더', ['apps/mobile/tests/recipeFormParity.test.tsx']);
group('PARTIAL', 'popup:recipe_ingredient_usage@recipe_ingredient_search popup:recipe_material_usage@recipe_material_search', 'recipes', '식재료·부자재 검색', '재료 사용량 host 시험; 부자재는 실제 즉시 담기 흐름으로 prototype 시트와 다름', '시트 실렌더 및 부자재 usage target 대응 확정', ['apps/mobile/tests/recipeSearchParity.test.tsx']);
group('PARTIAL', 'popup:category_add@recipe_category popup:category_edit@recipe_category popup:category_delete@recipe_category popup:category_add@recipe_material_category popup:category_edit@recipe_material_category popup:category_delete@recipe_material_category screen:my_ingredient_categories popup:category_add@my_ingredient_categories popup:category_edit@my_ingredient_categories popup:category_delete@my_ingredient_categories', 'recipes', '부자재 관리·카테고리 공용 소비', '3-kind 공용 카테고리 실제 host 시험; 팝업별 웹 시각 근거 없음', '추가/수정/삭제 실제 시각·MY 식재료 목록 시각', ['apps/mobile/tests/categoryEditParity.test.tsx']);
group('PARTIAL', 'screen:my_recipe_categories popup:category_add@my_recipe_categories popup:category_edit@my_recipe_categories popup:category_delete@my_recipe_categories screen:my_material_categories popup:category_add@my_material_categories popup:category_edit@my_material_categories popup:category_delete@my_material_categories screen:my_materials popup:material_add@my_materials popup:material_edit@my_materials', 'recipes', '부자재 관리·카테고리 공용 소비', '동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정', 'host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음');
group('PARTIAL', 'popup:material_category_pick@recipe_materials popup:material_delete@recipe_materials popup:material_category_pick@my_materials popup:material_delete@my_materials', 'recipes', '부자재 관리·카테고리 공용 소비', '선택/삭제 실제 host 시험만. MY alias host는 대응 미확정', '실제 팝업 시각·별도 host 동등성', ['apps/mobile/tests/materialManageParity.test.tsx']);
group('SAMPLE_REVIEWED', 'screen:order_main popup:order_candidates@order_main popup:order_waiting@order_main popup:order_received@order_main popup:order_order@order_main popup:order_receive@order_main screen:order_direct popup:order_ingredient@order_direct popup:order_vendor@order_direct', 'orders', '발주 target별 현재 검증 상한', '보고서 target 표의 목록·두 시트·직접발주·두 선택 팝업 웹/host 및 Sol 한정 PASS', '목록별 추가 데이터·키보드·native; ORD-06 registry 경로 정정은 별도');
group('PARTIAL', 'popup:order_cancel@order_main popup:order_revert@order_main popup:order_price_spike@order_main', 'orders', 'ORD-07 취소·급등 Alert 경계', 'Alert API/웹 bridge 동작 시험만', '실제 dialog 시각·native');
group('PARTIAL', 'screen:order_detail popup:order_order@order_detail screen:order_receive popup:order_receive@order_receive', 'orders', '발주 target별 현재 검증 상한', '공용/대체 Expo 경로는 관측했으나 prototype 별도 host 동등성 미확정', '화면/host 대응과 registry 정정');
group('SAMPLE_REVIEWED', 'screen:sales_main', 'sales', 'SALES-01 메뉴 목록', '메뉴 목록 배치 변경 웹 표본 및 Sol 한정 PASS', '같은 화면 영업바 날짜 잘림·다른 상태·팝업 잔여. 전체 홈 완료 아님', ['docs/prototypes/three-surface-p3-sales-visual/after-menu-20260909/sales-evidence.json']);
group('PARTIAL', 'popup:sales_sort@sales_main popup:sales_qty@sales_main popup:sales_etc@sales_main popup:sales_expense@sales_main', 'sales', '보존된 웹 before/after / 확인된 다음 배치', '비변경 대조/후속 파악용 캡처와 일부 host 시험', '시트 sub/입력/합계·기타매출 및 지출 결과/1:1 행동 개선 미완료');

// Ingredient inventory independently reconciled by sol_page_review: 24/11/6 + hidden3.
group('SAMPLE_REVIEWED', 'screen:ingredient_main screen:ingredient_add screen:ingredient_detail screen:ingredient_edit_menu screen:ingredient_edit screen:options popup:stock_discard@stock_change popup:option_more@options', 'ingredients', '발견·정정·재검수 / 후속 큰 글자 재검수', '기본 화면 및 직접 연 수정 메뉴·폐기·옵션 더보기의 웹 표본 한정 내부검수', '추가 데이터/상태·모든 영역·native·최종 게이트. option_more 관측을 option_card_menu까지 전파하지 않음', ['docs/prototypes/three-surface-p3-ingredient-visual/candidate-7/render-evidence.json']);
group('SAMPLE_REVIEWED', 'popup:add_category@ingredient_add popup:add_unit@ingredient_add popup:edit_category@ingredient_edit popup:edit_unit@ingredient_edit', 'ingredients', 'ING02/04 공용 선택 시트', '추가/수정 host 카테고리·단위 선택 변경/재열기/닫기 웹 표본', '장목록·영어·IME·native·실제 저장');
group('SAMPLE_REVIEWED', 'popup:ingredient_option_filled@ingredient_detail popup:option_list@options popup:option_edit@options popup:option_unit@options', 'ingredients', 'ING03/06 구매 옵션 행·단가', '상세 구매 옵션·관리 목록/수정 및 단위 kg/ml/박스 웹 표본', '다른 상태·키보드·native·전체 화면 완료 아님');
group('SAMPLE_REVIEWED', 'screen:memo_edit popup:ingredient_option_empty@ingredient_detail popup:option_add@options', 'ingredients', 'ING03 메모 · ING06 빈 목록/추가', '메모 입력/취소 복원·빈 구매 옵션·추가 폼의 웹 표본', '메모 pending/dirty 이탈·옵션 실저장·native');
group('SAMPLE_REVIEWED', 'screen:stock screen:purchase popup:purchase_period@purchase', 'ingredients', 'ING07/08/09/10 필터 · 공용 요약 / 긴 행·음수 잔량 / 공용 metrics', '재고/구매 이력 및 구매 기간 선택 웹 표본·실제 host 시험', '2줄 초과 메모·숫자/단위 줄 분리·추가 값·native');
group('SAMPLE_REVIEWED', 'screen:ingredient_changes popup:ingredient_change_detail@ingredient_changes', 'ingredients', '공유 수정 이력 / 상세·스크롤 후속 / 페이지 연결', '식재료 entity 목록·첫 사건 상세 웹 표본', '실제 pagination 스크롤·모든 사건·native');
group('PARTIAL', 'screen:stock_change popup:stock_deduct@stock_change', 'ingredients', '발견·정정·재검수 / 후속 큰 글자 재검수', 'ING05 실사/완전소진 관측은 있으나 prototype 기본 입고·차감 의미와 1:1 미확정', 'prototype 상태와 실제 실사/차감 역할 대조');
group('PARTIAL', 'popup:stock_inbound@stock_change popup:stock_option@stock_change popup:stock_error@stock_change', 'ingredients', 'ING03b 빠른 입고 / 간편 입고 재조회 / 빠른 입고 스크롤 끝 확인', '별도 QuickInbound host의 입고·옵션·오류 관련 근거; prototype stock_change host 동등성 미확정', 'host 대응 및 해당 오류 상태 실렌더; QuickInbound PASS를 StockEdit로 전파하지 않음');
group('PARTIAL', 'popup:option_vendor@options popup:option_vendor_new@options popup:option_delete@options', 'ingredients', '공용 거래처 실패 / 옵션 편집 비동기 응답', '실제 host 시험·비동기 응답 보호; 해당 옵션 상태 웹 시각 확정 근거 없음', 'ING06 거래처/신규/삭제 시각 검수. ING02/04 거래처 캡처를 전파하지 않음');
group('PARTIAL', 'popup:stock_period@stock popup:stock_type@stock popup:stock_order@stock', 'ingredients', 'ING07/08/09/10 필터 · 공용 요약', 'Expo ING08 통합 조회 시트의 필터 시험·웹 관측', 'prototype 개별 popup 3개와 통합 시트의 대응 계약 확정');

function build() {
  const targetMap = new Map(audit.targets.map(t => [t.target, t]));
  requireValue(targetMap.size === audit.targets.length && targetMap.size === 185, 'audit target duplicate/count');
  requireValue(registry.inventory.prototypeTargets === targetMap.size, 'registry denominator mismatch');
  for (const t of audit.targets) {
    requireValue(typeof t.hidden === 'boolean', `missing hidden flag ${t.target}`);
    requireValue(t.target === (t.popup === null ? `screen:${t.screen}` : `popup:${t.popup}@${t.screen}`), `target/host mismatch ${t.target}`);
  }
  const owners = new Map([...targetMap.keys()].map(key => [key, []]));
  for (const s of registry.surfaces) {
    requireValue(new Set(s.prototypeTargets ?? []).size === (s.prototypeTargets ?? []).length, `duplicate owner binding ${s.screenId}`);
    for (const key of s.prototypeTargets ?? []) {
      requireValue(owners.has(key), `unknown registry target ${key}`);
      owners.get(key).push({ screenId: s.screenId, domain: s.domain });
    }
  }
  requireValue([...owners.values()].every(a => a.length), 'unowned target');
  for (const key of assessments.keys()) requireValue(targetMap.has(key), `unknown assessment ${key}`);
  const rows = [...targetMap].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([target, t]) => {
    const owner = owners.get(target);
    const domains = [...new Set(owner.map(o => o.domain))].sort();
    const assessment = assessments.get(target);
    requireValue(!t.hidden || !assessment || assessment.status === 'HIDDEN', `hidden promoted ${target}`);
    return { target, hidden: t.hidden, ownerScreenIds: owner.map(o => o.screenId).sort(), domains,
      countDomain: domains.length === 1 ? domains[0] : 'shared',
      ...(assessment ?? { status: t.hidden ? 'HIDDEN' : 'UNASSESSED', evidence: [],
        scope: t.hidden ? '숨김 보존; 별도 Expo 화면 검수 여부와 분모 포함은 구분' : '이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함',
        remaining: t.hidden ? '활성 작업 완료율에서 제외, 원본 보존' : '실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음' }),
      finalClosed: false };
  });
  const counts = items => Object.fromEntries(validStatuses.map(s => [s, items.filter(t => t.status === s).length]));
  const active = rows.filter(t => !t.hidden);
  requireValue(active.length === 182 && rows.length - active.length === 3, 'active/hidden count');
  const summary = { total: rows.length, active: active.length, hidden: 3,
    screens: rows.filter(r => r.target.startsWith('screen:')).length,
    popupHostPairs: rows.filter(r => r.target.startsWith('popup:')).length,
    statuses: counts(rows), finalClosed: rows.filter(r => r.finalClosed).length,
    byDomain: [...new Set(rows.map(r => r.countDomain))].sort().map(domain => {
      const subset = rows.filter(r => r.countDomain === domain);
      return { domain, total: subset.length, ...counts(subset) };
    }) };
  const provenance = [...refs].sort().map(path => {
    requireValue(existsSync(resolve(root, path)), `missing evidence ${path}`);
    const baselineBlob = git('rev-parse', `${baseline}:${path}`);
    const currentBlob = git('hash-object', '--path', path, path);
    requireValue(currentBlob === baselineBlob, `changed accounting input ${path}`);
    return { path, gitBlob: baselineBlob };
  });
  return { schemaVersion: 1, asOfCommit: baseline, date: '2026-09-09',
    generator: { path: 'scripts/three-surface-p3-progress.mjs', textSha256: createHash('sha256').update(read('scripts/three-surface-p3-progress.mjs').replaceAll('\r\n', '\n')).digest('hex') },
    scope: 'P3 target별 증거 수준 재고. SAMPLE_REVIEWED는 명시 변경/표본 내부검수 이력이 있다는 뜻이지 페이지 개발 완료 또는 현재 HEAD 전수 재검수 PASS가 아니다.',
    definitions: { SAMPLE_REVIEWED: '해당 상태의 웹 표본 + 범위 한정 내부검수 근거 있음', PARTIAL: '시험만·관측만 또는 다른 host 대응 미확정', UNASSESSED: '해당 target 직접 P3 검수 근거 미확인 (미구현 아님)', HIDDEN: '프로토타입 숨김 보존' },
    accountingReview: { root: 'registry/감사 target 집합 및 네 보고서·관련 수집기/시험 대조', sol: '식재료44 target 독립 읽기전용 대조: 표본24·부분11·직접근거없음6·숨김3', formalExternal: 'NOT_SENT; 현황 집계이며 제품 완료 승인 아님' },
    limitations: ['모든 상태/데이터·native·공식 외부검수·P3 승계 게이트는 별도이며 finalClosed는 모두 false.', '현재 source projection 도구는 RCP-07.states 없음으로 FAIL. 이 집계는 registry target 집합과 render-audit target 집합을 직접 양방향 대조한다.', '공유 2개 fixed_channel target은 shared로 분리해 185 분모를 중복하지 않는다.', 'MY-12와 폐기된 RCP-07은 Expo-only로 185에 더하지 않는다.'],
    provenance, summary, targets: rows };
}

const result = build();
const text = JSON.stringify(result, null, 2) + '\n';
const out = 'docs/ai-review/evidence/PROTOTYPE-EXPO-P3-TARGET-PROGRESS-20260909.json';
const labels = result.definitions;
const md = '# P3 대상별 진행 근거 — 2026-09-09\n\n' +
  `기준 제품/기록 HEAD: \`${baseline}\`. 이 표는 페이지 완료 승인이 아니라 증거 수준 집계다.\n\n` +
  '총 185 = 활성 182 + 숨김 3. 화면 62 + popup@host 123. 최종 종결 0.\n\n' +
  Object.entries(labels).map(([k,v]) => `- ${k}: ${v}`).join('\n') + '\n\n' +
  '| 영역(중복 제거) | 총수 | 표본 내부검수 | 부분 근거 | 직접 근거 미확인 | 숨김 |\n|---|---:|---:|---:|---:|---:|\n' +
  result.summary.byDomain.map(r => `| ${r.domain} | ${r.total} | ${r.SAMPLE_REVIEWED} | ${r.PARTIAL} | ${r.UNASSESSED} | ${r.HIDDEN} |`).join('\n') + '\n\n' +
  result.limitations.map(t => `- ${t}`).join('\n') + '\n\n' +
  '## 185개 개별 대상\n\n| target | 상태 | 근거/범위 | 남은 작업 |\n|---|---|---|---|\n' +
  result.targets.map(t => `| ${t.target} | ${t.status} | ${t.scope} ${t.evidence.map(e => `[${e.section || '산출물'}](../../../${e.path})`).join(' ')} | ${t.remaining} |`).join('\n') + '\n';
if (process.argv.includes('--write')) {
  requireValue(!existsSync(resolve(root, out)), 'existing result preserved; choose a new revision');
  writeFileSync(resolve(root, out), text, { flag: 'wx' });
  writeFileSync(resolve(root, out.replace('.json', '.md')), md, { flag: 'wx' });
} else if (process.argv.includes('--check')) {
  requireValue(read(out).replaceAll('\r\n', '\n') === text, 'JSON differs from regenerated accounting');
  requireValue(read(out.replace('.json', '.md')).replaceAll('\r\n', '\n') === md, 'Markdown differs from regenerated accounting');
}
console.log(JSON.stringify(result.summary, null, 2));
console.log('accounting SHA256 ' + createHash('sha256').update(text).digest('hex'));
