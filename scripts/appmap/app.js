import { destination, navRows, adapterKeys, limitationEntries } from './navigation.mjs';
const $ = id => document.getElementById(id);
const model = await fetch('/appmap/model.json').then(r => { if (!r.ok) throw Error('탭 목록을 읽지 못했습니다.'); return r.json(); });
const frame = $('expo');
const entities = { ingredient: [], recipe: [] }, selected = {};
let current, generation = 0, pending, entityLookup = null;
function status(text, warning = false) { $('status').textContent = text; $('status').dataset.warning = String(warning); }
function makeButton(text, action, active = false) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
  b.setAttribute('aria-current', String(active)); b.onclick = action; return b;
}
function choose(id, push = true) {
  const target = model.targets.find(t => t.id === id);
  if (!target) { status('원본 목록에 없는 항목입니다.', true); return; }
  current = target;
  const url = new URL(location.href); url.search = ''; url.searchParams.set('screen', target.screen);
  if (target.popup) url.searchParams.set('popup', target.popup);
  if (push) history.pushState(null, '', url);
  renderNav(); openTarget();
}
function renderNav() {
  const rows = navRows(model, current.screen);
  $('domains').replaceChildren(...Object.entries(model.domains).map(([key, d]) => makeButton(`${d.label} ${d.screens.length}`, () => choose(`screen:${d.screens[0]}`), key === rows.domain)));
  $('screens').replaceChildren(...rows.primary.map(k => makeButton(model.screens[k].label, () => choose(`screen:${k}`), k === rows.primaryActive)));
  $('subscreens').replaceChildren(...rows.sub.map(k => makeButton(model.screens[k].label, () => choose(`screen:${k}`), k === current.screen)));
  $('popups').replaceChildren(...rows.popups.map(([id, label]) => makeButton(label, () => choose(`popup:${id}@${current.screen}`), id === current.popup)));
  const path = []; let key = current.screen;
  while (key && !path.includes(key)) { path.unshift(key); key = model.parentScreens[key]; }
  $('breadcrumb').textContent = path.map(k => model.screens[k]?.title ?? k).join(' › ') + (current.popup ? ` › ${current.label}` : '') + ` · ${current.id}`;
}
function entityPicker(kind) {
  $('entity-label').hidden = !kind;
  if (!kind) return;
  $('entity').replaceChildren(...entities[kind].map(row => { const o = document.createElement('option'); o.value = row.id; o.textContent = row.name; return o; }));
  $('entity').value = selected[kind] ?? '';
  $('entity').onchange = () => { selected[kind] = $('entity').value; openTarget(); };
}
function openTarget() {
  const d = destination(current, selected);
  generation++; pending = { ...d, generation }; entityLookup = d.needsEntity ?? null;
  entityPicker(d.kind ?? d.needsEntity);
  if (!d.path) { frame.src = 'about:blank'; status(d.reason, true); return; }
  const url = new URL(d.path, location.origin); url.searchParams.set('__appmap', '1');
  status(d.needsEntity ? '기존 Expo 목록에서 실제 데이터를 확인하고 있습니다…' : '실제 Expo 화면을 여는 중…');
  frame.src = url.pathname + url.search;
}
const visible = el => el.getClientRects().length && el.ownerDocument.defaultView.getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"]');
function findAction(doc, step) {
  const candidates = [...doc.querySelectorAll(`[role="${step.role}"]${step.role === 'button' ? ',button' : ''}`)].filter(visible);
  return candidates.filter(el => {
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
  const opened = []; let countBefore = 0;
  for (const step of job.steps) {
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
      status(emptyOptions ? '선택한 실제 식재료에는 구매 옵션이 없습니다. 위 실제 데이터에서 구매 옵션이 있는 식재료를 선택하세요. 편집 팝업이 열린 것으로 처리하지 않습니다.'
        : `현재 실제 데이터/영업 상태에서 '${step.name}' 버튼이 없거나 비활성 또는 여러 개입니다. 진입 화면만 표시하며 팝업이 열린 것으로 처리하지 않습니다.`, true); return;
    }
    opened.push(match[0].getAttribute('aria-label') ?? match[0].textContent.trim());
    if (step.expectIncreaseSelector) countBefore = [...doc.querySelectorAll(step.expectIncreaseSelector)].filter(visible).length;
    if (!(step.ensureChecked && match[0].getAttribute('aria-checked') === 'true')) match[0].click();
    await delay(150);
  }
  if (generation !== job.generation) return;
  if (job.steps.length) {
    const last = job.steps.at(-1);
    let confirmed = false;
    for (let n = 0; n < 30 && generation === job.generation; n++) {
      confirmed = last.expectIncreaseSelector ? [...doc.querySelectorAll(last.expectIncreaseSelector)].filter(visible).length > countBefore
        : last.expectGone ? findAction(doc, last).length === 0
        : last.expectExpanded ? findAction(doc, last).some(el => el.getAttribute('aria-expanded') === 'true')
        : last.expectSelector ? [...doc.querySelectorAll(last.expectSelector)].some(visible)
        : last.expectText ? [...doc.querySelectorAll('[role="dialog"],[aria-modal="true"]')].some(el => visible(el) && el.textContent.includes(last.expectText)) : last.role === 'tab'
        ? findAction(doc, last).some(el => el.getAttribute('aria-selected') === 'true')
        : [...doc.querySelectorAll('[role="dialog"],[aria-modal="true"]')].some(visible);
      if (confirmed) break;
      await delay(100);
    }
    if (generation !== job.generation) return;
    if (!confirmed) { status('기존 열기 동작은 실행했지만 팝업/탭 표시를 확인하지 못했습니다. 직접 확인이 필요합니다.', true); return; }
  }
  if (/정보를 불러오지 못했어요|메뉴를 찾을 수 없어요|서버 연결에 실패/.test(doc.body?.innerText ?? '')) {
    status('실제 Expo 화면에서 데이터 조회 오류가 표시되고 있습니다. 정상 연결 완료로 처리하지 않습니다.', true); return;
  }
  status(job.manual ? job.reason : `실제 Expo 연결 · ${current.screenId ?? ''} · ${job.path}${opened.length ? ' · 열기: ' + opened.join(' → ') : ''}`, job.manual);
};
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'appmap-observation') return;
  const data = event.data;
  if (data.dataError === true) status('실제 Expo 화면에서 데이터 조회 오류가 표시되고 있습니다. 정상 연결 완료로 처리하지 않습니다.', true);
  if (typeof data.path === 'string') $('actual-path').textContent = data.path.replace(/([?&])__appmap=1&?/, '$1').replace(/[?&]$/, '');
  if (['ingredient', 'recipe'].includes(data.kind) && Array.isArray(data.entities)) {
    entities[data.kind] = data.entities.filter(e => typeof e.id === 'string' && /^[a-f0-9-]{36}$/i.test(e.id) && typeof e.name === 'string');
    if (!entities[data.kind].some(e => e.id === selected[data.kind])) selected[data.kind] = (entities[data.kind].find(e => e.name === (data.kind === 'ingredient' ? '대파' : '제육볶음')) ?? entities[data.kind][0])?.id;
    if (entityLookup === data.kind) {
      if (selected[data.kind]) openTarget(); else status('현재 로컬 데이터가 비어 있어 상세 화면을 열 수 없습니다. 기본 Expo에서 데이터를 선택해 주세요.', true);
    }
  }
});
$('counts').textContent = `화면 ${model.counts.screens} · 팝업/상태 ${model.counts.popups} · 총 ${model.counts.total} (숨김 ${model.counts.hidden} 포함)`;
const directIds = new Set(adapterKeys());
const limitedIds = new Set(limitationEntries().map(x => x.id));
$('connection-counts').textContent = `팝업/상태: 직통 열기 설정 ${directIds.size} · 기존 Expo 제약 ${limitedIds.size}. 직통도 실제 데이터가 있어야 표시됩니다.`;
$('inventory').replaceChildren(...model.targets.map(t => makeButton(`${t.hidden ? '[원본 숨김] ' : ''}${model.screens[t.screen].label} / ${t.popup ? t.label : '기본 화면'} · ${t.id}`, () => { $('inventory').parentElement.open = false; choose(t.id); })));
$('reload').onclick = openTarget;
$('width').onchange = () => { frame.style.width = `${$('width').value}px`; };
function readLocation() {
  const p = new URL(location.href).searchParams, screen = p.get('screen') ?? Object.values(model.domains)[0].screens[0];
  choose(p.has('popup') ? `popup:${p.get('popup')}@${screen}` : `screen:${screen}`, false);
}
window.onpopstate = readLocation;
readLocation();
