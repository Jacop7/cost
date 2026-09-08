// Navigation only. These actions open the existing Expo controls; no screen JSX,
// style, payload, save/delete/confirmation action is replicated here.
const button = (name, prefix = false) => ({ role: 'button', name, prefix });
const tab = name => ({ role: 'tab', name, prefix: true });
const pattern = name => ({ role: 'button', name, pattern: true });
const first = step => ({ ...step, first: true });
const form = (step, label) => ({ ...step, expectSelector: `input[aria-label="${label}"]` });
const dialog = (step, expectText) => ({ ...step, expectText });
const optionEdit = form(first(pattern(' 수정$')), '옵션 이름');
const optionAdd = form(button('구매 옵션 추가'), '옵션 이름');
const editMenu = button('수정 메뉴 열기');
const stock = [editMenu, button('재고 수정 (실사)')];
const screenActions = {
  ingredient_edit_menu: [editMenu], stock_change: stock,
  memo_edit: [button('메모 수정')],
  recipe_price_sim: [button('판매가 시뮬레이션')],
  ingredient_delete: [editMenu, dialog(button('식재료 삭제'), '과거 입고·판매 기록은 남고')],
  order_receive: [tab('입고 예정')],
};
const popupActions = {
  'option_delete@options': [optionEdit, button('더보기'), dialog(button('구매 옵션 삭제'), '입고 기록은 남아요')],
  'recipe_stop@recipe_detail': [dialog(button('판매 중지'), '과거 매출 기록은 그대로')],
  'order_cancel@order_main': [tab('입고 예정'), dialog(first(button('발주 취소')), '아직 입고되지 않은')],
  'order_revert@order_main': [tab('입고 완료'), dialog(first(button('입고 취소')), '재고와 기준단가가')],
  'vendor_delete@my_vendors': [dialog(first(pattern(' 삭제$')), '삭제')],
  'channel_disable@my_channels': [dialog(first(pattern(' 사용 안 함으로 바꾸기$')), '지난 매출은 그대로')],
  'expense_add@expense': [dialog(button('지출 추가'), '지출 추가')],
  'fixed_period@fixed_actual': [pattern('^\\d{4}년 \\d{1,2}월 변경$')],
  'fixed_period@my_fixed_edit': [pattern('^\\d{4}년 \\d{1,2}월 변경$')],
  'tax_country@my_tax': [{ ...button('한국 선택됨'), observeOnly: true, expectAction: button('한국 선택됨') }],
  'language_preview@my_language': [{ role: 'radio', name: 'English 선택', expectChecked: true }],
  'stock_check_all@stock_check': [{ ...button('전체 부족 재고 보기'), expectPath: '/ingredients' }],
  'recipe_material_usage@recipe_material_search': [button('부자재 추가'), { ...first(pattern(' 담기$')), expectAction: { role: 'button', name: ' 수량 늘리기$', pattern: true } }],
  'sort@ingredient_main': [button('정렬 기준:', true)],
  'add_category@ingredient_add': [button('카테고리 변경,', true)],
  'edit_category@ingredient_edit': [button('카테고리 변경,', true)],
  'recipe_category_pick@recipe_add': [button('카테고리 선택:', true)],
  'recipe_category_pick@recipe_edit': [button('카테고리 선택:', true)],
  'add_unit@ingredient_add': [pattern('^단위 .+ 변경$')],
  'edit_unit@ingredient_edit': [pattern('^단위 .+ 변경$')],
  'stock_deduct@stock_change': [...stock, tab('완전 소진')],
  'stock_discard@stock_change': [...stock, tab('폐기')],
  'option_add@options': [{ ...button('구매 옵션 추가'), expectSelector: 'input[aria-label="옵션 이름"]' }],
  'stock_period@stock': [button('최근 3개월', true)],
  'purchase_period@purchase': [button('최근 3개월', true)],
  'discard_period@discard': [button('최근 3개월', true)],
  'material_add@recipe_materials': [button('부자재 추가')],
  'material_add@my_materials': [button('부자재 추가')],
  'order_candidates@order_main': [tab('발주 후보')],
  'order_waiting@order_main': [tab('입고 예정')],
  'order_received@order_main': [tab('입고 완료')],
  'sales_sort@sales_main': [button('정렬 기준:', true)],
  'sales_etc@sales_main': [button('기타 매출')],
  'sales_expense@sales_main': [button('지출 추가')],
  'recipe_sort@recipe_main': [pattern('^순이익률 낮은순( 변경)?$')],
  'recipe_status@recipe_main': [pattern('^판매중( 변경)?$')],
  'recipe_target@recipe_main': [pattern('^목표( 변경)?$')],
  'option_list@options': [],
  'vendor_add@my_vendors': [button('구매처 추가')],
  'vendor_edit@my_vendors': [first(pattern(' 이름 변경$'))],
  'channel_edit@my_channels': [first(pattern(' 이름 수정$'))],
  'hours_start@my_hours': [button('시작 선택')],
  'hours_end@my_hours': [button('종료 선택')],
  'hours_timezone@my_hours': [button('시간대 변경')],
  'fixed_period@fixed_average': [pattern('^\\d{4}년 \\d{1,2}월 변경$')],
  'fixed_period@my_fixed': [pattern('^\\d{4}년 \\d{1,2}월 변경$')],
  'fixed_channel@fixed_actual': [first(pattern(' 채널 비중$'))],
  'fixed_channel@my_fixed_edit': [first(pattern(' 채널 비중$'))],
  'stock_type@stock': [button('전체', true)],
  'stock_order@stock': [button('최신순', true)],
  'stock_inbound@stock_change': [],
  'stock_option@stock_change': [dialog(button('구매한 곳 선택,', true), '구매한 곳 · 옵션')],
  'discard_type@discard': [dialog(button('전체', true), '유형')],
  'ingredient_change_detail@ingredient_changes': [first(pattern(' 자세히 보기$'))],
  'option_edit@options': [optionEdit],
  'option_vendor@options': [optionAdd, dialog(button('구매처 변경,', true), '거래처 선택')],
  'option_vendor_new@options': [optionAdd, button('구매처 변경,', true), form(button('거래처 추가'), '새 거래처 이름')],
  'option_unit@options': [optionAdd, dialog(pattern('^단위 .+ 변경$'), '단위 선택')],
  'option_card_menu@options': [optionEdit, button('더보기')],
  'option_more@options': [optionEdit, button('더보기')],
  'recipe_memo@recipe_detail': [dialog(button('메모 수정'), '메모')],
  'recipe_ingredient_usage@recipe_edit': [first(pattern(' 사용량 수정$'))],
  'recipe_ingredient_usage@recipe_ingredient_search': [dialog(first(pattern(' 담기$')), '사용량 입력')],
  'recipe_change_detail@recipe_changes': [first(pattern(' 자세히 보기$'))],
  'profit_detail@profit': [dialog(first(pattern('순이익 ')), '손익 변동 상세')],
  'order_order@order_main': [first(button('주문하기'))],
  'order_receive@order_main': [tab('입고 예정'), first(button('입고 완료'))],
  'order_receive@order_receive': [tab('입고 예정'), first(button('입고 완료'))],
  'order_ingredient@order_direct': [button('식재료 선택')],
  'order_vendor@order_direct': [button('지정 안 함')],
  'sales_qty@sales_main': [dialog(first(pattern(' 판매 입력$')), '판매 수량')],
  'sales_period@analytics': [pattern(' 변경$')],
  'sales_direct_period@analytics': [pattern(' 변경$'), dialog(button('직접 설정하기'), '기간 직접 설정')],
  'sales_menu_profit@day': [first(pattern(' 손익 보기$'))],
  'sales_material_detail@material': [first(pattern(' 메뉴별 차감 보기$'))],
  'sales_extra_detail@extra': [first(pattern(' 메뉴별 내역 보기$'))],
  'sales_fixed_expand@sales_fixed': [{ ...first(pattern(' 세부 내역$')), expectParentGrowth: true }],
  'sales_revenue_all@revenue': [{ ...pattern('^메뉴 \\d+개 더 보기$'), expectGone: true }],
  'past_sale_qty@sales_past': [dialog(first(pattern(' 판매 수량 \\d+개$')), '판매 수량')],
  'past_etc@sales_past': [dialog(button('기타 매출', true), '기타 매출')],
  'past_expense@sales_past': [dialog(button('지출 추가', true), '지출 추가')],
  'account_delete@my_account': [form(button('계정 탈퇴'), '탈퇴 확인 문구')],
  'tax_item_add@my_tax': [{ ...pattern('^(추가세 추가|세금 항목 추가)$'), expectIncreaseSelector: 'input' }],
  'sales_state@sales_main': [pattern('^(영업 중|브레이크 중) 바꾸기$')],
  'sales_close@sales_main': [pattern('^(영업 중|브레이크 중) 바꾸기$'), dialog(button('영업 종료'), '오늘 장사를 마칠까요?')],
};
for (const [popup, label] of [['hours_break_start', '브레이크 시작'], ['hours_break_end', '브레이크 종료']]) {
  popupActions[`${popup}@my_hours`] = [button('월요일'), { role: 'switch', name: '브레이크 타임 사용', ensureChecked: true }, dialog(button(`${label} 선택`), label)];
}
for (const screen of ['fixed_actual', 'my_fixed_edit']) {
  popupActions[`fixed_item_add@${screen}`] = [{ ...button('항목 추가'), expectIncreaseSelector: 'input[aria-label="항목 이름"]' }];
}
for (const screen of ['recipe_materials', 'my_materials']) {
  popupActions[`material_delete@${screen}`] = [dialog(first(pattern(' 삭제$')), '삭제')];
  popupActions[`material_edit@${screen}`] = [dialog(first(pattern(' 수정$')), '부자재 수정')];
  popupActions[`material_category_pick@${screen}`] = [button('부자재 추가'), dialog(button('카테고리 선택:', true), '부자재 카테고리')];
}
for (const screen of ['recipe_category', 'recipe_material_category', 'my_ingredient_categories', 'my_recipe_categories', 'my_material_categories']) {
  popupActions[`category_delete@${screen}`] = [dialog(first(pattern(' 삭제$')), '카테고리를 쓰는')];
  popupActions[`category_add@${screen}`] = [first(button('카테고리 추가'))];
  popupActions[`category_edit@${screen}`] = [first(pattern(' 수정$'))];
}
const hostStates = new Set();
const alternativeIds = new Set(['tax_country@my_tax','language_preview@my_language','expense_add@expense','fixed_period@fixed_actual','fixed_period@my_fixed_edit','stock_check_all@stock_check','recipe_material_usage@recipe_material_search']);
// These targets stay visible, in the original order. A host route is not proof
// that its prototype-only state exists in Expo. Never manufacture one here.
const limitations = {};
function limited(keys, category, reason, source) {
  for (const key of keys) limitations[key] = { category, reason, source };
}
limited(['ingredient_option_filled@ingredient_detail', 'ingredient_option_empty@ingredient_detail'], 'DATA_REQUIRED',
  '구매 링크 있음/없음은 실제 식재료의 구매 옵션 데이터로 결정됩니다. 위 실제 데이터 선택에서 해당 식재료를 골라 확인하세요. 데이터를 생성하거나 지워 상태를 만들지 않습니다.',
  'apps/mobile/src/features/ingredients/screens/IngredientDetailScreen.tsx');
