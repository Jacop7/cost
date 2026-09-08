import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel } from './model.mjs';
import { adapterKeys } from './navigation.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const model = buildModel(root), base = 'http://localhost:8091';
const out = resolve(root, '.tmp/appmap-smoke', new Date().toISOString().replace(/[:.]/g, '-')); mkdirSync(out, { recursive: true });
const results = [], errors = [], blocked = [];
const browser = await chromium.launch();
const reads = new Set(['ingredient_list','ingredient_detail','recipe_list','recipe_detail','recipe_profit_history','sales_range','settings_lists','get_settings','operating_hours_status','business_day_state','app_capabilities','recipe_tax_app_state',
 'purchase_history','stock_history','entity_change_history','order_board','recipe_pick_list','day_menu_basis','day_menu_detail','range_menu_detail',
 'international_tax_app_state','get_user_preferences','sales_tax_app_detail','international_tax_regions','sales_channel_fixed','fixed_cost_revenue_check',
 'sales_material_usage','sales_waste_breakdown','sales_tax_breakdown','sales_etc_by_channel','sales_extra_usage','sales_fixed_breakdown','recipe_shortages','sale_shortages','quick_inbound_preview','sales_day']);
// Use source-defined readonly RPC names as well; report other methods without sending.
// Navigation must never invoke a product mutation automatically.
const context = await browser.newContext({ viewport: { width: 1150, height: 1100 }, locale: 'ko-KR' });
await context.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url());
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) { blocked.push({ path:url.pathname, reason:'nonlocal' }); return route.abort(); }
  const rpc = url.pathname.match(/\/rpc\/([^/]+)$/)?.[1];
  if (rpc && !reads.has(rpc)) { blocked.push({ path:url.pathname, reason:'unlisted-rpc' }); return route.abort(); }
  if (!['GET','HEAD','OPTIONS'].includes(req.method()) && !rpc && url.pathname !== '/auth/v1/token') { blocked.push({ path:url.pathname, reason:'write' }); return route.abort(); }
  return route.continue();
});
try {
  const adapterSet = new Set(adapterKeys());
  const targets = model.targets.filter(t => process.argv.includes('--adapters') ? adapterSet.has(t.id) : !t.popup);
  let next = 0;
  async function worker() { while (next < targets.length) {
    const target = targets[next++];
    const page = await context.newPage(); page.setDefaultTimeout(25000);
    const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(`${base}/appmap/?screen=${target.screen}${target.popup ? '&popup=' + target.popup : ''}`);
      await page.waitForFunction(() => {
        const f = document.getElementById('expo'); const body = f?.contentDocument?.body?.innerText ?? '';
        return body.length > 30 && !/확인하고 있습니다|여는 중/.test(document.getElementById('status').textContent);
      });
      await page.waitForTimeout(500);
      const status = await page.locator('#status').innerText();
      const body = await page.frameLocator('#expo').locator('body').innerText();
      const path = await page.locator('#actual-path').innerText();
      const warning = await page.locator('#status').getAttribute('data-warning') === 'true';
      const semanticFailure = (Boolean(target.popup) && warning) || /정보를 불러오지 못했어요|메뉴를 찾을 수 없어요|서버 연결에 실패/.test(body)
        || (target.screen === 'order_detail' && (body.includes('먼저 식재료를 선택') || !path.includes('ingredient=')))
        || (target.screen === 'menu' && !path.includes('recipe='));
      results.push({ target:target.id, path, status, bodyStart:body.slice(0,160), pageErrors, semanticFailure, warning });
      if (['ingredient_main','recipe_add','recipe_edit','my_main'].includes(target.screen)) await page.screenshot({ path:resolve(out, target.screen+'.png') });
      console.log(target.id, path, warning ? 'WARNING' : 'LOADED', pageErrors.length);
    } catch (e) { errors.push({ target:target.id, message:e.message }); console.log('FAIL',target.screen,e.message.slice(0,100)); }
    finally { await page.close(); }
  } }
  await Promise.all([worker(), worker(), worker()]);
} finally {
  await browser.close();
  writeFileSync(resolve(out, 'results.json'), JSON.stringify({ scope:'actual Expo route loading, not design or popup completion', sourceSha256:model.sourceSha256, results, errors, blocked }, null, 2));
  console.log('REPORT',resolve(out,'results.json'));
}
if (errors.length || blocked.length || results.some(r => r.pageErrors.length || r.semanticFailure)) process.exitCode = 1;
