// Synthetic current USD market / future KR or GB reservation. No live RPC.
export const CURRENT_STORE = '00000000-0000-4000-8000-000000000010';
export const CURRENT_MARKET = {
  id: '00000000-0000-4000-8000-000000000020', store_id: CURRENT_STORE, revision: 1,
  country_code: 'US', region_code: 'US-NY', currency_code: 'USD', minor_unit: 2,
  business_locale_code: 'en-US', price_basis: 'tax_exclusive',
  effective_from: '2026-08-31', effective_to: '2026-09-01',
};
export const QUOTE_CONTEXT = {
  local_date: '2026-09-01', market: CURRENT_MARKET,
  tax_profile_id: '00000000-0000-4000-8000-000000000030', tax_profile_revision: 1,
  sales_channel_code: 'hall',
};
