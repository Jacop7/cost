// Navigation only. These actions open the existing Expo controls; no screen JSX,
// style, payload, save/delete/confirmation action is replicated here.
export const managementSourceScreens = {
  recipe_ingredients_stock: 'stock_change',
  recipe_ingredients_options: 'options',
};
const button = (name, prefix = false) => ({ role: 'button', name, prefix });
const tab = (name) => ({ role: 'tab', name, prefix: true });
const pattern = (name) => ({ role: 'button', name, pattern: true });
const first = (step) => ({ ...step, first: true });
const managementItem = { ...first(pattern(' 관리 메뉴 열기$')), hasText: true };
const form = (step, label) => ({ ...step, expectSelector: `input[aria-label="${label}"]` });
const dialog = (step, expectText) => ({ ...step, expectText });
const ingredientDelete = (step) => ({
  ...step,
  expectTextAny: ['삭제하시겠습니까?', '현재, 삭제가 불가능한 식재료입니다'],
});
const optionMenu = first(pattern(' 구매 링크 메뉴 열기$'));
const optionEdit = form(button('구매 링크 수정'), '상품명');
const optionAdd = form(button('구매 옵션 추가'), '상품명');
const editMenu = button('수정 메뉴 열기');
const inboundChoice = dialog(button('구매처 선택,', true), '구매처 선택');
// Select a saved option and open confirmation only. This sequence never submits.
const inboundConfirm = [
  inboundChoice,
  first(pattern(', [0-9,]+원, ')),
  dialog(pattern('^재고 .+ 입고$'), '재고를 입고할까요?'),
];
const screenActions = {
  ingredient_edit_menu: [editMenu],
  stock_change: [],
  memo_edit: [button('메모 수정')],
  recipe_price_sim: [],
  ingredient_delete: [editMenu, ingredientDelete(button('재료 삭제'))],
  order_receive: [tab('입고 예정'), { ...first(button('입고 완료')), expectPath: '/orders/receive' }],
};
const popupActions = {
  'configuration_detail@my_tax_history': [dialog(first(pattern('^세금 수정 ')), '수정 내용')],
  'configuration_detail@my_fixed_history': [
    first(pattern(' 자세히 보기$')),
  ],
  'tax_confirm@my_tax': [dialog(button('국제 세금 프로필 저장'), '세금을 수정하시겠습니까?')],
  'tax_simulation@my_tax': [dialog(button('세금 시뮬레이션'), '세금 시뮬레이션')],
  'recipe_edit_menu@recipe_detail': [dialog(editMenu, '메뉴 수정')],
  'expense_delete@expense': [dialog(first(pattern(' 삭제$')), '지출을 삭제할까요?')],
  'option_delete@options': [
    optionMenu,
    optionEdit,
    button('더보기'),
    dialog(button('구매 옵션 삭제'), '구매 링크를 삭제할까요?'),
  ],
  'recipe_stop@recipe_detail': [dialog(button('판매 중지'), '판매를 중지하시겠습니까?')],
  'order_cancel@order_main': [
    tab('입고 예정'),
    dialog(first(button('발주 취소')), '아직 입고되지 않은'),
  ],
  'order_revert@order_main': [
    tab('입고 완료'),
    dialog(first(button('입고 취소')), '해당 입고를 제외해 재고와 단가를'),
  ],
  'vendor_delete@my_vendors': [dialog(first(pattern(' 삭제$')), '삭제')],
  'channel_disable@my_channels': [
    dialog(first(pattern(' 사용 안 함으로 바꾸기$')), '기존 매출 기록은 유지되고'),
  ],
  'expense_add@expense': [dialog(button('지출 추가'), '지출 추가')],
  'fixed_period@fixed_actual': [pattern('^\\d{4}년 \\d{1,2}월 변경$')],
  'fixed_period@fixed_average': [
    dialog(button('고정 지출 입력 / 수정'), '고정 지출 입력 / 수정'),
  ],
  'fixed_period@my_fixed_edit': [pattern('^\\d{4}년 \\d{1,2}월 변경$')],
  'fixed_revenue_source@fixed_actual': [
    dialog(button('월매출 입력 방식 직접 입력'), '월매출 입력 방식'),
  ],
  'fixed_complete@fixed_average': [],
  'fixed_save_confirm@fixed_actual': [dialog(button('저장'), '고정 지출을 저장할까요?')],
  'fixed_item_delete@fixed_settings': [
    dialog(first(pattern(' 항목 삭제$')), '고정 지출 항목을 삭제할까요?'),
  ],
  'fixed_settings_save@fixed_settings': [
    button('최근 2개월 평균'),
    dialog(button('저장'), '고정 지출 설정을 저장할까요?'),
  ],
  'tax_country@my_tax': [dialog(button('국가 선택'), '국가 선택')],
  'language_preview@my_language': [{ role: 'radio', name: 'English 선택', expectChecked: true }],
  'stock_check_all@stock_check': [
    {
      ...button('전체 부족 재고 보기'),
      expectPath: '/ingredients',
      expectQuery: { stock: 'below-safety' },
    },
  ],
  'recipe_material_usage@recipe_material_search': [dialog(first(pattern(' 담기$')), '사용량 입력')],
  'sort@ingredient_main': [button('정렬 기준:', true)],
  'add_category@ingredient_add': [button('카테고리 변경,', true)],
  'edit_category@ingredient_edit': [button('카테고리 변경,', true)],
  'recipe_category_pick@recipe_add': [button('카테고리 선택:', true)],
  'recipe_category_pick@recipe_edit': [button('카테고리 선택:', true)],
  'add_unit@ingredient_add': [pattern('^단위 .+ 변경$')],
  'edit_unit@ingredient_edit': [pattern('^단위 .+ 변경$')],
  'stock_deduct@stock_change': [],
  'stock_discard@stock_change': [],
  'option_add@options': [optionAdd],
  'stock_period@stock': [button('최근 3개월', true)],
  'stock_event_revert@stock': [first(pattern('^(입고|차감|폐기) 취소$'))],
  'purchase_period@purchase': [button('최근 3개월', true)],
  'discard_period@discard': [button('최근 3개월', true)],
  'material_add@recipe_materials': [button('부자재 추가')],
  'material_add@my_materials': [button('부자재 추가')],
  'sales_period@sales_main': [button('9월 1일 ~ 9월 16일', true)],
  'sales_etc@sales_main': [button('기타 매출')],
  'sales_expense@sales_main': [button('지출 추가')],
  'recipe_sort@recipe_main': [pattern('^순이익률 낮은순( 변경)?$')],
  'recipe_status@recipe_main': [pattern('^판매중( 변경)?$')],
  'recipe_target@recipe_main': [pattern('^목표 상태( 변경)?$')],
  'option_list@options': [],
  'vendor_add@my_vendors': [button('구매처 추가')],
  'vendor_edit@my_vendors': [first(pattern(' 이름 변경$'))],
  'channel_edit@my_channels': [first(pattern(' 이름 수정$'))],
  'hours_start@my_hours': [button('시작 선택')],
  'hours_end@my_hours': [button('종료 선택')],
  'hours_timezone@my_hours': [button('시간대 변경')],
  'fixed_basis@my_fixed': [dialog(button('설정'), '고정 지출 설정')],
  'stock_type@stock': [button('전체', true)],
  'stock_order@stock': [button('최신순', true)],
  'stock_inbound@stock_change': [],
  'stock_option@stock_change': [inboundChoice],
  'stock_confirm@stock_change': inboundConfirm,
  'discard_type@discard': [dialog(button('전체', true), '유형')],
  'ingredient_change_detail@ingredient_changes': [first(pattern(' 자세히 보기$'))],
  'option_edit@options': [optionMenu, optionEdit],
  'option_vendor@options': [optionAdd, dialog(button('구매처 변경,', true), '구매처 선택')],
  'option_vendor_new@options': [optionAdd, form(button('새 구매처 추가'), '새 구매처 이름')],
  'option_unit@options': [optionAdd, dialog(pattern('^단위 .+ 변경$'), '단위 선택')],
  'option_card_menu@options': [optionMenu],
  'option_more@options': [optionMenu, optionEdit, button('더보기')],
  'recipe_memo@recipe_detail': [dialog(button('메모 수정'), '메모')],
  'recipe_ingredient_usage@recipe_edit': [
    { ...button('재료 펼치기'), optional: true },
    form(first(pattern(' 재료 사용량 수정$')), '사용량'),
  ],
  'recipe_ingredient_usage@recipe_ingredient_search': [
    dialog(first(pattern(' 담기$')), '사용량 입력'),
  ],
  'recipe_change_detail@recipe_changes': [first(pattern(' 자세히 보기$'))],
  'profit_detail@profit': [dialog(first(pattern('순이익 ')), '손익 결과')],
  'order_card_menu@order_main': [first(pattern(' 메뉴 열기$'))],
  'order_purchase_links@order_main': [dialog(first(button('구매링크 열기')), '구매처 선택')],
  'order_order@order_main': [{ ...first(button('발주완료')), expectPath: '/orders/place' }],
  'order_order_unselected@order_main': [{ ...first(button('발주완료')), expectPath: '/orders/place' }],
  'order_order@order_detail': [],
  'order_receive@order_main': [tab('입고 예정'), { ...first(button('입고 완료')), expectPath: '/orders/receive' }],
  'order_receive@order_receive': [tab('입고 예정'), { ...first(button('입고 완료')), expectPath: '/orders/receive' }],
  'sales_qty@sales_main': [dialog(first(pattern(' 판매 입력$')), '판매 수량')],
  'sales_period@analytics': [pattern(' 변경$')],
  'sales_direct_period@analytics': [
    pattern(' 변경$'),
    dialog(button('직접 설정하기'), '기간 직접 설정'),
  ],
  'sales_menu_profit@day': [first(pattern(' 손익 보기$'))],
  'sales_material_detail@material': [first(pattern(' 메뉴별 차감 보기$'))],
  'sales_extra_detail@extra': [first(pattern(' 메뉴별 내역 보기$'))],
  'sales_fixed_expand@sales_fixed': [
    { ...first(pattern(' 세부 내역$')), expectParentGrowth: true },
  ],
  'sales_revenue_all@revenue': [{ ...pattern('^메뉴 \\d+개 더 보기$'), expectGone: true }],
  'past_sale_qty@sales_past': [dialog(first(pattern(' 판매 수량 \\d+개$')), '판매 수량')],
  'past_etc@sales_past': [dialog(button('기타 매출', true), '기타 매출')],
  'past_expense@sales_past': [dialog(button('지출 추가', true), '지출 추가')],
  'account_delete@my_account': [form(button('계정 탈퇴'), '탈퇴 확인 문구')],
  'tax_item_add@my_tax': [
    {
      ...pattern('^(＋ 추가 세금 항목|추가세 추가|세금 항목 추가)$'),
      expectIncreaseSelector: 'input',
    },
  ],
};
for (const [popup, label] of [
  ['hours_break_start', '브레이크 시작'],
  ['hours_break_end', '브레이크 종료'],
]) {
  popupActions[`${popup}@my_hours`] = [
    button('월요일'),
    { role: 'switch', name: '브레이크 타임 사용', ensureChecked: true },
    dialog(button(`${label} 선택`), label),
  ];
}
for (const screen of ['my_fixed_edit']) {
  popupActions[`fixed_item_add@${screen}`] = [form(button('항목 추가'), '항목 이름')];
}
for (const screen of ['recipe_materials', 'my_materials']) {
  popupActions[`material_delete@${screen}`] = [managementItem, dialog(button('삭제'), '삭제')];
  popupActions[`material_add@${screen}`] = [
    { ...button('부자재 추가'), expectPath: '/recipes/material-edit' },
  ];
  popupActions[`material_edit@${screen}`] = [
    managementItem,
    {
      ...button('수정'),
      expectPageText: '부자재를 수정하시겠습니까?',
      expectPathAlternative: '/recipes/material-edit',
    },
  ];
  popupActions[`material_category_pick@${screen}`] = [
    { ...button('부자재 추가'), expectPath: '/recipes/material-edit' },
    dialog(button('카테고리 선택:', true), '카테고리 선택'),
  ];
}
screenActions.recipe_materials_edit = popupActions['material_edit@recipe_materials'];
screenActions.recipe_materials_detail = [
  managementItem,
  { ...button('자세히 보기'), expectPath: '/recipes/material-detail' },
];
popupActions['material_detail_menu@recipe_materials_detail'] = [
  ...screenActions.recipe_materials_detail,
  dialog(button('수정 메뉴 열기'), '수정'),
];
for (const [screen, label] of [
  ['recipe_manage', '메뉴'],
  ['recipe_ingredients', '재료'],
  ['recipe_materials', '부자재'],
]) {
  popupActions[`manage_more@${screen}`] = [
    dialog(button(`${label} 관리 메뉴 열기`), '카테고리 편집'),
  ];
  popupActions[`manage_item@${screen}`] = [dialog(managementItem, '수정')];
}
popupActions['manage_edit@recipe_ingredients'] = [
  managementItem,
  dialog(button('수정'), '기본 정보 수정'),
];
popupActions['manage_delete@recipe_ingredients'] = [
  managementItem,
  ingredientDelete(button('삭제')),
];
popupActions['manage_edit@recipe_manage'] = [
  managementItem,
  {
    ...button('수정'),
    expectPageText: '메뉴를 수정하시겠습니까?',
    expectPathAlternative: '/recipes/add',
  },
];
for (const host of ['recipe_manage', 'recipe_ingredients', 'recipe_materials']) {
  for (const suffix of ['categories', 'order']) {
    const remove = { ...first(pattern(' 삭제$')), enabledOnly: true };
    popupActions[`order_delete@${host}_${suffix}`] = [
      host === 'recipe_ingredients' && suffix === 'order'
        ? ingredientDelete(remove)
        : dialog(remove, suffix === 'categories' ? '삭제' : '삭제하시겠습니까?'),
    ];
    popupActions[`order_save@${host}_${suffix}`] = [
      { role: 'slider', name: ' 순서 변경$', pattern: true, first: true, key: 'ArrowDown' },
      dialog(button('저장'), '저장하시겠습니까?'),
    ];
  }
}
for (const screen of [
  'recipe_category',
  'recipe_material_category',
  'my_ingredient_categories',
  'my_recipe_categories',
  'my_material_categories',
]) {
  popupActions[`category_delete@${screen}`] = [
    {
      ...first(pattern(' 삭제$')),
      expectTextAny: ['삭제하시겠습니까?', '현재, 삭제가 불가능한 카테고리입니다'],
    },
  ];
  popupActions[`category_add@${screen}`] = [first(button('카테고리 추가'))];
  popupActions[`category_edit@${screen}`] = [first(pattern(' 수정$'))];
}
const hostStates = new Set();
const alternativeIds = new Set(['language_preview@my_language', 'stock_check_all@stock_check']);
// These targets stay visible, in the original order. A host route is not proof
// that its prototype-only state exists in Expo. Never manufacture one here.
const limitations = {};
function limited(keys, category, reason, source) {
  for (const key of keys) limitations[key] = { category, reason, source };
}
limited(
  ['ingredient_option_filled@ingredient_detail', 'ingredient_option_empty@ingredient_detail'],
  'DATA_REQUIRED',
  '구매 링크 있음/없음은 실제 재료의 구매 옵션 데이터로 결정됩니다. 위 실제 데이터 선택에서 해당 재료를 골라 확인하세요. 데이터를 생성하거나 지워 상태를 만들지 않습니다.',
  'apps/mobile/src/features/ingredients/screens/IngredientDetailScreen.tsx',
);
limited(
  ['stock_event_more@stock'],
  'NO_EQUIVALENT_UI',
  '기록 더보기 팝업은 제거했습니다. 취소 가능한 최신 기록 아래의 취소 버튼으로 확인창을 엽니다.',
  'apps/mobile/src/features/ingredients/screens/StockHistoryScreen.tsx',
);
limited(
  ['stock_error@stock_change'],
  'REQUIRES_WRITE',
  '입고 실패는 샘플 모드에서만 quick_inbound 요청을 차단해 실제 오류 UI를 엽니다. 실제 데이터 모드에서는 자동 입고하지 않습니다.',
  'apps/mobile/src/features/ingredients/screens/QuickInboundScreen.tsx',
);
limited(
  ['recipe_stop@recipe_detail'],
  'REQUIRES_WRITE',
  '판매 중지는 네이티브 Alert 확인이고, 판매 재개는 즉시 저장됩니다. 상태를 바꾸는 자동 클릭은 하지 않습니다.',
  'apps/mobile/src/features/recipes/screens/RecipeDetailScreen.tsx',
);
limited(
  ['recipe_material_usage@recipe_material_search'],
  'NO_EQUIVALENT_UI',
  '현재 Expo 부자재 담기는 수량 1로 초안에 넣고 돌아갑니다. 이 화면에 사용량 팝업은 없습니다.',
  'apps/mobile/src/features/recipes/screens/MaterialSearchScreen.tsx',
);
limited(
  ['material_delete@recipe_materials', 'material_delete@my_materials'],
  'NATIVE_ALERT',
  '현재 부자재 삭제 확인은 네이티브 Alert이며 Expo Web에서 표시되지 않습니다.',
  'apps/mobile/src/features/recipes/screens/MaterialManageScreen.tsx',
);
limited(
  [
    'category_delete@recipe_category',
    'category_delete@recipe_material_category',
    'category_delete@my_ingredient_categories',
    'category_delete@my_recipe_categories',
    'category_delete@my_material_categories',
  ],
  'NATIVE_ALERT',
  '현재 카테고리 삭제 확인은 네이티브 Alert이며 Expo Web에서 표시되지 않습니다.',
  'apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx',
);
limited(
  ['order_order@order_detail'],
  'NO_EQUIVALENT_UI',
  '현재 Expo는 후보 발주 입력 페이지입니다. 이 페이지에서 추가로 여는 주문 확인 팝업은 없으며 발주 완료는 하단 버튼으로 처리합니다.',
  'apps/mobile/src/features/orders/screens/CandidateOrderScreen.tsx',
);
limited(
  ['sales_shortage@sales_main'],
  'REQUIRES_WRITE',
  '부족 경고는 판매 저장 흐름의 조건부 상태입니다. 팝업을 만들려고 판매량을 바꾸거나 저장하지 않습니다.',
  'apps/mobile/src/features/sales/screens/SalesHomeScreen.tsx',
);
limited(
  ['expense_add@expense'],
  'NO_EQUIVALENT_UI',
  '현재 추가 지출 상세에는 추가 버튼이 없습니다. 실제 추가 팝업은 매출관리 메인/지난 매출 수정에서 연결됩니다.',
  'apps/mobile/src/features/sales/screens/SalesExpenseScreen.tsx',
);
limited(
  ['expense_delete@expense'],
  'REQUIRES_WRITE',
  '현재 지출 삭제 버튼은 확인 팝업 없이 매출 저장을 실행합니다. 자동 삭제하지 않습니다.',
  'apps/mobile/src/features/sales/screens/SalesExpenseScreen.tsx',
);
limited(
  ['stock_check_all@stock_check'],
  'NO_EQUIVALENT_UI',
  '현재 전체 부족 재고 보기 버튼은 재료 목록으로 이동합니다. 부족 재고 확장 상태가 열린 것으로 처리하지 않습니다.',
  'apps/mobile/src/features/sales/screens/SalesStockCheckScreen.tsx',
);
limited(
  ['past_save@sales_past'],
  'REQUIRES_WRITE',
  '기존 장부가 있으면 저장 버튼이 즉시 저장합니다. 확인 상태를 만들려고 자동 저장하지 않습니다.',
  'apps/mobile/src/features/sales/screens/SalesPastEditScreen.tsx',
);
limited(
  ['tax_saved@my_tax'],
  'REQUIRES_WRITE',
  '저장 완료 안내는 실제 설정 저장 결과입니다. 안내를 띄우려고 설정을 저장하지 않습니다.',
  'apps/mobile/src/features/my/screens/MyTaxScreen.tsx',
);
limited(
  ['language_preview@my_language'],
  'NO_EQUIVALENT_UI',
  '현재 언어 미리보기는 화면 안에 표시됩니다. 열 수 있는 Sheet는 저장 확인이며 미리보기 팝업이 아닙니다.',
  'apps/mobile/src/features/my/screens/MyLanguageScreen.tsx',
);
limited(
  ['vendor_delete@my_vendors'],
  'NATIVE_ALERT',
  '현재 구매처 삭제 확인은 네이티브 Alert이며 Expo Web에서 표시되지 않습니다.',
  'apps/mobile/src/features/my/screens/MyVendorsScreen.tsx',
);
limited(
  ['channel_disable@my_channels'],
  'NATIVE_ALERT',
  '현재 채널 비활성 확인은 네이티브 Alert이며 Expo Web에서 표시되지 않습니다.',
  'apps/mobile/src/features/my/screens/MyChannelsScreen.tsx',
);

