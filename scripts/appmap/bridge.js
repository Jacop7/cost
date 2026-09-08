// Only injected into the dev iframe. Preserve responses and product behavior.
(() => {
  if (window.parent === window) return;
  const send = payload => window.parent.postMessage({ type: 'appmap-observation', run: window.__APPMAP_RUN__, ...payload }, location.origin);
  const original = window.__APPMAP_UNGUARDED_FETCH__ ?? window.fetch;
  delete window.__APPMAP_UNGUARDED_FETCH__;
  const target = window.__APPMAP_SAMPLE_TARGET__;
  const preview = target && window.appmapPreview;
  window.fetch = async function (...args) {
    const input = args[0];
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href);
    const rpc = url.pathname.match(/\/rpc\/([^/]+)$/)?.[1];
    const method = (args[1]?.method ?? input?.method ?? 'GET').toUpperCase();
    if (target && ((rpc && (!preview || !preview.reads.has(rpc))) || (!rpc && !['GET','HEAD','OPTIONS'].includes(method) && url.pathname !== '/auth/v1/token'))) {
      // Two explicit result-only scenarios. NEVER forward these mutations;
      // callbacks only affect this disposable iframe's in-memory query cache.
      if (preview?.resultScenario && rpc && method === 'POST') {
        try {
          const body = args[1]?.body ?? (input instanceof Request ? await input.clone().text() : '{}');
          const fixture = preview.resultScenario(rpc, JSON.parse(body || '{}'), target);
          if (fixture !== undefined) {
            send({ sampleApplied: 'simulated:' + rpc, sampleTarget: target });
            return new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } });
          }
        } catch { /* Failed fixture stays denied, never passes through. */ }
      }
      if (target === 'popup:stock_error@stock_change' && rpc === 'e5_stock_adjusted') send({ sampleApplied: 'blocked:e5_stock_adjusted', sampleTarget: target });
      send({ writeBlocked: true, rpc, diagnosticOnly: rpc === 'report_client_rpc_error' });
      return new Response(JSON.stringify({ code: 'APPMAP_SAMPLE_READ_ONLY', message: '샘플 미리보기에서는 저장·삭제하지 않습니다. 실제 데이터 모드에서 작업하세요.' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }
    let requestBody = '{}';
    if (preview && rpc) requestBody = args[1]?.body ?? (input instanceof Request ? await input.clone().text() : '{}');
    window.__APPMAP_PENDING_READS__ = (window.__APPMAP_PENDING_READS__ ?? 0) + 1;
    try {
    let response = await original.apply(this, args);
    if (preview && rpc && response.status === 404) {
      const fixture = preview.missingContract?.(rpc, target);
      if (fixture !== undefined) {
        send({ sampleApplied: rpc, sampleTarget: target, missingContract: rpc });
        response = new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    }
    if (preview && rpc && response.ok) {
      try {
        const data = preview.sample(rpc, await response.clone().json(), JSON.parse(requestBody || '{}'), target);
        if (data !== undefined) {
          response = new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
          send({ sampleApplied: rpc, sampleTarget: target });
        }
      } catch { send({ sampleFailure: rpc }); /* Keep real response; report failed sample transformation. */ }
    }
    try {
      const url = new URL(typeof args[0] === 'string' ? args[0] : args[0].url, location.href);
      const kind = url.pathname.endsWith('/rpc/ingredient_list') ? 'ingredient' : url.pathname.endsWith('/rpc/recipe_list') ? 'recipe' : null;
      if (kind && response.ok) response.clone().json().then(data => {
        if (!Array.isArray(data)) return;
        send({ kind, entities: data.filter(x => x.active !== false && /^[a-f0-9-]{36}$/i.test(x.id)).map(x => ({ id: x.id, name: String(x.name ?? x.id) })) });
      }).catch(() => {});
    } catch { /* Observer errors must not affect the app. */ }
    return response;
    } finally { window.__APPMAP_PENDING_READS__--; }
  };
  window.__APPMAP_BRIDGE_READY__ = true;
  let last = '';
  let lastError = false;
  setInterval(() => {
    const path = location.pathname + location.search;
    if (path !== last) { last = path; send({ path }); }
    const dataError = /정보를 불러오지 못했어요|메뉴를 찾을 수 없어요|서버 연결에 실패/.test(document.body?.innerText ?? '');
    if (dataError !== lastError) { lastError = dataError; send({ dataError }); }
  }, 300);
})();
