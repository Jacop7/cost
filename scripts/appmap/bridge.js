// Only injected into the dev iframe. Preserve responses and product behavior.
(() => {
  if (window.parent === window) return;
  const send = payload => window.parent.postMessage({ type: 'appmap-observation', ...payload }, location.origin);
  const original = window.fetch;
  window.fetch = async function (...args) {
    const response = await original.apply(this, args);
    try {
      const url = new URL(typeof args[0] === 'string' ? args[0] : args[0].url, location.href);
      const kind = url.pathname.endsWith('/rpc/ingredient_list') ? 'ingredient' : url.pathname.endsWith('/rpc/recipe_list') ? 'recipe' : null;
      if (kind && response.ok) response.clone().json().then(data => {
        if (!Array.isArray(data)) return;
        send({ kind, entities: data.filter(x => x.active !== false && /^[a-f0-9-]{36}$/i.test(x.id)).map(x => ({ id: x.id, name: String(x.name ?? x.id) })) });
      }).catch(() => {});
    } catch { /* Observer errors must not affect the app. */ }
    return response;
  };
  let last = '';
  let lastError = false;
  setInterval(() => {
    const path = location.pathname + location.search;
    if (path !== last) { last = path; send({ path }); }
    const dataError = /정보를 불러오지 못했어요|메뉴를 찾을 수 없어요|서버 연결에 실패/.test(document.body?.innerText ?? '');
    if (dataError !== lastError) { lastError = dataError; send({ dataError }); }
  }, 300);
})();