// Existing Alert callbacks now render in Expo's shared WebAlertHost. Supersede
// historical limitations only when a real opener + visible postcondition exists.
for (const key of Object.keys(popupActions)) delete limitations[key];

export function destination(target, entities = {}, sampleMode = false) {
  if (target.sourceScreen) target = { ...target, screen: target.sourceScreen };
  if (!target.expoRoute)
    return { path: null, steps: [], manual: true, reason: '현재 Expo 연결 경로가 없습니다.' };
  let route = target.expoRoute.replace(/\/index$/, '');
  if (target.screen === 'recipe_price_sim') route = 'recipes/price-simulation';
  if (target.screen === 'order_detail') route = 'orders/place';
  // ORD-03 needs a live order id. Enter through the waiting card so the product
  // supplies the exact id instead of inventing a sample query parameter here.
  if (target.screen === 'order_receive') route = 'orders';
  if (target.popup === 'recipe_material_usage') route = 'recipes/material-search';
  if (target.screen === 'stock_change') route = 'ingredients/add-stock/[id]';
  let kind =
    (route.startsWith('ingredients/') &&
      (route.includes('[id]') || route === 'ingredients/option')) ||
    target.popup === 'order_vendor'
      ? 'ingredient'
      : route.includes('[id]') ||
          ['recipe_edit', 'recipe_price_sim', 'recipe_tax_detail', 'profit', 'menu'].includes(
            target.screen,
          )
        ? 'recipe'
        : null;
  const selected = kind && entities[kind];
  if (kind && !selected)
    return {
      path: kind === 'ingredient' ? '/ingredients' : '/recipes',
      needsEntity: kind,
      steps: [],
      manual: false,
    };
  route = '/' + route.replace('[id]', selected ?? '');
  const url = new URL(route, 'http://localhost');
  if (target.popup === 'stock_deduct') url.searchParams.set('mode', 'deduct');
  if (target.popup === 'stock_discard') url.searchParams.set('mode', 'waste');
  if (target.screen === 'recipe_edit') url.searchParams.set('id', selected);
  if (target.screen === 'recipe_price_sim') url.searchParams.set('id', selected);
  if (target.screen === 'recipe_tax_detail') url.searchParams.set('id', selected);
  if (route === '/ingredients/option') url.searchParams.set('ingredient', selected);
  if (route === '/recipes/profit-history') url.searchParams.set('id', selected);
  if (route === '/sales/menu') url.searchParams.set('recipe', selected);
  if (target.popup === 'order_vendor') url.searchParams.set('ingredient', selected);
  let steps = target.popup
    ? popupActions[`${target.popup}@${target.screen}`]
    : screenActions[target.screen];
  if (sampleMode && target.popup === 'past_save')
    steps = [
      first(pattern(' 판매 수량 \\d+개$')),
      button('매장 판매량 늘리기'),
      button('확인'),
      dialog(button('저장'), '이 날의 기록이 없어요'),
    ];
  if (sampleMode && target.popup === 'sales_shortage')
    steps = [
      first(pattern(' 판매 입력$')),
      button('매장 판매량 늘리기'),
      dialog(button('저장'), '판매 수량보다 재고가 부족해요'),
    ];
  if (sampleMode && target.popup === 'tax_saved')
    steps = [
      button('국제 세금 프로필 저장'),
      { ...button('저장'), inDialog: true, expectPageText: '저장했어요. 바로 적용됐어요.' },
    ];
  if (sampleMode && target.popup === 'stock_error')
    steps = [...inboundConfirm, dialog(button('입고'), '이전 입고 확인')];
  const manual = target.popup ? !steps : hostStates.has(target.screen);
  const limitation = limitations[`${target.popup}@${target.screen}`];
  return {
    path: url.pathname + url.search,
    kind,
    steps: steps ?? [],
    manual,
    displayKind: manual
      ? 'unavailable'
      : alternativeIds.has(`${target.popup}@${target.screen}`)
        ? 'alternate'
        : sampleMode && ['stock_error', 'tax_saved'].includes(target.popup)
          ? 'scenario'
          : 'direct',
    note:
      target.popup === 'stock_check_all'
        ? '최소재고 이하 재료 목록으로 이동합니다. stock=below-safety 조건까지 확인하며 별도 확장 팝업은 아닙니다.'
        : target.popup === 'recipe_material_usage'
          ? '기준 인분 전체 개수를 입력하고 담기를 눌러야 초안에 반영됩니다. DB에는 저장하지 않습니다.'
          : target.popup === 'language_preview'
            ? '현재 Expo의 언어 예시는 팝업이 아닌 선택 행 안에 표시됩니다. 화면 번역 기능은 아닙니다.'
            : null,
    limitation,
    reason: manual
      ? (limitation?.reason ??
        '현재 Expo 진입 화면만 표시합니다. 이 상태의 자동 열기는 지원되지 않습니다.')
      : null,
  };
}