limited(['stock_event_more@stock', 'stock_event_revert@stock'], 'NO_EQUIVALENT_UI',
  '현재 Expo 재고 이력 행에는 더보기/되돌리기 열기 동작이 없습니다. 진입 화면만 표시합니다.',
  'apps/mobile/src/features/ingredients/screens/StockHistoryScreen.tsx');
limited(['stock_confirm@stock_change', 'stock_error@stock_change'], 'REQUIRES_WRITE',
  '현재 Expo는 재고 적용/실패 흐름에 결합된 상태입니다. 재고를 바꾸거나 실패를 만들기 위해 자동 적용하지 않습니다.',
  'apps/mobile/src/features/ingredients/screens/StockEditSheet.tsx');
limited(['option_delete@options'], 'NATIVE_ALERT', '현재 삭제 확인은 네이티브 Alert입니다. Expo Web의 Alert 구현은 표시하지 않아 웹에서 직통으로 열 수 없습니다.',
  'apps/mobile/src/features/ingredients/screens/PurchaseOptionScreen.tsx');
limited(['recipe_stop@recipe_detail'], 'REQUIRES_WRITE', '판매 중지는 네이티브 Alert 확인이고, 판매 재개는 즉시 저장됩니다. 상태를 바꾸는 자동 클릭은 하지 않습니다.',
  'apps/mobile/src/features/recipes/screens/RecipeDetailScreen.tsx');
