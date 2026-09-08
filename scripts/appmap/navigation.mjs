// Navigation only. These actions open the existing Expo controls; no screen JSX,
// style, payload, save/delete/confirmation action is replicated here.
const button = (name, prefix = false) => ({ role: 'button', name, prefix });
const tab = name => ({ role: 'tab', name, prefix: true });
const pattern = name => ({ role: 'button', name, pattern: true });
const first = step => ({ ...step, first: true });
const editMenu = button('수정 메뉴 열기');
const stock = [editMenu, button('재고 수정 (실사)')];
const screenActions = {
  ingredient_edit_menu: [editMenu], stock_change: stock,
  memo_edit: [button('메모 수정')],
  recipe_price_sim: [button('판매가 시뮬레이션')],
  order_receive: [tab('입고 예정')],
};
const popupActions = {
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
};
for (const screen of ['recipe_category', 'recipe_material_category', 'my_ingredient_categories', 'my_recipe_categories', 'my_material_categories']) {
  popupActions[`category_add@${screen}`] = [first(button('카테고리 추가'))];
  popupActions[`category_edit@${screen}`] = [first(pattern(' 수정$'))];
}
const hostStates = new Set(['ingredient_delete']);

export function destination(target, entities = {}) {
  if (!target.expoRoute) return { path: null, steps: [], manual: true, reason: '현재 Expo 연결 경로가 없습니다.' };
  let route = target.expoRoute.replace(/\/index$/, '');
  let kind = (route.startsWith('ingredients/') && (route.includes('[id]') || route === 'ingredients/option')) || target.screen === 'order_detail' ? 'ingredient'
    : route.includes('[id]') || ['recipe_edit', 'profit', 'menu'].includes(target.screen) ? 'recipe' : null;
  const selected = kind && entities[kind];
  if (kind && !selected) return { path: kind === 'ingredient' ? '/ingredients' : '/recipes', needsEntity: kind, steps: [], manual: false };
  route = '/' + route.replace('[id]', selected ?? '');
  const url = new URL(route, 'http://localhost');
  if (target.screen === 'recipe_edit') url.searchParams.set('id', selected);
  if (route === '/ingredients/option') url.searchParams.set('ingredient', selected);
  if (route === '/recipes/profit-history') url.searchParams.set('id', selected);
  if (route === '/sales/menu') url.searchParams.set('recipe', selected);
  if (target.screen === 'order_detail') url.searchParams.set('ingredient', selected);
  const steps = target.popup ? popupActions[`${target.popup}@${target.screen}`] : screenActions[target.screen];
  const manual = target.popup ? !steps : hostStates.has(target.screen);
  return { path: url.pathname + url.search, kind, steps: steps ?? [], manual,
    reason: manual ? '실제 Expo의 진입 화면입니다. 이 세부 상태의 자동 열기는 아직 연결되지 않았습니다. 화면 안에서 직접 열 수 있습니다.' : null };
}

export function navRows(model, screen) {
  const domain = model.screens[screen].domain;
  const edit = domain === 'ingredient' && (screen === 'ingredient_edit_menu' || model.ingredientEditScreens.includes(screen));
  return { domain, primary: model.domains[domain].screens.filter(k => domain !== 'ingredient' || !model.ingredientEditScreens.includes(k)),
    sub: edit ? model.ingredientEditScreens : [], popups: model.popupTabs[screen] ?? [],
    primaryActive: edit ? 'ingredient_edit_menu' : screen };
}

export function adapterKeys() { return Object.keys(popupActions).map(k => `popup:${k}`); }
