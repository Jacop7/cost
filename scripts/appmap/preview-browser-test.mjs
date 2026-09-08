import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  for (const file of ['samples.js', 'bridge.js']) {
    const page = await browser.newPage();
    await page.route(`**/appmap/${file}`, r => r.abort());
    await page.goto('http://localhost:8091/appmap/?screen=ingredient_main');
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('샘플 미리보기 로딩에 실패'));
    assert.equal(await page.locator('#limitation').isVisible(), true);
    assert.equal(await page.locator('#expo').getAttribute('src'), 'about:blank');
    console.log('PASS', file, 'missing => stopped + visible limitation');
    await page.close();
  }
  const page = await browser.newPage();
  const source = readFileSync(new URL('./bridge.js', import.meta.url), 'utf8');
  const receipt = 'send({ sampleApplied: rpc, sampleTarget: target });';
  assert.ok(source.includes(receipt));
  await page.route('**/appmap/bridge.js', r => r.fulfill({ contentType: 'text/javascript', body: source.replace(receipt, '/* receipt intentionally omitted for negative test */') }));
  await page.goto('http://localhost:8091/appmap/?screen=options&popup=option_edit');
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('샘플 응답을 확인하지 못했습니다'));
  assert.equal(await page.locator('#limitation').isVisible(), true);
  console.log('PASS missing receipt => visible limitation, not completion');
  await page.close();
  const real = await browser.newPage();
  await real.goto('http://localhost:8091/appmap/?screen=ingredient_main&data=real');
  await real.waitForFunction(() => document.getElementById('status').textContent.includes('실제 Expo 연결'));
  assert.equal(await real.locator('#sample-banner').isVisible(), false);
  const f = real.frames().find(f => f !== real.mainFrame());
  assert.equal(await f.evaluate(() => Boolean(window.__APPMAP_SAMPLE_TARGET__)), false);
  console.log('PASS real mode has no sample target/banner');
  await real.close();
} finally { await browser.close(); }