limited(['recipe_material_usage@recipe_material_search'], 'NO_EQUIVALENT_UI', '현재 Expo 부자재 담기는 수량 1로 초안에 넣고 돌아갑니다. 이 화면에 사용량 팝업은 없습니다.',
  'apps/mobile/src/features/recipes/screens/MaterialSearchScreen.tsx');
limited(['material_delete@recipe_materials', 'material_delete@my_materials'], 'NATIVE_ALERT', '현재 부자재 삭제 확인은 네이티브 Alert이며 Expo Web에서 표시되지 않습니다.',
  'apps/mobile/src/features/recipes/screens/MaterialManageScreen.tsx');
limited(['category_delete@recipe_category', 'category_delete@recipe_material_category', 'category_delete@my_ingredient_categories', 'category_delete@my_recipe_categories', 'category_delete@my_material_categories'], 'NATIVE_ALERT',
  '현재 카테고리 삭제 확인은 네이티브 Alert이며 Expo Web에서 표시되지 않습니다.', 'apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx');
limited(['fixed_period@fixed_actual', 'fixed_period@my_fixed_edit'], 'NO_EQUIVALENT_UI', '월 선택은 조회 화면에 있고 현재 수정 화면에는 없습니다. 다른 화면을 같은 팝업으로 처리하지 않습니다.',
  'apps/mobile/src/features/my/screens/FixedCostEditScreen.tsx');
