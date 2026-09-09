// Development preview DATA only, consumed by the unchanged Expo RPC parsers.
// No JSX, component styling, authentication values, or database writes.
(() => {
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const names = ['샘플 제육볶음', '샘플 된장찌개', '샘플 김치찌개', '샘플 계란말이', '샘플 비빔밥', '샘플 공기밥'];
  const menus = names.map((name, i) => ({ recipe_id: id(100+i), menu_name: name, qty: 10, qty_hall: 6, qty_delivery: 3, qty_takeout: 1, qty_waste: 0, unit_price: 10000, unit_material_cost: 3000, unit_extra_cost: 200, revenue: 100000, material: 30000 }));
  function sample(rpc, raw, args, target) {
    const r = raw && !Array.isArray(raw) ? raw : {};
    const financial = /(?:@|:)(day|revenue|analytics|material|extra|sales_fixed|expense|channel|waste|tax|menu)$/.test(target);
    const date = args.p_date ?? args.p_from ?? r.sale_date ?? '2026-09-09'; // fixture date, NOT a product business-date fallback
    if (rpc === 'sales_day' && target === 'popup:past_save@sales_past') return { ...r, has_ledger: false, editable: true };
    if (rpc === 'sale_shortages' && target === 'popup:sales_shortage@sales_main') return { mode: 'sale', has_basis: true, ingredient_count: 1, recipes: [{ recipe_id: id(100), name: '샘플 제육볶음', ingredients: [{ ingredient_id: id(300), name: '샘플 돼지고기', base_unit: 'g', stock: 0, need: 100, need_per_serving: 100, per_volume: 1, safety_stock: 0, safety_stock_is_base: true }] }] };
    const summary = { from: date, to: args.p_to ?? date, days: 1, revenue: 600000, etc_revenue: 0, qty: 60,
      material_cost: 180000, extra_material_cost: 12000, tax: 54545, waste_loss: 0, waste_ingredient: 0,
      waste_menu: 0, daily_extra: 3000, fixed_cost: 60000, fixed_rate: 0.1, fixed_rate_provisional: false, profit: 290455 };
    if (rpc === 'ingredient_detail' && raw?.id) {
      const empty = target === 'popup:ingredient_option_empty@ingredient_detail';
      return { ...r, options: empty ? [] : [{ id: id(1), name: '샘플 구매 옵션 1kg', volume: 1000, amount: 4000, vendor_id: null, vendor_name: '샘플 구매처', brand_id: null, brand_name: null, url: null }] };
    }
    if (rpc === 'recipe_profit_history') return { rows: [{ id: id(2), occurred_at: '2026-09-08T05:00:00Z', title: '샘플 재료 단가 반영', summary: '재료비 100원 감소', source_label: '샘플 식재료', cause_key: 'material', cause_label: '재료비', cause_before: 3100, cause_after: 3000, profit_before: 3900, profit_after: 4000, profit_delta: 100, rate_before: 39, rate_after: 40 }], next: null };
    if (rpc === 'business_day_state' && ['popup:sales_state@sales_main', 'popup:sales_close@sales_main'].includes(target)) {
      return { ...r, status: 'open', business_day_id: id(3), business_date: r.today, opened_at: `${r.today}T02:00:00Z`, closed_at: null };
    }
    if (!financial) return undefined;
    if (rpc === 'sales_range') return { ...r, summary, menu: menus, daily: [{ date, revenue: 600000, qty: 60, material: 180000, profit: 290455 }], channels: [{ code: 'hall', name: '매장', amount: 360000, qty: 36, material: 108000, tax: 32727 }, { code: 'delivery', name: '배달', amount: 180000, qty: 18, material: 54000, tax: 16364 }, { code: 'takeout', name: '포장', amount: 60000, qty: 6, material: 18000, tax: 5454 }] };
    if (rpc === 'sales_day') return { ...r, sale_date: date, revision: 1, has_ledger: true, editable: false, basis_quality: 'estimated_current', day_status: 'closed', summary, etc_revenue: 0, daily_extra: 3000, etc_items: [], extra_items: [{ name: '샘플 청소용품', amount: 3000, memo: '미리보기 전용' }], items: menus.map((m, i) => ({ ...m, id: id(200+i) })) };
    if (rpc === 'sales_material_usage') return { total: 180000, items: [{ ingredient_id: id(300), name: '샘플 돼지고기', base_unit: 'g', qty: 6000, unit_price: 30, amount: 180000, menus: names.map(menu_name => ({ menu_name, qty: 1000, amount: 30000 })) }] };
    if (rpc === 'sales_extra_usage') return { total: 12000, items: [{ name: '샘플 포장 용기', qty: 60, amount: 12000, menus: names.map(menu_name => ({ menu_name, qty: 10, unit: 200, amount: 2000 })) }] };
    if (rpc === 'sales_fixed_breakdown') return { month: date.slice(0,7), rate: 0.1, provisional: false, total: 60000, items: [{ key: 'rent', month_total: 1500000, amount: 40000, lines: [{ name: '샘플 임대료', amount: 1500000 }] }, { key: 'utility', month_total: 750000, amount: 20000, lines: [{ name: '샘플 전기·수도', amount: 750000 }] }] };
    return undefined;
  }
  const reads = new Set(['ingredient_list','ingredient_detail','recipe_list','recipe_detail','recipe_profit_history','sales_range','settings_lists','get_settings','operating_hours_status','business_day_state','app_capabilities','recipe_tax_app_state','purchase_history','stock_history','entity_change_history','order_board','recipe_pick_list','day_menu_basis','day_menu_detail','range_menu_detail','international_tax_app_state','get_user_preferences','sales_tax_app_detail','international_tax_regions','sales_channel_fixed','fixed_cost_revenue_check','sales_material_usage','sales_waste_breakdown','sales_tax_breakdown','sales_etc_by_channel','sales_extra_usage','sales_fixed_breakdown','recipe_shortages','sale_shortages','quick_inbound_preview','sales_day']);
  function expected(target) {
    if (target === 'popup:order_price_spike@order_main') return ['simulated:e1_confirm_inbound'];
    if (target === 'popup:tax_saved@my_tax') return ['simulated:save_store_tax'];
    if (target === 'popup:stock_error@stock_change') return ['blocked:quick_inbound'];
    if (target === 'popup:past_save@sales_past') return ['sales_day'];
    if (target === 'popup:sales_shortage@sales_main') return ['sale_shortages'];
    if (/^popup:option_(?:edit|card_menu|more)@/.test(target) || /^popup:ingredient_option_/.test(target)) return ['ingredient_detail'];
    if (target === 'popup:profit_detail@profit' || target === 'screen:profit') return ['recipe_profit_history'];
    if (/^popup:sales_(state|close)@/.test(target)) return ['business_day_state'];
    if (/(?:@|:)day$/.test(target)) return ['sales_range', 'sales_day'];
    for (const [host, rpc] of [['revenue','sales_range'], ['material','sales_material_usage'], ['extra','sales_extra_usage'], ['sales_fixed','sales_fixed_breakdown']]) if (target.endsWith(`@${host}`) || target === `screen:${host}`) return [rpc];
    return [];
  }
  // Explicit missing-contract fixtures; never claim that the local DB supports
  // these APIs. Only this target/RPC matrix may substitute a failed read.
  function missingContract(rpc, target) {
    if (rpc === 'app_capabilities' && /(?:@|:)my_(main|tax)$/.test(target)) return { contract_version: 1, minimum_supported_app_version: '0.1.0', international_tax: { contract_version: 'international_tax_v1', read_enabled: false, write_enabled: false, minimum_write_app_version: null } };
    if (rpc === 'get_user_preferences' && /(?:@|:)my_(language|main)$/.test(target)) return { app_language: 'ko', needs_confirmation: false, source_locale: 'ko-KR', revision: 1 };
    if (rpc === 'international_tax_app_state' && (target === 'screen:my_main' || target === 'popup:tax_country@my_tax')) return { capabilities: missingContract('app_capabilities', 'screen:my_main'), local_date: '2026-09-09', onboarding_status: 'country_confirmation_required', market_profile: null, tax_profile: null, migration: null };
    return undefined;
  }
  function resultScenario(rpc, args, target) {
    if (target === 'popup:order_price_spike@order_main' && rpc === 'e1_confirm_inbound') return { order_id: args.p_order, received_qty: args.p_actual_qty, unit_price: 999, price_spike: true, duplicate: false, already_received: false };
    if (target === 'popup:tax_saved@my_tax' && rpc === 'save_store_tax') return { changed: true, revision: args.p_base_revision + 1, recipes: 7 };
    return undefined;
  }
  window.appmapPreview = { sample, reads, expected, missingContract, resultScenario };
})();
