export const simulationStore='00000000-0000-4000-8000-000000000001';
export const simulationRecipe='00000000-0000-4000-8000-000000000002';
/** Transport fixture, not a second product calculator. */
export function simulationRaw(price=12.34){
 const one={servings:1,listed_total:price,tax:1.23,net_sales:price,customer_total:price+1.23,material:1,extra:1,fixed:2.468,profit:7.872,profit_rate:0.6379254457,meets_target:true};
 return {contract_version:1,store_id:simulationStore,recipe_id:simulationRecipe,input_price:price,local_date:'2026-09-11',base_servings:2,
  recipe_updated_at:'2026-09-11T00:00:00Z',recommendation_status:'not_supported',status:'ready',reason:null,
  context:{market_id:simulationStore,market_revision:1,country_code:'US',currency_code:'USD',business_locale_code:'en-US',minor_unit:2,price_basis:'tax_exclusive',
   tax_profile_id:simulationRecipe,tax_profile_revision:1,treatment:'taxable',tax_category:null,override_revision:0,sales_channel_code:'hall'},
  quote:{listed_total:price,net_sales:price,customer_total:price+1.23,tax_total:1.23,merchant_tax_liability:1.23,marketplace_tax_liability:0,components:[]},
  basis:{material_per_serving:1,extra_per_serving:1,missing_ingredient_price_ids:[],fixed_month:'2026-09',fixed_revenue:1000,fixed_total:200,fixed_rate:0.2,target_profit_rate:30,
   profit_rate_denominator:'listed_total',batch_basis:'per_serving_comparison'},one,batch:{...one,servings:2,listed_total:price*2,tax:2.46,net_sales:price*2,customer_total:(price+1.23)*2,material:2,extra:2,fixed:4.936,profit:15.744}};
}