limited(['order_cancel@order_main', 'order_revert@order_main'], 'NATIVE_ALERT', '현재 발주/입고 취소 확인은 네이티브 Alert이며 Expo Web에서 표시되지 않습니다.',
  'apps/mobile/src/features/orders/screens/OrdersHomeScreen.tsx');
limited(['order_price_spike@order_main'], 'REQUIRES_WRITE', '단가 급등 안내는 실제 입고 저장 성공 후 나옵니다. 안내를 만들기 위해 입고하지 않습니다.',
  'apps/mobile/src/features/orders/screens/OrdersHomeScreen.tsx');
limited(['order_order@order_detail'], 'NO_EQUIVALENT_UI', '현재 Expo는 직접 발주 입력 페이지입니다. 이 페이지에서 추가로 여는 주문 확인 팝업은 없으며 등록은 즉시 저장됩니다.',
  'apps/mobile/src/features/orders/screens/OrderCompleteScreen.tsx');
limited(['sales_break@sales_main'], 'REQUIRES_WRITE', '현재 브레이크 타임 선택은 즉시 영업 상태를 변경합니다. 확인 팝업만 여는 동작이 아니어서 자동 실행하지 않습니다.',
  'apps/mobile/src/features/sales/components/BusinessDayBar.tsx');
limited(['sales_shortage@sales_main'], 'REQUIRES_WRITE', '부족 경고는 판매 저장 흐름의 조건부 상태입니다. 팝업을 만들려고 판매량을 바꾸거나 저장하지 않습니다.',
  'apps/mobile/src/features/sales/screens/SalesHomeScreen.tsx');
limited(['expense_add@expense'], 'NO_EQUIVALENT_UI', '현재 추가 지출 상세에는 추가 버튼이 없습니다. 실제 추가 팝업은 매출관리 메인/지난 매출 수정에서 연결됩니다.',
  'apps/mobile/src/features/sales/screens/SalesExpenseScreen.tsx');