// Removed overview URLs return to the surviving order board; audit receipts stay immutable.
export const removedOrderOverviewTargets = new Set(['candidates', 'waiting', 'received'].map(kind => `popup:order_${kind}@order_main`));

// Retain historical prototype inventory, but do not expose removed product UI.
export function activeTargetId(id) {
  if (removedOrderOverviewTargets.has(id)) return 'screen:order_main';
  if (id === 'screen:extra') return 'screen:material';
  if (id === 'popup:sales_extra_detail@extra') return 'popup:sales_material_detail@material';
  const oldScreen = id
    .replace(/^screen:/, '')
    .split('@')
    .at(-1);
  if (
    oldScreen?.startsWith('recipe_materials') ||
    ['recipe_material_category', 'my_materials', 'my_material_categories'].includes(oldScreen)
  )
    return 'screen:recipe_ingredients';
  if (oldScreen === 'recipe_material_search') return 'screen:recipe_ingredient_search';
  return id === 'popup:stock_event_more@stock' ? 'screen:stock' : id;
}

export function navRows(model, screen) {
  const domain = model.screens[screen].domain;
  const management = Object.entries(model.managementGroups ?? {}).find(([, screens]) =>
    screens.includes(screen),
  );
  const edit =
    domain === 'ingredient' &&
    (screen === 'ingredient_edit_menu' || model.ingredientEditScreens.includes(screen));
  return {
    domain,
    primary: model.domains[domain].screens.filter(
      (k) => domain !== 'ingredient' || !model.ingredientEditScreens.includes(k),
    ),
    sub: management ? management[1] : edit ? model.ingredientEditScreens : [],
    popups: (model.popupTabs[screen] ?? []).filter(
      ([popup]) => activeTargetId(`popup:${popup}@${screen}`) === `popup:${popup}@${screen}`,
    ),
    primaryActive: management ? management[0] : edit ? 'ingredient_edit_menu' : screen,
  };
}

function withManagementAliases(entries) {
  return entries.flatMap(([key, value]) => [
    [key, value],
    ...Object.entries(managementSourceScreens)
      .filter(([, source]) => key.endsWith(`@${source}`))
      .map(([screen]) => [`${key.split('@')[0]}@${screen}`, value]),
  ]);
}
export function adapterKeys() {
  return withManagementAliases(Object.entries(popupActions))
    .map(([key]) => `popup:${key}`)
    .filter((id) => activeTargetId(id) === id);
}
export function limitationEntries() {
  return withManagementAliases(Object.entries(limitations))
    .map(([key, value]) => ({ id: `popup:${key}`, ...value }))
    .filter((row) => activeTargetId(row.id) === row.id);
}

/** Query conditions are opt-in; unrelated AppMap parameters remain allowed. */
export function matchesPathCondition(location, step) {
  if (location.pathname.replace(/\/$/, '') !== step.expectPath) return false;
  const query = new URLSearchParams(location.search);
  return Object.entries(step.expectQuery ?? {}).every(([key, expected]) => {
    const values = query.getAll(key);
    return values.length === 1 && values[0] === expected;
  });
}
