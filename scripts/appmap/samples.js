// Development preview DATA only, consumed by the unchanged Expo RPC parsers.
// No JSX, component styling, authentication values, or database writes.
(() => {
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const names = ['샘플 제육볶음', '샘플 된장찌개', '샘플 김치찌개', '샘플 계란말이', '샘플 비빔밥', '샘플 공기밥'];
  const menus = names.map((name, i) => ({ recipe_id: id(100+i), menu_name: name, qty: 10, qty_hall: 6, qty_delivery: 3, qty_takeout: 1, qty_waste: 0, unit_price: 10000, unit_material_cost: 3000, unit_extra_cost: 200, revenue: 100000, material: 30000 }));
  const salesDraft = (draftId, businessDate) => ({
    draft_id: draftId ?? id(9603), business_date: businessDate ?? '2026-09-16', kind: 'initial',
    status: 'editing', revision: 0, payload_hash: '0'.repeat(64), expires_at: '2026-10-01T00:00:00Z',
    payload: {
      items: names.map((menuName, i) => ({
        id: id(9700 + i), recipe_id: id(100 + i), menu_name: menuName,
        price: 10000,
        qty_hall: 0, qty_delivery: 0, qty_takeout: 0, qty_waste: 0, deleted: false,
      })),
      etc_items: [], extra_items: [],
      summary: { revenue: 0, expense: 0, profit: 0, expense_rate: 0, profit_rate: 0 },
    },
  });
  function sample(rpc, raw, args, target) {
    const r = raw && !Array.isArray(raw) ? raw : {};
    const fixedDetail = ['popup:fixed_complete@fixed_average', 'screen:fixed_detail_month', 'screen:fixed_detail_average'].includes(target);
    const salesFeed = target === 'screen:sales_main';
    const salesMainTarget = salesFeed || target.endsWith('@sales_main');
    const financial = salesFeed || fixedDetail || /(?:@|:)(day|day_full|revenue|analytics|material|extra|sales_fixed|expense|channel|waste|tax|menu)$/.test(target);
    const date = args.p_date ?? args.p_from ?? r.sale_date ?? '2026-09-09'; // fixture date, NOT a product business-date fallback
    const fixedCostPreview = ['popup:fixed_complete@fixed_average', 'screen:fixed_detail_month', 'screen:fixed_detail_average', 'screen:fixed_settings'].includes(target);
    if (fixedCostPreview && ['get_fixed_cost_basis', 'get_fixed_cost_configuration'].includes(rpc)) {
      const fixedItems = [
        { key: 'labor', mode: 'detail', total: 2400000,
          lines: [{ name: '주방 이모 (월급)', amount: 1700000 }, { name: '홀 아르바이트', amount: 700000 }],
          weights: { hall: 30, delivery: 50, takeout: 20 } },
        { key: 'commission', mode: 'detail', total: 603000,
          lines: [{ name: '배달앱 중개 수수료', amount: 380000 }, { name: '카드·간편결제 수수료', amount: 133000 }, { name: '포장 주문 중개', amount: 90000 }],
          weights: { delivery: 100 } },
        { key: 'packing', mode: 'detail', total: 380000,
          lines: [{ name: '포장 용기', amount: 260000 }, { name: '비닐봉투·수저세트', amount: 120000 }],
          weights: { delivery: 70, takeout: 30 } },
        { key: 'delivery', mode: 'detail', total: 120000,
          lines: [{ name: '배달대행 월정액', amount: 120000 }], weights: { delivery: 100 } },
        { key: 'ads', mode: 'detail', total: 253000,
          lines: [{ name: '배달앱 광고', amount: 180000 }, { name: '전단·SNS', amount: 73000 }], weights: null },
      ];
      if (rpc === 'get_fixed_cost_configuration') return {
        requested_month: '2026-09', effective_month: '2026-09', configured: true,
        current_revision: 4, source_revision: 4, items: fixedItems, reentry: null,
      };
      const months = ['2026-08', '2026-07', '2026-06'].map(month => ({ month, entered: true,
        total_revenue: 12000000, total_fixed: 3756000, rate: 0.313, items: fixedItems }));
      return { target_month: '2026-09', basis_months: 3, from_month: '2026-06', to_month: '2026-08',
        entered_months: 3, missing_months: [], applied: true, rate: 0.313,
        average_revenue: 12000000, average_fixed: 3756000, revision: 4, months };
    }
    if (target === 'popup:stock_event_revert@stock') {
      if (rpc === 'stock_history') return [{ id: id(9401), occurred_on: args.p_to ?? date,
        type: 'inbound', count_delta: 1000, volume_delta: 1000, note: '샘플 입고 기록', balance: 1000, reverted: false, waste: false }];
      if (rpc === 'stock_revert_candidates') return [{ event_id: id(9401), eligible: true, action: '입고' }];
      if (rpc === 'ingredient_detail' && raw?.id) return { ...r, stock_total: 1000 };
    }
    if (rpc === 'sales_day' && target === 'popup:past_save@sales_past') return { ...r, has_ledger: false, editable: true };
    if (rpc === 'fixed_cost_change_history' && (target === 'screen:fixed_average' || target.endsWith('my_fixed_history'))) {
      return { count: 1, counts: { all: 1, settings: 1, monthly: 1 }, next_cursor: null,
        items: [{ id: '9501', source: 'fixed_cost', source_type: 'direct', operation: 'update', operation_subject_type: 'fixed_cost', change_type: 'settings_reentry',
        affected_months: ['2026-06', '2026-07', '2026-08'], reversible: true, latest_change_id: '9501',
        occurred_at: '2026-09-09T00:00:00Z', effective_from: '2026-09-09', application_mode: 'immediate',
        before_value: { basis_months: 2, items: [{ key: 'rent', label: '임대료', total: 1000000 }], months: [] },
        after_value: { basis_months: 3, items: [{ key: 'rent', label: '임대료', total: 1500000 }], reentry_session_id: id(9503), months: [] },
      }] };
    }
    if (rpc === 'store_configuration_history' && target.endsWith('my_tax_history')) return {
      count: 1, next_cursor: null, items: [{ id: '9501', source: 'tax_profile',
        occurred_at: '2026-09-09T00:00:00Z', effective_from: '2026-09-09', application_mode: 'immediate',
        before_value: { components: [{ key: 'primary', name: '샘플 부가세', rate_pct: 9 }] },
        after_value: { components: [{ key: 'primary', name: '샘플 부가세', rate_pct: 10 }] },
      }] };
    if (rpc === 'entity_change_history' && ['screen:ingredient_changes', 'popup:ingredient_change_detail@ingredient_changes'].includes(target) && args.p_entity_type === 'ingredient') {
      // Explicit read-only preview snapshot, not a repair of real historical rows.
      const eventId = id(9301);
      return { items: [{ id: eventId, occurred_at: '2026-09-07T00:05:00Z', title: '입고 단가 반영', summary: '입고 확정으로 기준 단가 변경', source_type: 'inbound', source_name: null,
        affects_sales: true, state: 'reflected', affected_recipes: 0, has_history: true,
        changes: [
          { key: 'received_quantity', label: '실입고량', before: null, after: 1000, unit: 'g', change_kind: 'direct' },
          { key: 'paid_amount', label: '결제금액', before: null, after: 4000, unit: '원', change_kind: 'direct' },
          { key: 'unit_price', label: '기준 단가', before: 0, after: 4, unit: '원/g', change_kind: 'derived' },
        ] }, { id: id(9302), occurred_at: '2026-09-07T00:04:00Z', title: '재료 등록', summary: '등록 변경', source_type: 'direct', affects_sales: false, state: 'irrelevant', has_history: true,
          changes: [{ key: 'base_unit', label: '기준 단위', before: null, after: 'g', unit: null, change_kind: 'direct' }] }],
        next_cursor: null, summary: { days: 7, count: 2, direct_count: 1, auto_count: 1, latest_reflected_event_id: eventId, latest_unreflected_event_id: null, latest_unreflected_state: null } };
    }
    if (rpc === 'sale_shortages' && target === 'popup:sales_shortage@sales_main') return { mode: 'sale', has_basis: true, ingredient_count: 1, recipes: [{ recipe_id: id(100), name: '샘플 제육볶음', ingredients: [{ ingredient_id: id(300), name: '샘플 돼지고기', base_unit: 'g', stock: 0, need: 100, need_per_serving: 100, per_volume: 1, safety_stock: 0, safety_stock_is_base: true }] }] };
    const summary = { from: date, to: args.p_to ?? date, days: 1, revenue: 600000, etc_revenue: 0, qty: 60,
      material_cost: 180000, extra_material_cost: 12000, tax: 54545, waste_loss: 0, waste_ingredient: 0,
      waste_menu: 0, daily_extra: 3000, fixed_cost: 60000, fixed_rate: 0.1, fixed_rate_provisional: false, profit: 290455 };
    if (salesFeed && rpc === 'sales_feed') {
      const to = args.p_to ?? date;
      return {
        from: args.p_from ?? date, to,
        summary: { ...summary, from: args.p_from ?? date, to, days: 4, uncomputed_day_count: 0 },
        counts: { missing: 1, editing: 1, completed: 1, closed: 1 },
        items: [
          { business_date: to, status: 'missing', draft_id: null, version_id: null,
            sales: 0, net_sales: 0, qty: 0, expense: null, profit: null, profit_rate: null,
            can_edit: true, can_classify: true, calendar_revision: 0, blocked_reason: null, action: 'write' },
          { business_date: '2026-09-15', status: 'editing', draft_id: id(9601), version_id: null,
            sales: 0, net_sales: 0, qty: 0, expense: null, profit: null, profit_rate: null,
            can_edit: true, can_classify: false, calendar_revision: 0, blocked_reason: null, action: 'resume' },
          { business_date: '2026-09-14', status: 'completed', draft_id: null, version_id: id(9602),
            sales: 600000, net_sales: 545455, qty: 60, expense: 255000, profit: 290455, profit_rate: 53.3,
            can_edit: true, can_classify: false, calendar_revision: 0, blocked_reason: null, action: 'detail' },
          { business_date: '2026-09-13', status: 'closed', draft_id: null, version_id: null,
            sales: 0, net_sales: 0, qty: 0, expense: null, profit: null, profit_rate: null,
            can_edit: false, can_classify: true, calendar_revision: 2, blocked_reason: null, action: 'detail' },
        ],
        clock: { server_now: `${to}T05:00:00Z`, recommended_sales_date: to,
          editable_from: '2026-08-01', editable_to: to },
      };
    }
    if (salesMainTarget && rpc === 'sales_inventory_count_requirement') {
      return { required: false, phase: 'active', reference_sales_date: null, reason: null };
    }
    if (rpc === 'ingredient_detail' && raw?.id && ['popup:order_order_unselected@order_main', 'popup:order_purchase_links@order_main'].includes(target)) {
      return { ...r, options: [
        { id: id(1), name: `${r.name ?? '재료'} 1kg`, volume: 1000, amount: 28000,
          vendor_id: id(9001), vendor_name: '샘플 구매처', brand_id: null, brand_name: null, url: 'https://example.com/purchase/1kg' },
        { id: id(2), name: `${r.name ?? '재료'} 3kg`, volume: 3000, amount: 78000,
          vendor_id: id(9002), vendor_name: '샘플 도매상', brand_id: null, brand_name: null, url: 'https://example.com/purchase/3kg' },
      ] };
    }
    if (rpc === 'ingredient_detail' && raw?.id) {
      const empty = target === 'popup:ingredient_option_empty@ingredient_detail';
      return { ...r, options: empty ? [] : [{ id: id(1), name: '샘플 구매 옵션 1kg', volume: 1000, amount: 4000, vendor_id: id(9001), vendor_name: '샘플 구매처', brand_id: null, brand_name: null, url: null }] };
    }
    if (rpc === 'settings_lists') return { ...r, vendors: [...(Array.isArray(r.vendors) ? r.vendors.filter(v => v.id !== id(9001)) : []), { id: id(9001), name: '샘플 구매처' }] };
    if (rpc === 'recipe_profit_history') return { rows: [{ id: id(2), occurred_at: '2026-09-08T05:00:00Z', title: '샘플 재료 단가 반영', summary: '재료비 100원 감소', source_label: '샘플 재료', cause_key: 'material', cause_label: '재료비', cause_before: 3100, cause_after: 3000, profit_before: 3900, profit_after: 4000, profit_delta: 100, rate_before: 39, rate_after: 40 }], next: null };
    if (rpc === 'business_day_state' && ['popup:sales_state@sales_main', 'popup:sales_close@sales_main', 'popup:sales_break@sales_main'].includes(target)) {
      return { ...r, status: 'open', business_day_id: id(3), business_date: r.today, opened_at: `${r.today}T02:00:00Z`, closed_at: null };
    }
    if (!financial) return undefined;
    if (rpc === 'sales_day_read') return {
      business_date: date, status: 'completed', draft: null, can_edit: true,
      version: {
        id: id(9602), version_no: 1, basis_quality: 'estimated_current',
        finalized_at: `${date}T14:00:00Z`, payload: {}, summary,
        customer_total: summary.revenue, net_sales: summary.revenue - summary.tax,
        fixed_rate: summary.fixed_rate, ledger_revision: 1,
      },
    };
    if (rpc === 'sales_authoritative_range_detail') return {
      from: args.p_from ?? date, to: args.p_to ?? date,
      menu: menus,
      channels: [
        { code: 'hall', name: '매장', amount: 360000, qty: 36, material: 108000, tax: 32727, net_sales: 327273, fixed_cost: 36000 },
        { code: 'delivery', name: '배달', amount: 180000, qty: 18, material: 54000, tax: 16364, net_sales: 163636, fixed_cost: 18000 },
        { code: 'takeout', name: '포장', amount: 60000, qty: 6, material: 18000, tax: 5454, net_sales: 54546, fixed_cost: 6000 },
      ],
      fixed_cost_total: summary.fixed_cost, fixed_cost_unallocated: 0,
    };
    if (rpc === 'sales_range') return { ...r, summary, menu: menus, daily: [{ date, revenue: 600000, qty: 60, material: 180000, profit: 290455 }], channels: [{ code: 'hall', name: '매장', amount: 360000, qty: 36, material: 108000, tax: 32727 }, { code: 'delivery', name: '배달', amount: 180000, qty: 18, material: 54000, tax: 16364 }, { code: 'takeout', name: '포장', amount: 60000, qty: 6, material: 18000, tax: 5454 }] };
    if (rpc === 'sales_day') return { ...r, sale_date: date, revision: 1, has_ledger: true,
      editable: /^popup:expense_(add|delete)@expense$/.test(target), basis_quality: 'estimated_current',
      day_status: /^popup:expense_(add|delete)@expense$/.test(target) ? 'open' : 'closed',
      summary, etc_revenue: 0, daily_extra: 3000, etc_items: [], extra_items: [{ name: '샘플 청소용품', amount: 3000, memo: '미리보기 전용' }], items: menus.map((m, i) => ({ ...m, id: id(200+i) })) };
    if (rpc === 'sales_material_usage') return { total: 180000, items: [{ ingredient_id: id(300), name: '샘플 돼지고기', base_unit: 'g', qty: 6000, unit_price: 30, amount: 180000, menus: names.map(menu_name => ({ menu_name, qty: 1000, amount: 30000 })) }] };
    if (rpc === 'sales_extra_usage') return { total: 12000, items: [{ name: '샘플 포장 용기', qty: 60, amount: 12000, menus: names.map(menu_name => ({ menu_name, qty: 10, unit: 200, amount: 2000 })) }] };
    if (rpc === 'sales_fixed_breakdown') return { month: date.slice(0,7), rate: 0.1, provisional: false, total: 60000, items: [{ key: 'rent', month_total: 1500000, amount: 40000, lines: [{ name: '샘플 임대료', amount: 1500000 }] }, { key: 'utility', month_total: 750000, amount: 20000, lines: [{ name: '샘플 전기·수도', amount: 750000 }] }] };
    return undefined;
  }
  const reads = new Set(['ingredient_list','ingredient_list_v2','ingredient_legacy_material_history','ingredient_detail','recipe_list','recipe_detail','recipe_profit_history','sales_range','sales_feed','sales_day_read','sales_authoritative_range_detail','settings_lists','get_settings','operating_hours_status','business_day_state','app_capabilities','recipe_tax_app_state','recipe_price_simulation','purchase_history','stock_history','entity_change_history','order_board','recipe_pick_list','day_menu_basis','day_menu_detail','range_menu_detail','international_tax_app_state','get_user_preferences','sales_tax_app_detail','international_tax_regions','sales_channel_fixed','fixed_cost_revenue_check','get_fixed_cost_basis','get_fixed_cost_configuration','sales_material_usage','sales_waste_breakdown','sales_tax_breakdown','sales_etc_by_channel','sales_extra_usage','sales_fixed_breakdown','recipe_shortages','sale_shortages','quick_inbound_preview','sales_day']);
  // Verified STABLE RPCs: server clock and inventory occurrence context/conversion.
  // These read server authority without recording an inventory event.
  reads.add('sales_lifecycle_clock');
  reads.add('inventory_event_occurrence_context');
  reads.add('inventory_event_local_timestamp');
  reads.add('recipe_draft_preview');
  reads.add('recipe_price_recommendation');
  function expected(target) {
    if (['popup:order_order_unselected@order_main', 'popup:order_purchase_links@order_main'].includes(target)) return ['ingredient_detail'];
    if (target === 'popup:stock_event_revert@stock') return ['stock_history', 'stock_revert_candidates', 'ingredient_detail'];
    if (['screen:ingredient_changes', 'popup:ingredient_change_detail@ingredient_changes'].includes(target)) return ['entity_change_history'];
    if (target === 'popup:tax_saved@my_tax') return ['simulated:save_tax_configuration'];
    if (target.endsWith('my_fixed_history')) return ['fixed_cost_change_history'];
    if (target.endsWith('my_tax_history')) return ['store_configuration_history'];
    if (target === 'popup:stock_error@stock_change') return ['blocked:quick_inbound'];
    if (target === 'popup:past_save@sales_past') return ['sales_day'];
    if (['screen:fixed_detail_month', 'screen:fixed_detail_average'].includes(target)) return [];
    if (target === 'popup:fixed_complete@fixed_average') return ['get_fixed_cost_basis'];
    if (target === 'screen:fixed_settings') return ['get_fixed_cost_basis', 'get_fixed_cost_configuration'];
    if (target === 'popup:sales_shortage@sales_main') return ['sale_shortages'];
    if (target === 'screen:sales_main') return ['sales_feed', 'simulated:sales_inventory_count_requirement'];
    if (target === 'screen:sales_write') return ['simulated:open_sales_draft', 'simulated:sales_draft_detail'];
    if (target === 'screen:sales_past') return ['simulated:open_sales_draft', 'simulated:sales_draft_detail'];
    if (/^popup:option_(?:edit|card_menu|more)@/.test(target) || /^popup:ingredient_option_/.test(target)) return ['ingredient_detail'];
    if (target === 'popup:profit_detail@profit' || target === 'screen:profit') return ['recipe_profit_history'];
    if (/^popup:sales_(state|close|break)@/.test(target)) return ['business_day_state'];
    if (/(?:@|:)day$/.test(target)) return ['sales_range', 'sales_authoritative_range_detail', 'sales_day', 'sales_day_read'];
    if (target === 'screen:day_full') return ['sales_range', 'sales_authoritative_range_detail', 'sales_material_usage', 'sales_extra_usage', 'sales_fixed_breakdown'];
    for (const [host, rpc] of [['revenue','sales_range'], ['material','sales_material_usage'], ['extra','sales_extra_usage'], ['sales_fixed','sales_fixed_breakdown']]) if (target.endsWith(`@${host}`) || target === `screen:${host}`) return rpc === 'sales_range' ? ['sales_range', 'sales_authoritative_range_detail'] : [rpc];
    return [];
  }
  // Explicit missing-contract fixtures; never claim that the local DB supports
  // these APIs. Only this target/RPC matrix may substitute a failed read.
  function missingContract(rpc, target) {
    if (rpc === 'inventory_event_occurrence_context' && (
      target === 'screen:stock_change' || target.endsWith('@stock_change')
      || target === 'screen:order_receive' || target.startsWith('popup:order_receive@')
    )) return {
      server_now: '2026-09-16T05:00:00Z', timezone: 'Asia/Seoul', requires_confirmation: false,
      observation_started_at: null, counted_at: null, observation_started_local: null, counted_local: null,
    };
    if (rpc === 'app_capabilities' && /(?:@|:)my_(main|tax)$/.test(target)) return { contract_version: 1, minimum_supported_app_version: '0.1.0', international_tax: { contract_version: 'international_tax_v1', read_enabled: false, write_enabled: false, minimum_write_app_version: null } };
    if (rpc === 'get_user_preferences' && /(?:@|:)my_(language|main)$/.test(target)) return { app_language: 'ko', needs_confirmation: false, source_locale: 'ko-KR', revision: 1 };
    if (rpc === 'international_tax_app_state' && (target === 'screen:my_main' || target === 'popup:tax_country@my_tax')) return { capabilities: missingContract('app_capabilities', 'screen:my_main'), local_date: '2026-09-09', onboarding_status: 'country_confirmation_required', market_profile: null, tax_profile: null, migration: null };
    return undefined;
  }
  function resultScenario(rpc, args, target) {
    // Entering the write screen opens a server draft. In preview, return an
    // in-memory draft so the real screen can render without touching the DB.
    // Later save/finalize/discard mutations remain blocked by the bridge.
    const salesMainTarget = target === 'screen:sales_main' || target.endsWith('@sales_main');
    const salesDraftTarget = salesMainTarget || target === 'screen:sales_write'
      || target === 'screen:sales_past' || target.endsWith('@sales_past');
    if (salesMainTarget && rpc === 'sales_inventory_count_requirement')
      return sample(rpc, {}, args, target);
    if (salesDraftTarget && rpc === 'open_sales_draft')
      return salesDraft(args.p_draft_id, args.p_date);
    if (salesDraftTarget && rpc === 'sales_draft_detail')
      return salesDraft(args.p_draft, args.p_date);
    if (target === 'screen:my_fixed_history' && rpc === 'revert_fixed_cost_change') return { reverted: true, change_id: args.p_change };
    if (target === 'popup:tax_saved@my_tax' && rpc === 'save_store_tax') return { changed: true, revision: args.p_base_revision + 1, recipes: 7 };
    if (target === 'popup:tax_saved@my_tax' && rpc === 'save_tax_configuration') return { changed: true,
      profile_id: id(9502), revision: (args.p_tax_revision ?? 0) + 1, effective_from: '2026-09-09', application_mode: 'immediate' };
    return undefined;
  }
  reads.add('get_bundle_units');
  reads.add('store_configuration_history'); // Read-only configuration audit list; settings writes remain blocked.
  reads.add('fixed_cost_change_history'); // Unified fixed-cost settings/monthly audit list.
  reads.add('ingredient_delete_check');
  reads.add('stock_revert_candidates'); // Read only. The reversal mutation remains blocked in samples.
  window.appmapPreview = { sample, reads, expected, missingContract, resultScenario };
})();