limited(['expense_delete@expense'], 'REQUIRES_WRITE', '현재 지출 삭제 버튼은 확인 팝업 없이 매출 저장을 실행합니다. 자동 삭제하지 않습니다.',
  'apps/mobile/src/features/sales/screens/SalesExpenseScreen.tsx');
limited(['stock_check_all@stock_check'], 'NO_EQUIVALENT_UI', '현재 전체 부족 재고 보기 버튼은 식재료 목록으로 이동합니다. 부족 재고 확장 상태가 열린 것으로 처리하지 않습니다.',
  'apps/mobile/src/features/sales/screens/SalesStockCheckScreen.tsx');
limited(['past_save@sales_past'], 'REQUIRES_WRITE', '기존 장부가 있으면 저장 버튼이 즉시 저장합니다. 확인 상태를 만들려고 자동 저장하지 않습니다.',
  'apps/mobile/src/features/sales/screens/SalesPastEditScreen.tsx');
limited(['tax_country@my_tax'], 'NO_EQUIVALENT_UI', '현재 세금 화면에는 국가 선택 팝업이 없습니다. 국가는 별도 Expo 국가 설정 화면입니다.',
  'apps/mobile/src/features/my/screens/MyTaxScreen.tsx');
limited(['tax_saved@my_tax'], 'REQUIRES_WRITE', '저장 완료 안내는 실제 설정 저장 결과입니다. 안내를 띄우려고 설정을 저장하지 않습니다.',
  'apps/mobile/src/features/my/screens/MyTaxScreen.tsx');
limited(['language_preview@my_language'], 'NO_EQUIVALENT_UI', '현재 언어 미리보기는 화면 안에 표시됩니다. 열 수 있는 Sheet는 저장 확인이며 미리보기 팝업이 아닙니다.',
  'apps/mobile/src/features/my/screens/MyLanguageScreen.tsx');
limited(['vendor_delete@my_vendors'], 'NATIVE_ALERT', '현재 구매처 삭제 확인은 네이티브 Alert이며 Expo Web에서 표시되지 않습니다.',
  'apps/mobile/src/features/my/screens/MyVendorsScreen.tsx');
limited(['channel_disable@my_channels'], 'NATIVE_ALERT', '현재 채널 비활성 확인은 네이티브 Alert이며 Expo Web에서 표시되지 않습니다.',
  'apps/mobile/src/features/my/screens/MyChannelsScreen.tsx');

// Existing Alert callbacks now render in Expo's shared WebAlertHost. Supersede
// historical limitations only when a real opener + visible postcondition exists.
for (const key of Object.keys(popupActions)) delete limitations[key];

