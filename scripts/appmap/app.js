import { activeTargetId, destination, navRows, matchesPathCondition } from './navigation.mjs';
const $ = id => document.getElementById(id);
const model = await fetch('/appmap/model.json').then(r => { if (!r.ok) throw Error('탭 목록을 읽지 못했습니다.'); return r.json(); });
const frame = $('expo');
const entities = { ingredient: [], recipe: [] }, selected = {};
let current, generation = 0, pending, entityLookup = null;
let sampleMode = new URL(location.href).searchParams.get('data') === 'sample';
let termsMode = false, terminology = null;
const termView = { query: '', status: 'all', category: 'all' };
const termStatusMeta = { all: ['수정 항목', ''], applied: ['반영완료', 'keep'], merge: ['통일 기준', 'merge'], context: ['문맥 구분', 'context'], keep: ['확정 유지', 'keep'], custom: ['사용자 설정값', 'custom'] };
const termCategories = ['공통·탐색','재료·재고','구매·입고','메뉴','발주','매출·손익','세금·통화','매장·설정','계정·인증','상태·기록','시스템·접근성','숫자·단위'];
const resultOnly = id => id === 'popup:tax_saved@my_tax';
const resultNotice = ' 결과 화면 예시입니다. 아래 저장·입고 완료 문구와 재계산 건수는 시뮬레이션이며 실제 저장·입고는 하지 않았습니다.';
function status(text, warning = false) {
  if (warning && pending?.manual && pending.reason && text !== pending.reason) text = `${pending.reason}\n\n현재 조회 상태: ${text}`;
  $('status').textContent = text; $('status').dataset.warning = String(warning);
  $('limitation').hidden = !warning;
  $('limitation-text').textContent = text;
}
function makeButton(text, action, active = false) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
  b.setAttribute('aria-current', String(active)); b.onclick = action; return b;
}
function visibleScreenPath(path) {
  if (!path) return '';
  const url = new URL(path, location.origin);
  for (const key of [...url.searchParams.keys()]) if (key.startsWith('__appmap')) url.searchParams.delete(key);
  if (url.pathname === '/my/tax-simulation') {
    for (const key of ['country', 'basis', 'treatment', 'components']) url.searchParams.delete(key);
  }
  return url.pathname + url.search;
}
function updateScreenUrl(path) {
  const row = $('screen-url-row'), link = $('screen-url');
  if (!path) { row.hidden = true; link.removeAttribute('href'); link.textContent = ''; return; }
  const expoOrigin = `${location.protocol}//${location.hostname}:${model.expoPort}`;
  const url = new URL(path, expoOrigin);
  for (const key of [...url.searchParams.keys()]) if (key.startsWith('__appmap')) url.searchParams.delete(key);
  link.href = url.href;
  link.textContent = new URL(visibleScreenPath(url), expoOrigin).href;
  row.hidden = false;
}
function choose(id, push = true) {
  termsMode = false;
  $('screen-toolbar').hidden = false; $('status').hidden = false; $('screen-view').hidden = false; $('terms-view').hidden = true;
  const activeId = activeTargetId(id);
  const retired = activeId !== id;
  id = activeId;
  const target = model.targets.find(t => t.id === id);
  if (!target) { status('원본 목록에 없는 항목입니다.', true); return; }
  current = target;
  if (target.previewOnly) { sampleMode = true; $('data-mode').value = 'sample'; }
  const url = new URL(location.href); url.search = ''; url.searchParams.set('screen', target.screen);
  if (target.popup) url.searchParams.set('popup', target.popup);
  if (sampleMode) url.searchParams.set('data', 'sample');
  if (push) history.pushState(null, '', url);
  else if (retired) history.replaceState(null, '', url);
  renderNav(); openTarget();
}
function renderNav() {
  const rows = navRows(model, current.screen);
  const domainButtons = Object.entries(model.domains).map(([key, d]) => makeButton(`${d.label} ${d.screens.length}`, () => choose(`screen:${d.screens[0]}`), !termsMode && key === rows.domain));
  domainButtons.push(makeButton('용어 사전', () => showTerms(), termsMode));
  $('domains').replaceChildren(...domainButtons);
  if (termsMode) {
    $('screens').replaceChildren(); $('subscreens').replaceChildren(); $('popups').replaceChildren();
    $('breadcrumb').textContent = `용어 사전 · ${terminology?.terms.length ?? 0}개`;
    updateScreenUrl(null);
    return;
  }
  $('screens').replaceChildren(...rows.primary.map(k => makeButton(model.screens[k].label, () => choose(`screen:${k}`), k === rows.primaryActive)));
  $('subscreens').replaceChildren(...rows.sub.map(k => makeButton(
    model.managementGroups?.[k] ? (k === 'fixed_average' ? '현황' : '목록') : model.screens[k].label,
    () => choose(`screen:${k}`),
    k === current.screen,
  )));
  $('popups').replaceChildren(...rows.popups.map(([id, label]) => makeButton(label, () => choose(`popup:${id}@${current.screen}`), id === current.popup)));
  const path = []; let key = current.screen;
  while (key && !path.includes(key)) { path.unshift(key); key = model.parentScreens[key]; }
  $('breadcrumb').textContent = path.map(k => model.screens[k]?.title ?? k).join(' › ') + (current.popup ? ` › ${current.label}` : '') + ` · ${current.id}`;
}
const termMatches = (item, query) => [item.canonical, ...item.variants, item.rule, item.scope].join(' ').toLocaleLowerCase('ko').includes(query.toLocaleLowerCase('ko'));
function renderTerms() {
  if (!terminology) return;
  const applied = new Set(terminology.appliedKeys);
  const isApplied = item => applied.has(`${item.category}::${item.canonical}`);
  const visible = terminology.terms.filter(item => {
    const statusMatch = termView.status === 'all' ? !isApplied(item) : termView.status === 'applied' ? isApplied(item) : !isApplied(item) && item.status === termView.status;
    return statusMatch && (termView.category === 'all' || item.category === termView.category) && termMatches(item, termView.query.trim());
  });
  const summary = [['기준일', terminology.updatedAt], ['전체 개념', `${terminology.terms.length}개`], ['반영완료', `${terminology.appliedKeys.length}개`], ['수정 항목', `${terminology.terms.length - terminology.appliedKeys.length}개`]];
  $('terms-summary').replaceChildren(...summary.map(([label, value]) => { const node = document.createElement('div'); const small = document.createElement('small'); const strong = document.createElement('strong'); small.textContent = label; strong.textContent = value; node.append(small, strong); return node; }));
  const filterButton = (label, active, action) => makeButton(label, action, active);
  $('terms-status-filters').replaceChildren(...Object.entries(termStatusMeta).map(([key, [label]]) => filterButton(label, termView.status === key, () => { termView.status = key; renderTerms(); })));
  $('terms-category-filters').replaceChildren(...[['all', '모든 영역'], ...termCategories.map(value => [value, value])].map(([key, label]) => filterButton(label, termView.category === key, () => { termView.category = key; renderTerms(); })));
  const results = document.createDocumentFragment();
  for (const category of termCategories) {
    const items = visible.filter(item => item.category === category);
    if (!items.length) continue;
    const section = document.createElement('section'); section.className = 'terms-section';
    const heading = document.createElement('div'); heading.className = 'terms-section-heading';
    const h3 = document.createElement('h3'); const count = document.createElement('span'); h3.textContent = category; count.textContent = `${items.length}개 개념`; heading.append(h3, count);
    const grid = document.createElement('div'); grid.className = 'terms-grid';
    for (const item of items) {
      const card = document.createElement('article'); card.className = 'terms-card';
      const head = document.createElement('div'); head.className = 'terms-card-heading';
      const title = document.createElement('strong'); title.textContent = item.canonical;
      const state = document.createElement('span'); state.className = `terms-state ${isApplied(item) ? 'keep' : item.status}`; state.textContent = isApplied(item) ? '반영완료' : termStatusMeta[item.status][0]; head.append(title, state); card.append(head);
      if (item.variants.length) { const variants = document.createElement('div'); variants.className = 'terms-variants'; for (const value of item.variants) { const chip = document.createElement('span'); chip.textContent = value; variants.append(chip); } const arrow = document.createElement('span'); arrow.className = 'terms-arrow'; arrow.textContent = item.status === 'custom' ? '예시 · 치환하지 않음' : `→ ${item.canonical}`; variants.append(arrow); card.append(variants); }
      const rule = document.createElement('p'); rule.textContent = item.rule; const scope = document.createElement('small'); scope.textContent = `적용: ${item.scope}`; card.append(rule, scope); grid.append(card);
    }
    section.append(heading, grid); results.append(section);
  }
  if (!visible.length) { const empty = document.createElement('div'); empty.className = 'terms-empty'; empty.textContent = '조건에 맞는 용어가 없어요.'; results.append(empty); }
  $('terms-results').replaceChildren(results);
}
async function showTerms(push = true) {
  termsMode = true;
  $('screen-toolbar').hidden = true; $('status').hidden = true; $('screen-view').hidden = true; $('terms-view').hidden = false;
  if (push) { const url = new URL(location.href); url.search = ''; url.searchParams.set('terms', '1'); history.pushState(null, '', url); }
  if (!terminology) terminology = await fetch('/appmap/terms.json').then(response => { if (!response.ok) throw Error('용어 사전을 읽지 못했습니다.'); return response.json(); });
  renderNav(); renderTerms(); $('terms-search').value = termView.query; $('terms-search').focus();
}
function entityPicker(kind) {
  $('entity-label').hidden = !kind;
  if (!kind) return;
  $('entity').replaceChildren(...entities[kind].map(row => { const o = document.createElement('option'); o.value = row.id; o.textContent = row.name; return o; }));
  $('entity').value = selected[kind] ?? '';
  $('entity').onchange = () => { selected[kind] = $('entity').value; openTarget(); };
}
function openTarget() {
  const d = destination(current, selected, sampleMode);
  const scenarioTarget = current.sourceTargetId ?? current.id;
  if (sampleMode && /^popup:ingredient_option_(filled|empty)@ingredient_detail$/.test(current.id) && !d.needsEntity) {
    d.manual = false; d.displayKind = 'direct'; d.sampleOptionState = current.popup === 'ingredient_option_empty' ? 'empty' : 'filled';
  }
  generation++; pending = { ...d, generation, targetId: scenarioTarget, samples: new Set(), sampleFailures: new Set(), missingContracts: new Set() }; entityLookup = d.needsEntity ?? null;
  entityPicker(d.kind ?? d.needsEntity);
  $('status').dataset.displayKind = d.displayKind ?? 'loading';
  updateScreenUrl(d.path);
  $('actual-path').textContent = visibleScreenPath(d.path);
  if (!d.path) { frame.src = 'about:blank'; status(d.reason, true); return; }
  const url = new URL(d.path, location.origin); url.searchParams.set('__appmap', '1');
  url.searchParams.set('__appmap_run', String(generation));
  if (sampleMode) { url.searchParams.set('__appmap_sample', '1'); url.searchParams.set('__appmap_target', scenarioTarget); }
  $('sample-banner').hidden = !sampleMode;
  $('sample-banner').textContent = '샘플 미리보기 · 샘플 응답 확인 중. 나머지는 실제 로컬 조회값이며 DB 저장·삭제는 차단됩니다.';
  if (resultOnly(scenarioTarget)) $('sample-banner').textContent += resultNotice;
  status(d.needsEntity ? '기존 Expo 목록에서 실제 데이터를 확인하고 있습니다…' : '실제 Expo 화면을 여는 중…');
  frame.src = url.pathname + url.search;
}
const visible = el => el.getClientRects().length && el.ownerDocument.defaultView.getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"]');
function findAction(doc, step) {
  const candidates = [...doc.querySelectorAll(`[role="${step.role}"]${step.role === 'button' ? ',button' : ''}`)].filter(visible);
  return candidates.filter(el => {
    if (step.inDialog && !el.closest('[role="dialog"],[aria-modal="true"]')) return false;
    if (step.hasText && !el.textContent.trim()) return false;
    if (step.enabledOnly && (el.disabled || el.getAttribute('aria-disabled') === 'true')) return false;
    const name = (el.getAttribute('aria-label') ?? el.textContent).replace(/\s+/g, ' ').trim();
    return step.pattern ? new RegExp(step.name).test(name) : step.prefix ? name.startsWith(step.name) : name === step.name;
  });
}
const delay = ms => new Promise(r => setTimeout(r, ms));
frame.onload = async () => {
  const job = pending;
  if (!job || job.needsEntity || !job.path) return;
  const doc = frame.contentDocument;
  if (!doc) { status('Expo 연결을 확인해 주세요.', true); return; }
  if (sampleMode && (doc.defaultView.__APPMAP_SAMPLE_TARGET__ !== job.targetId || !doc.defaultView.appmapPreview || !doc.defaultView.__APPMAP_BRIDGE_READY__)) {
    pending = null; frame.src = 'about:blank'; status('샘플 미리보기 로딩에 실패해 화면을 중단했습니다. 현재 탭 다시 열기를 눌러 주세요. 샘플 표시 완료가 아닙니다.', true); return;
  }
  let settled = 0;
  for (let n=0; n<80 && generation === job.generation && settled < 3; n++) {
    settled = (doc.body?.innerText ?? '').trim().length > 0
      && !!doc.querySelector('button,[role="button"]')
      && !doc.querySelector('[role="progressbar"]')
      && !doc.defaultView.__APPMAP_PENDING_READS__ ? settled + 1 : 0;
    await delay(200);
  }
  if (generation !== job.generation) return;
  if (settled < 3) { status('Expo 데이터 로딩이 아직 끝나지 않았습니다. 진입 화면을 표시하며 완료로 처리하지 않습니다.', true); return; }
  const opened = []; let countBefore = 0, parentBefore = 0, expandedParent;
  for (const step of job.steps) {
    if (step.optional && !findAction(doc, step).length) continue;
    let match = [];
    for (let n = 0; n < 100 && generation === job.generation; n++) {
      match = findAction(doc, step);
      if (match.length) break;
      await delay(100);
    }
    if (generation !== job.generation) return;
    if (step.first && match.length) match = [match[0]];
    if (match.length !== 1 || match[0].disabled || match[0].getAttribute('aria-disabled') === 'true') {
      const emptyOptions = (doc.body?.innerText ?? '').includes('등록된 구매 옵션이 없어요');
      status(emptyOptions ? '선택한 실제 재료에는 구매 옵션이 없습니다. 위 실제 데이터에서 구매 옵션이 있는 재료를 선택하세요. 편집 팝업이 열린 것으로 처리하지 않습니다.'
        : `현재 실제 데이터/영업 상태에서 '${step.name}' 버튼이 없거나 비활성 또는 여러 개입니다. 진입 화면만 표시하며 팝업이 열린 것으로 처리하지 않습니다.`, true); return;
    }
    opened.push(match[0].getAttribute('aria-label') ?? match[0].textContent.trim());
    if (step.expectIncreaseSelector) countBefore = [...doc.querySelectorAll(step.expectIncreaseSelector)].filter(visible).length;
    if (step.expectParentGrowth) { expandedParent = match[0].parentElement; parentBefore = expandedParent.textContent.length; }
    if (!step.observeOnly && !(step.ensureChecked && match[0].getAttribute('aria-checked') === 'true')) {
      if (step.key === 'ArrowDown' || step.key === 'ArrowUp') {
        match[0].dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', {key: step.key, bubbles: true, cancelable: true}));
      } else match[0].click();
    }
    await delay(150);
  }
  if (generation !== job.generation) return;
  if (job.steps.length) {
    const last = job.steps.at(-1);
    let confirmed = false;
    for (let n = 0; n < 30 && generation === job.generation; n++) {
      confirmed = last.expectParentGrowth ? expandedParent.isConnected && expandedParent.textContent.length > parentBefore
        : last.expectChecked ? findAction(doc, last).some(el => el.getAttribute('aria-checked') === 'true')
        : last.expectPath ? matchesPathCondition(doc.defaultView.location, last)
        : last.expectAction ? findAction(doc, last.expectAction).length > 0
        : last.expectPageText ? (doc.body?.innerText ?? '').includes(last.expectPageText)
          || (!!last.expectPathAlternative && doc.defaultView.location.pathname === last.expectPathAlternative)
        : last.expectIncreaseSelector ? [...doc.querySelectorAll(last.expectIncreaseSelector)].filter(visible).length > countBefore
        : last.expectGone ? findAction(doc, last).length === 0
        : last.expectExpanded ? findAction(doc, last).some(el => el.getAttribute('aria-expanded') === 'true')
        : last.expectSelector ? [...doc.querySelectorAll(last.expectSelector)].some(visible)
        : last.expectTextAny ? [...doc.querySelectorAll('[role="dialog"],[aria-modal="true"]')].some(el => visible(el) && last.expectTextAny.some(text => el.textContent.includes(text)))
        : last.expectText ? [...doc.querySelectorAll('[role="dialog"],[aria-modal="true"]')].some(el => visible(el) && el.textContent.includes(last.expectText)) : last.role === 'tab'
        ? findAction(doc, last).some(el => el.getAttribute('aria-selected') === 'true')
        : [...doc.querySelectorAll('[role="dialog"],[aria-modal="true"]')].some(visible);
      if (confirmed) break;
      await delay(100);
    }
    if (generation !== job.generation) return;
    if (!confirmed) { status('기존 열기 동작은 실행했지만 팝업/탭 표시를 확인하지 못했습니다. 직접 확인이 필요합니다.', true); return; }
    if (last.expectAction) findAction(doc, last.expectAction)[0]?.scrollIntoView({ block: 'center' });
  }
  if (/정보를 불러오지 못했어요|메뉴를 찾을 수 없어요|서버 연결에 실패/.test(doc.body?.innerText ?? '')) {
    status('실제 Expo 화면에서 데이터 조회 오류가 표시되고 있습니다. 정상 연결 완료로 처리하지 않습니다.', true); return;
  }
  if (sampleMode) {
    const expected = doc.defaultView.appmapPreview.expected(job.targetId);
    for (let n=0; n<80 && generation === job.generation && expected.some(rpc => !job.samples.has(rpc)); n++) await delay(100);
    if (generation !== job.generation) return;
    const missing = expected.filter(rpc => !job.samples.has(rpc));
    if (missing.length || job.sampleFailures.size) { status(`샘플 응답을 확인하지 못했습니다 (${[...missing, ...job.sampleFailures].join(', ')}). 아래는 실제 조회값이며 샘플 표시 완료가 아닙니다.`, true); return; }
    $('sample-banner').textContent = `샘플 미리보기 · 샘플 응답 ${job.samples.size}종 적용. 나머지는 실제 로컬 조회값. DB 저장·삭제 차단.`;
    if (resultOnly(job.targetId)) $('sample-banner').textContent += resultNotice;
    if (job.missingContracts.size) $('sample-banner').textContent += ` 서버에서 제공하지 못한 ${[...job.missingContracts].join(', ')}는 예시 응답으로 표시합니다. 서버 기능 완료가 아닙니다.`;
    if (job.sampleOptionState) {
      let ready = false;
      for (let n=0; n<50 && generation === job.generation; n++) {
        const management = findAction(doc, { role: 'button', name: job.sampleOptionState === 'empty' ? '구매 링크 추가' : '구매 링크 자세히 보기' });
        ready = management.length === 1 && (job.sampleOptionState === 'empty'
          ? (doc.body?.innerText ?? '').includes('등록된 구매링크가 없습니다.')
          : findAction(doc, { role: 'button', name: '샘플 구매처 구매 링크 메뉴' }).length > 0);
        if (ready) { management[0].scrollIntoView({ block: 'center' }); break; }
        await delay(100);
      }
      if (generation !== job.generation) return;
      if (!ready) { status('구매 옵션 샘플 응답은 받았으나 해당 상태의 화면 표시를 확인하지 못했습니다.', true); return; }
    }
  }
  status(job.manual ? job.reason : `${job.displayKind === 'alternate' ? '대체 경로·인라인 표시 (원본 팝업 구현 아님)' : job.displayKind === 'scenario' ? '샘플 결과 화면 (실제 처리 아님)' : '실제 Expo 연결'} · ${current.screenId ?? ''} · ${visibleScreenPath(job.path)}${opened.length ? ' · 열기/관측: ' + opened.join(' → ') : ''}${job.note ? ' · ' + job.note : ''}`, job.manual);
};
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'appmap-observation') return;
  const data = event.data;
  if (data.run != null && data.run !== String(pending?.generation)) return;
  if (data.sampleApplied && data.sampleTarget === pending?.targetId) pending.samples.add(data.sampleApplied);
  if (data.missingContract && data.sampleTarget === pending?.targetId) pending.missingContracts.add(data.missingContract);
  if (data.sampleFailure) { pending?.sampleFailures.add(data.sampleFailure); status(`샘플 변환 실패 (${data.sampleFailure}). 실제 조회값을 표시하며 샘플 완료로 처리하지 않습니다.`, true); }
  if (data.writeBlocked) { if (!data.diagnosticOnly) status(`샘플 미리보기에서는 저장·삭제하지 않습니다 (${data.rpc ?? '데이터 변경'}). 변경은 실제 로컬 데이터 모드에서 해 주세요.`, true); return; }
  if (data.dataError === true) status('실제 Expo 화면에서 데이터 조회 오류가 표시되고 있습니다. 정상 연결 완료로 처리하지 않습니다.', true);
  if (typeof data.path === 'string') { const u = new URL(data.path, location.origin); for (const k of [...u.searchParams.keys()]) if (k.startsWith('__appmap')) u.searchParams.delete(k); $('actual-path').textContent = visibleScreenPath(u); updateScreenUrl(u.pathname + u.search); }
  if (['ingredient', 'recipe'].includes(data.kind) && Array.isArray(data.entities)) {
    entities[data.kind] = data.entities.filter(e => typeof e.id === 'string' && /^[a-f0-9-]{36}$/i.test(e.id) && typeof e.name === 'string');
    if (!entities[data.kind].some(e => e.id === selected[data.kind])) selected[data.kind] = (entities[data.kind].find(e => e.name === (data.kind === 'ingredient' ? '대파' : '제육볶음')) ?? entities[data.kind][0])?.id;
    if (entityLookup === data.kind) {
      if (selected[data.kind]) openTarget(); else status('현재 로컬 데이터가 비어 있어 상세 화면을 열 수 없습니다. 기본 Expo에서 데이터를 선택해 주세요.', true);
    }
  }
});
$('counts').textContent = `화면 ${model.counts.screens} · 팝업/상태 ${model.counts.popups} · 총 ${model.counts.total} (숨김 ${model.counts.hidden} 포함)`;
$('inventory').replaceChildren(...model.targets.map(t => makeButton(`${t.hidden ? '[원본 숨김] ' : ''}${model.screens[t.screen].label} / ${t.popup ? t.label : '기본 화면'} · ${t.id}`, () => { $('inventory').parentElement.open = false; choose(t.id); })));
$('reload').onclick = openTarget;
$('data-mode').value = sampleMode ? 'sample' : 'real';
$('data-mode').onchange = () => { sampleMode = $('data-mode').value === 'sample'; choose(current.id); };
$('width').onchange = () => { frame.style.width = `${$('width').value}px`; };
function readLocation() {
  const p = new URL(location.href).searchParams, screen = p.get('screen') ?? Object.values(model.domains)[0].screens[0];
  sampleMode = p.get('data') === 'sample'; $('data-mode').value = sampleMode ? 'sample' : 'real';
  if (p.get('terms') === '1') { current = model.targets.find(target => target.id === `screen:${screen}`) ?? model.targets.find(target => target.id === `screen:${Object.values(model.domains)[0].screens[0]}`); showTerms(false); return; }
  choose(p.has('popup') ? `popup:${p.get('popup')}@${screen}` : `screen:${screen}`, false);
}
window.onpopstate = readLocation;
$('terms-search').oninput = event => { termView.query = event.target.value; renderTerms(); };
readLocation();