export function destination(target, entities = {}, sampleMode = false) {
  if (!target.expoRoute) return { path: null, steps: [], manual: true, reason: '현재 Expo 연결 경로가 없습니다.' };
  let route = target.expoRoute.replace(/\/index$/, '');
  if (target.popup === 'expense_add') route = 'sales';
  if (target.popup === 'fixed_period' && ['fixed_actual', 'my_fixed_edit'].includes(target.screen)) route = 'recipes/fixed-cost';
  if (target.popup === 'tax_country') route = 'my/country';
  if (target.popup === 'recipe_material_usage') route = 'recipes/add';
  if (target.popup === 'stock_option') route = 'ingredients/add-stock/[id]';
  let kind = (route.startsWith('ingredients/') && (route.includes('[id]') || route === 'ingredients/option')) || target.screen === 'order_detail' || target.popup === 'order_vendor' ? 'ingredient'
    : route.includes('[id]') || ['recipe_edit', 'profit', 'menu'].includes(target.screen) ? 'recipe' : null;
  const selected = kind && entities[kind];
  if (kind && !selected) return { path: kind === 'ingredient' ? '/ingredients' : '/recipes', needsEntity: kind, steps: [], manual: false };
  route = '/' + route.replace('[id]', selected ?? '');
  const url = new URL(route, 'http://localhost');
  if (target.screen === 'recipe_edit') url.searchParams.set('id', selected);
  if (route === '/ingredients/option') url.searchParams.set('ingredient', selected);
  if (route === '/recipes/profit-history') url.searchParams.set('id', selected);
  if (route === '/sales/menu') url.searchParams.set('recipe', selected);
  if (target.screen === 'order_detail' || target.popup === 'order_vendor') url.searchParams.set('ingredient', selected);
  let steps = target.popup ? popupActions[`${target.popup}@${target.screen}`] : screenActions[target.screen];
  if (sampleMode && target.popup === 'past_save') steps = [first(pattern(' 판매 수량 \\d+개$')), button('매장 판매량 늘리기'), button('확인'), dialog(button('저장'), '이 날의 기록이 없어요')];
  if (sampleMode && target.popup === 'sales_shortage') steps = [first(pattern(' 판매 입력$')), button('매장 판매량 늘리기'), dialog(button('저장'), '판매 수량보다 재고가 부족해요')];
  if (sampleMode && target.popup === 'stock_error') steps = [...stock, tab('완전 소진'), dialog(button('소진 처리'), '저장하지 못했어요')];
  if (sampleMode && target.popup === 'order_price_spike') steps = [tab('입고 예정'), first(button('입고 완료')), dialog(button('입고 확정'), '입고 단가가 크게 올랐어요')];
  if (sampleMode && target.popup === 'tax_saved') steps = [dialog(button('저장'), '세금을 저장했어요')];
  const manual = target.popup ? !steps : hostStates.has(target.screen);
  const limitation = limitations[`${target.popup}@${target.screen}`];
  return { path: url.pathname + url.search, kind, steps: steps ?? [], manual,
    displayKind: manual ? 'unavailable' : alternativeIds.has(`${target.popup}@${target.screen}`) ? 'alternate'
      : sampleMode && ['stock_error','order_price_spike','tax_saved'].includes(target.popup) ? 'scenario' : 'direct',
    note: sampleMode && target.popup === 'stock_error' ? '실제 요청은 전송하지 않고 미리보기 차단 응답으로 기존 저장 오류창을 재현했습니다. 재고는 변경되지 않았습니다.'
      : target.popup === 'stock_check_all' ? '현재 Expo 버튼은 전체 식재료 목록으로 이동합니다. 부족 재고만 확장하는 팝업은 없습니다.'
      : target.popup === 'recipe_material_usage' ? '현재 Expo의 부자재 수량은 레시피 초안의 행 안에서 조절합니다. 팝업이 아니며 초안만 채웠습니다.'
      : target.popup === 'tax_country' ? '현재 Expo의 국가 선택은 팝업이 아닌 별도 국가·통화 화면입니다.'
      : target.popup === 'language_preview' ? '현재 Expo의 언어 예시는 팝업이 아닌 선택 행 안에 표시됩니다. 화면 번역 기능은 아닙니다.'
      : target.popup === 'expense_add' ? '현재 Expo의 지출 추가는 매출관리 메인에서 열립니다.'
      : target.popup === 'fixed_period' && ['fixed_actual','my_fixed_edit'].includes(target.screen) ? '월 선택은 현재 Expo의 고정 지출 조회 화면에서 엽니다.' : null,
    limitation,
    reason: manual ? limitation?.reason ?? '현재 Expo 진입 화면만 표시합니다. 이 상태의 자동 열기는 지원되지 않습니다.' : null };
}

export function navRows(model, screen) {
  const domain = model.screens[screen].domain;
  const edit = domain === 'ingredient' && (screen === 'ingredient_edit_menu' || model.ingredientEditScreens.includes(screen));
  return { domain, primary: model.domains[domain].screens.filter(k => domain !== 'ingredient' || !model.ingredientEditScreens.includes(k)),
    sub: edit ? model.ingredientEditScreens : [], popups: model.popupTabs[screen] ?? [],
    primaryActive: edit ? 'ingredient_edit_menu' : screen };
}

export function adapterKeys() { return Object.keys(popupActions).map(k => `popup:${k}`); }
export function limitationEntries() { return Object.entries(limitations).map(([key, value]) => ({ id: `popup:${key}`, ...value })); }
