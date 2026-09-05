#!/usr/bin/env node
/**
 * 색 역할 × 표면 대비 게이트 — **앱 게이트**다.
 *
 * 권위 관계 (솔 검수 `F05`)
 *   `tokens.ts`                    앱 정본. 색 역할은 여기서 나온다.
 *   `scripts/design-token-contract.json`   **앱 계약**. 이름·값·조합을 tokens.ts 와 양방향 대조한다.
 *   `…-contrast-contract.json`     프로토타입 쪽 **투영**. 있으면 겹치는 값만 교차 확인한다.
 *   이 스크립트                     앱 게이트. `verify` ③ 에서 매 커밋 돈다.
 *   `…-contrast-gate.mjs`          프로토타입 게이트. 별개이고 로컬 전용이다.
 *
 * 왜 앱 쪽에 있나: 프로토타입 게이트(`design-sync-check.ps1`)는 CI 어디에도 없는 로컬
 * Windows 전용이다. `S1` 부터 색 역할이 `tokens.ts` 에 실재하므로, 표면 색을 한 톤이라도
 * 바꾸는 커밋에서 **그 커밋이 바로** 걸려야 한다.
 *
 * 기준은 저장된 baseline 이 아니라 **절대값** — 4.5:1(글자) · 3:1(비텍스트).
 *
 * ⚠ **반올림 전 원시값으로 판정한다** (솔 검수 `F03`). 소수 둘째 자리로 접은 뒤 비교하면
 *   `4.499888` 이 `4.50` 이 되어 통과한다 — 접근성 게이트가 미달을 통과시키는 경로다.
 *   WCAG 도 임계값 판정 전 반올림을 금한다. 반올림은 **표시할 때만** 한다.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
// 경로를 바꿀 수 있어야 **음성 시험이 저장소에 보존된다**. 시험은 변조한 사본을 만들어
// 이 게이트가 실제로 FAIL 하는지 본다 — 손으로 돌려 본 것은 증거가 아니다 (페이블 차단 2).
// `--키=값` 과 값 없는 `--깃발` 둘 다 받는다. 깃발은 빈 문자열이라 `!== undefined` 로 본다.
const opt = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => (a.includes('=') ? [a.slice(2, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a.slice(2), ''])));
const tokensPath = resolve(opt.tokens ?? resolve(root, 'apps/mobile/src/theme/tokens.ts'));
// 계약은 **앱 쪽**에 둔다. 프로토타입 봉인 파일에 두면 앱 색을 바꿀 때마다 프로토타입
// 봉인이 깨진다 — 잘못된 결속이다. 프로토타입 쪽은 투영으로 남고 겹치는 값만 교차 확인한다.
const contractPath = resolve(opt.contract ?? resolve(root, 'scripts/design-token-contract.json'));
const projectionPath = resolve(opt.projection ?? resolve(root, 'docs/prototypes/full-page-flow-prototype-contrast-contract.json'));
const sealPath = resolve(opt.seal ?? resolve(root, 'scripts/design-token-seal.json'));
const src = readFileSync(tokensPath, 'utf8');

const fail = [];
const note = [];

// --- tokens.ts 에서 값을 읽는다 ------------------------------------------------
const block = (opener) => {
  const i = src.indexOf(opener);
  if (i < 0) return null;
  let depth = 0; const j = src.indexOf('{', i);
  if (j < 0) return null;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) return src.slice(j, k + 1); }
  }
  return null;
};
const sub = (text, key) => (text ? block(text.slice(text.indexOf(key + ':'))) : null);
const pick = (text, key, where) => {
  if (!text) { fail.push(`${where} 블록을 찾지 못했다 — tokens.ts 의 모양이 바뀌었다`); return null; }
  const m = text.match(new RegExp(`(?:^|[^A-Za-z])${key}\\s*:\\s*'(#[0-9A-Fa-f]{3,8})'`));
  if (!m) { fail.push(`${where}.${key} 를 tokens.ts 에서 찾지 못했다`); return null; }
  return m[1].toUpperCase();
};

const tBlock = block('export const T = {');
const colorBlock = block('export const COLOR = {');
const textBlock = sub(colorBlock, 'text');
const actionBlock = sub(colorBlock, 'action');
const brandBlock = sub(colorBlock, 'brand');
const compBlock = block('export const COMPONENT = {');
const tileBlock = sub(compBlock, 'myHubTile');

const surfaces = {
  surface: pick(tBlock, 'surface', 'T'),
  surface2: pick(tBlock, 'surface2', 'T'),
  bg: pick(tBlock, 'bg', 'T'),
};
const blueTint = pick(tBlock, 'blueTint', 'T');
const text = {
  'text.primary': pick(textBlock, 'primary', 'COLOR.text'),
  'text.secondary': pick(textBlock, 'secondary', 'COLOR.text'),
  'text.tertiary': pick(textBlock, 'tertiary', 'COLOR.text'),
  'text.link': pick(textBlock, 'link', 'COLOR.text'),
  'text.linkPressed': pick(textBlock, 'linkPressed', 'COLOR.text'),
  'text.required': pick(textBlock, 'required', 'COLOR.text'),
};
const textDisabled = pick(textBlock, 'disabled', 'COLOR.text');
const action = {
  'action.primary': pick(actionBlock, 'primary', 'COLOR.action'),
  'action.primaryPressed': pick(actionBlock, 'primaryPressed', 'COLOR.action'),
  'action.primaryTint': pick(actionBlock, 'primaryTint', 'COLOR.action'),
  'action.onTint': pick(actionBlock, 'onTint', 'COLOR.action'),
};
const brandPrimary = pick(brandBlock, 'primary', 'COLOR.brand');
// myHubTile.background 는 리터럴이 아니라 COLOR.action.primaryTint 참조다 — 참조면 그 값을 쓴다.
const tileBgRef = tileBlock && /background\s*:\s*COLOR\.action\.primaryTint/.test(tileBlock);
const tile = {
  'myHubTile.background': tileBgRef ? action['action.primaryTint'] : pick(tileBlock, 'background', 'COMPONENT.myHubTile'),
  'myHubTile.icon': pick(tileBlock, 'icon', 'COMPONENT.myHubTile'),
  'myHubTile.label': pick(tileBlock, 'label', 'COMPONENT.myHubTile'),
};
if (tileBgRef) note.push('myHubTile.background 는 COLOR.action.primaryTint 참조다 — 값이 갈릴 수 없다');

// --- WCAG 2.x 대비 · 원시값으로 판정 ---------------------------------------------
const hex = (h) => { const s = h.replace('#', ''); const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s.slice(0, 6);
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16) / 255); };
const lum = (h) => { const [r, g, b] = hex(h).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** 원시 대비값. **반올림하지 않는다** — 판정은 이 값으로 한다. */
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const show = (n) => n.toFixed(2);

const TEXT_MIN = 4.5, NONTEXT_MIN = 3.0, BOUNDARY_HI = 4.55;
const rows = [];
const check = (role, fg, bg, kind, where) => {
  if (!fg || !bg) return;
  const r = ratio(fg, bg);                       // 원시값
  const min = kind === 'text' ? TEXT_MIN : NONTEXT_MIN;
  const pass = r >= min;                         // 원시값으로 판정
  const boundary = kind === 'text' && pass && r <= BOUNDARY_HI;
  rows.push({ role, fg, bg, where, kind, ratio: r, pass, boundary });
  if (!pass) fail.push(`${role} ${fg} on ${bg}(${where}) = ${show(r)} — ${kind === 'text' ? '글자' : '비텍스트'} 기준 ${min} 미달`);
};

for (const [sname, s] of Object.entries(surfaces))
  for (const [role, fg] of Object.entries(text)) check(role, fg, s, 'text', sname);
check('action.primary 위 흰 글자', surfaces.surface, action['action.primary'], 'text', 'action.primary');
check('action.primaryPressed 위 흰 글자', surfaces.surface, action['action.primaryPressed'], 'text', 'action.primaryPressed');
check('action.onTint on primaryTint', action['action.onTint'], action['action.primaryTint'], 'text', 'action.primaryTint');
check('myHubTile.label on background', tile['myHubTile.label'], tile['myHubTile.background'], 'text', 'myHubTile');
check('myHubTile.icon on background', tile['myHubTile.icon'], tile['myHubTile.background'], 'nonText', 'myHubTile');
for (const [sname, s] of Object.entries(surfaces))
  check('action.primary 테두리·아이콘', action['action.primary'], s, 'nonText', sname);

// `text.disabled` 는 WCAG 1.4.3 이 비활성 컴포넌트를 면제한다 — 면제이지 통과가 아니다.
note.push(`면제 — text.disabled ${textDisabled} (WCAG 1.4.3 비활성 컴포넌트)`);

// --- 결정문을 코드에서 지키는 단언 ------------------------------------------------
if (brandPrimary && action['action.primary'] && brandPrimary === action['action.primary'])
  fail.push('brand.primary 와 action.primary 가 같은 값이다 — 결정 2-4 는 둘을 나눴다(로고는 브랜드 식별, 버튼은 접근 가능한 상호작용)');
if (blueTint && action['action.primaryTint'] && blueTint !== action['action.primaryTint'])
  fail.push(`T.blueTint(${blueTint}) 와 action.primaryTint(${action['action.primaryTint']}) 가 다르다 — 결정 2-4 는 tint 를 기존 값 그대로 두기로 했다`);
if (tile['myHubTile.background'] && action['action.primaryTint'] && tile['myHubTile.background'] !== action['action.primaryTint'])
  fail.push('myHubTile.background 와 action.primaryTint 가 다르다 — 결정 8-2 는 tint 를 그대로 쓴다');

// --- 계약 투영과 **양방향** 대조 (솔 검수 F01) --------------------------------------
// 이름이 없으면 "대비만 통과하면 아무 색이나 되는" 구멍이 생긴다 —
// `action.primaryPressed` 를 AA 통과하는 다른 색으로 바꿔도 예전 게이트는 통과시켰다.
// 그래서 **고정 역할 전부**를 이름→값으로 대조하고, 조합도 정규화 집합으로 양방향 비교한다.
const roles = {
  ...text,
  'text.disabled': textDisabled,
  ...action,
  'brand.primary': brandPrimary,
  ...tile,
};
const key = (c) => `${c.역할 ?? c.role}|${(c.fg ?? '').toUpperCase()}|${(c.bg ?? '').toUpperCase()}|${c.kind}`;
const mine = new Set(rows.map(key));

if (!existsSync(contractPath)) {
  // 기본 `verify` 에서는 **FAIL** 이다 (솔 F01) — 계약 투영이 사라졌는데 조용히 통과하면
  // 대조가 없어진 줄 아무도 모른다. docs/prototypes 가 다르게 정리된 브랜치에서만
  // `--allow-missing-contract` 로 명시적으로 면제한다.
  if (opt['allow-missing-contract'] !== undefined) note.push('계약 투영이 없다 — 명시 면제(--allow-missing-contract). tokens.ts 기준 판정은 그대로 돈다');
  else fail.push(`계약 투영을 찾을 수 없다: ${contractPath} — 대조 없이 통과시키지 않는다. 의도한 것이면 --allow-missing-contract 를 명시하라`);
} else {
  const C = JSON.parse(readFileSync(contractPath, 'utf8'));
  const cRoles = C.roles ?? {};
  if (!Object.keys(cRoles).length) fail.push('계약 투영에 roles 표가 없다 — 이름 대조를 할 수 없다');
  // 이름 집합 양방향
  for (const k of Object.keys(roles)) if (!(k in cRoles)) fail.push(`${k} 가 계약 투영의 roles 에 없다`);
  for (const k of Object.keys(cRoles)) if (!(k in roles)) fail.push(`계약 투영의 ${k} 를 게이트가 읽지 않는다 — 낡은 이름이거나 빠진 검사다`);
  // 값 대조
  for (const k of Object.keys(roles)) {
    if (!(k in cRoles)) continue;
    const a = roles[k], b = cRoles[k];
    if (a && b && a.toUpperCase() !== b.toUpperCase()) fail.push(`${k} 가 tokens.ts(${a}) 와 계약 투영(${b}) 에서 다르다`);
  }
  // 표면도 이름으로
  for (const [k, v] of Object.entries(surfaces)) {
    const b = C.surfaces?.[k];
    if (!b) fail.push(`표면 ${k} 가 계약 투영에 없다`);
    else if (v && v.toUpperCase() !== b.toUpperCase()) fail.push(`표면 ${k} 가 tokens.ts(${v}) 와 계약 투영(${b}) 에서 다르다`);
  }
  for (const k of Object.keys(C.surfaces ?? {})) if (!(k in surfaces)) fail.push(`계약 투영의 표면 ${k} 를 게이트가 읽지 않는다`);
  // 조합 집합 양방향
  const theirs = new Set((C.combos ?? []).map(key));
  if (!theirs.size) fail.push('계약 투영에 combos 집합이 없다 — 조합 대조를 할 수 없다');
  for (const k of mine) if (!theirs.has(k)) fail.push(`게이트가 재는 조합이 계약 투영에 없다 — ${k}`);
  for (const k of theirs) if (!mine.has(k)) fail.push(`계약 투영의 조합을 게이트가 재지 않는다 — ${k}`);
}

// --- 프로토타입 투영 교차 확인 (있을 때만) -----------------------------------------
// 프로토타입 계약은 봉인돼 있어 앱과 갱신 주기가 다르다. 겹치는 값이 갈리면 알려만 준다 —
// 앱 게이트를 프로토타입 봉인에 묶지 않는다.
if (existsSync(projectionPath)) {
  const P = JSON.parse(readFileSync(projectionPath, 'utf8'));
  const drift = [];
  for (const [k, v] of Object.entries(surfaces)) {
    const b = P.surfaces?.[k];
    if (b && v && b.toUpperCase() !== v.toUpperCase()) drift.push(`표면 ${k} 앱 ${v} ≠ 프로토타입 ${b}`);
  }
  for (const [k, v] of Object.entries(text)) {
    const b = P.text?.[k];
    if (b && v && b.toUpperCase() !== v.toUpperCase()) drift.push(`${k} 앱 ${v} ≠ 프로토타입 ${b}`);
  }
  if (drift.length) fail.push(`앱과 프로토타입 투영이 갈렸다 — ${drift.join(' · ')}. 프로토타입 쪽을 새 DS 로 맞춰라`);
  else note.push('프로토타입 투영과 겹치는 값이 일치한다');
} else note.push('프로토타입 투영이 없다 — 교차 확인 생략');

// --- 봉인 (솔 검수 `R3 F03`) --------------------------------------------------
// 계약을 앱 쪽에 둔 것은 맞지만, 그것만으로는 **토큰과 계약을 같이 고치면 조용히 통과한다.**
// 위 대조는 둘이 서로 같은지만 보기 때문이다. 그래서 셋을 한 장에 묶어 봉인한다 —
//   ① 색 역할의 이름→값 사전(토큰에서 뽑은 값)
//   ② 계약 파일 그대로
//   ③ 결정문 §8.2 계열 구간(소유자 결정이 적힌 곳) 과 그 커밋
// 셋 중 하나라도 바뀌면 FAIL 이다. **승인된 변경에서만 봉인을 갱신한다** — 봉인 갱신이
// 곧 "소유자가 이 값을 승인했다" 는 기록이다.
const sha = (t) => createHash('sha256').update(t.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
/** 봉인 대상 색 사전 — 표면과 역할을 한 이름 공간에 모아 키로 정렬한다. */
const sealedRoles = () => {
  const all = {};
  for (const [k, v] of Object.entries(surfaces)) all[`surface.${k}`] = (v ?? '').toUpperCase();
  for (const [k, v] of Object.entries(roles)) all[k] = (v ?? '').toUpperCase();
  return JSON.stringify(Object.fromEntries(Object.keys(all).sort().map(k => [k, all[k]])));
};
/**
 * 결정문에서 §8.2 계열 구간만 잘라 낸다 — 산문이 바뀌었다고 게이트가 울면 아무도 안 고친다.
 *
 * ⚠ 초판은 "다음 `##` 까지" 로 잘랐다. 그런데 §8.2c 다음이 **같은 깊이의 `### 8.3`**(열린 결정)
 *   이라 §8.3 산문까지 봉인에 들어갔다 — 열린 결정을 다듬을 때마다 **색 결정 봉인**을 갱신해야
 *   하는 모순이다 (솔 검수 `R4 F03`). 이제 `8.2` · `8.2a` … 가 아닌 `###` 에서도 끊는다.
 *   `### 8.2d` 가 새로 붙으면 구간에 들어가므로 새 결정이 조용히 들어올 길은 여전히 없다.
 */
const IS_8_2 = /^###\s+8\.2[a-z]?(\s|$)/;
const decisionSlice = (text) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const from = lines.findIndex(l => IS_8_2.test(l));
  if (from < 0) return null;
  let to = lines.length;
  for (let i = from + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,2}\s/.test(l)) { to = i; break; }              // 상위 헤딩
    if (/^###\s/.test(l) && !IS_8_2.test(l)) { to = i; break; } // 같은 깊이의 다른 절
  }
  return lines.slice(from, to).join('\n').trimEnd();
};
const DEC_DEFAULT = 'docs/디자인-토큰-3계층-값-매핑-기획서.md';
// 봉인을 갱신할 때 손으로 sha256 을 뜨게 만들면 아무도 안 한다. **값만 찍어 준다** —
// 결정 커밋과 사유는 사람이 적는다. 그게 "승인" 의 자리다.
if (opt['print-seal'] !== undefined) {
  const decP = resolve(opt.decision ?? resolve(root, DEC_DEFAULT));
  const slice = existsSync(decP) ? decisionSlice(readFileSync(decP, 'utf8')) : null;
  console.log(JSON.stringify({
    봉인: {
      역할해시: sha(sealedRoles()),
      계약해시: existsSync(contractPath) ? sha(readFileSync(contractPath, 'utf8')) : null,
      결정해시: slice === null ? null : sha(slice),
    },
    결정: { 문서: opt.decision ? opt.decision : DEC_DEFAULT, 커밋: ['<결정이 담긴 커밋 SHA 를 손으로 적어라>'] },
  }, null, 2));
  process.exit(0);
}
if (!existsSync(sealPath)) {
  if (opt['allow-missing-seal'] !== undefined) note.push('봉인이 없다 — 명시 면제(--allow-missing-seal)');
  else fail.push(`봉인을 찾을 수 없다: ${sealPath} — 봉인 없이 통과시키지 않는다. 의도한 것이면 --allow-missing-seal 을 명시하라`);
} else {
  const S = JSON.parse(readFileSync(sealPath, 'utf8'));
  const want = S.봉인 ?? {};
  const got역할 = sha(sealedRoles());
  if (!want.역할해시) fail.push('봉인에 역할해시가 없다 — 토큰과 계약을 함께 고쳐도 막지 못한다');
  else if (want.역할해시 !== got역할)
    fail.push(`색 역할 값이 봉인과 다르다 — 봉인 ${want.역할해시.slice(0, 12)} · 지금 ${got역할.slice(0, 12)}. 소유자가 승인한 변경이면 봉인을 갱신하라(결정문 갱신 포함), 아니면 값을 되돌려라`);

  if (existsSync(contractPath)) {
    const got계약 = sha(readFileSync(contractPath, 'utf8'));
    if (!want.계약해시) fail.push('봉인에 계약해시가 없다');
    else if (want.계약해시 !== got계약)
      fail.push(`계약 파일이 봉인과 다르다 — 봉인 ${want.계약해시.slice(0, 12)} · 지금 ${got계약.slice(0, 12)}. 승인된 변경이면 봉인을 갱신하라`);
  }

  const decPath = resolve(opt.decision ?? resolve(root, S.결정?.문서 ?? ''));
  if (!S.결정?.문서) fail.push('봉인이 어떤 결정문을 가리키는지 적혀 있지 않다');
  else if (!existsSync(decPath)) fail.push(`봉인이 가리키는 결정문이 없다: ${decPath}`);
  else {
    const slice = decisionSlice(readFileSync(decPath, 'utf8'));
    if (slice === null) fail.push(`결정문에서 §8.2 구간을 찾지 못했다: ${decPath} — 봉인 대상이 사라졌다`);
    else {
      const got결정 = sha(slice);
      if (!want.결정해시) fail.push('봉인에 결정해시가 없다 — 값만 묶고 근거를 안 묶으면 반쪽이다');
      else if (want.결정해시 !== got결정)
        fail.push(`결정문 §8.2 구간이 봉인과 다르다 — 봉인 ${want.결정해시.slice(0, 12)} · 지금 ${got결정.slice(0, 12)}. 결정이 바뀐 것이면 봉인을 갱신하고 커밋도 함께 적어라`);
      else {
        // 결정 커밋은 **추적용**이다. 봉인을 지키는 것은 위 세 해시고, 커밋은 "이 값이 어디서
        // 결정됐는지" 를 가리킨다. 결정이 여러 번에 걸쳐 닫혔으므로 목록이다.
        // 결정 커밋은 추적용이다. 봉인을 지키는 것은 위 세 해시고, 커밋은 "이 값이 어디서
        // 결정됐는지" 를 가리킨다. **형식과 존재를 검사한다** — 초판은 비어 있지 않은지만 봐서
        // "이 커밋" 같은 자기참조 문장도 통과했다 (솔 검수 `R4 F03`).
        const commits = [].concat(S.결정?.커밋 ?? []).filter(Boolean);
        if (!commits.length) fail.push('봉인에 결정 커밋이 없다 — 어느 커밋의 결정인지 추적할 수 없다');
        else {
          // 존재만 보면 **아무 커밋이나 통과한다** (솔 검수 `R5 F01`). 셋을 본다 —
          //   ① 그 개체가 커밋인가
          //   ② 지금 HEAD 의 **조상**인가 (다른 가지의 커밋을 출처로 댈 수 없다)
          //   ③ 그 커밋이 **결정문 파일을 실제로 바꿨는가** (관련 없는 커밋을 댈 수 없다)
          // 봉인 해시는 변조를 잡고, 이 셋이 "누가 어느 결정으로 갱신했는가" 를 잡는다.
          const decRel = S.결정?.문서;
          for (const c of commits) {
            const m = String(c).match(/^([0-9a-f]{40})(\s|$)/);
            if (!m) { fail.push(`결정 커밋 항목이 40자리 SHA 로 시작하지 않는다 — '${String(c).slice(0, 48)}'`); continue; }
            const sha40 = m[1];
            const g = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
            if (g(['cat-file', '-e', `${sha40}^{commit}`]).status !== 0) {
              fail.push(`결정 커밋 ${sha40.slice(0, 12)} 개체가 저장소에 없다 — 손으로 적은 SHA 가 틀렸다`);
              continue;
            }
            if (g(['merge-base', '--is-ancestor', sha40, 'HEAD']).status !== 0)
              fail.push(`결정 커밋 ${sha40.slice(0, 12)} 이 HEAD 의 조상이 아니다 — 이 가지에 없는 커밋을 출처로 댈 수 없다`);
            const touched = g(['-c', 'core.quotepath=false', 'show', '--pretty=format:', '--name-only', sha40]);
            if (touched.status !== 0 || !String(touched.stdout).split(/\r?\n/).some(l => l.trim() === decRel))
              fail.push(`결정 커밋 ${sha40.slice(0, 12)} 이 결정문(${decRel})을 바꾸지 않았다 — 관련 없는 커밋을 출처로 댈 수 없다`);
          }
          if (!fail.length) note.push(`봉인 일치 — 역할 ${got역할.slice(0, 8)} · 계약 ${(want.계약해시 ?? '').slice(0, 8)} · 결정 커밋 ${commits.length}건 확인`);
        }
      }
    }
  }
}

// --- 별칭 래칫 (페이블 조건) ------------------------------------------------------
// `cardShadow` 는 `shadow.card` 의 호환 별칭이다. `S1` 은 선언만 하는 단계라 호출부를
// 건드리지 않지만, **사용처가 늘어나면 안 된다** — 새 화면이 별칭을 새로 쓰면 치환이
// 끝나지 않는다. `S3a` 완료 조건은 "사용처 0 → 별칭 삭제" 이므로 이 수는 줄기만 해야 한다.
const ALIAS_BASELINE = Number(opt['alias-baseline'] ?? 2);   // kit/index.tsx:58(Card) · kit/index.tsx:302(세그먼트 선택)
{
  const appSrc = resolve(opt.app ?? resolve(root, 'apps/mobile/src'));
  const hits = [];
  if (existsSync(appSrc)) {
    (function walk(d) {
      for (const e of readdirSync(d)) {
        if (e === 'node_modules') continue;
        const q = join(d, e);
        if (statSync(q).isDirectory()) walk(q);
        else if (/\.tsx?$/.test(q) && !q.endsWith(join('theme', 'tokens.ts'))) {
          const lines = readFileSync(q, 'utf8').split(/\r?\n/);
          lines.forEach((ln, i) => {
            if (!/\bcardShadow\b/.test(ln)) return;
            if (/^\s*(\*|\/\/)/.test(ln)) return;              // 주석은 사용처가 아니다
            if (/^\s*import\b/.test(ln)) return;                // import 도 아니다
            hits.push(`${q.slice(root.length).replace(/\\/g, '/')}:${i + 1}`);
          });
        }
      }
    })(appSrc);
  }
  if (hits.length > ALIAS_BASELINE)
    fail.push(`cardShadow 별칭 사용처가 ${hits.length}곳으로 늘었다(기준 ${ALIAS_BASELINE}) — 새 화면은 shadow.card 를 쓴다: ${hits.join(' · ')}`);
  else if (hits.length < ALIAS_BASELINE)
    fail.push(`cardShadow 별칭 사용처가 ${hits.length}곳으로 줄었다(기준 ${ALIAS_BASELINE}) — 치환했으면 ALIAS_BASELINE 을 함께 낮춰라. 0 이면 별칭을 삭제한다(S3a 완료 조건)`);
  else note.push(`cardShadow 별칭 사용처 ${hits.length}곳 — 기준과 같다 (S3a 에서 0 으로 만들고 별칭 삭제)`);
}

// --- 보고 ---------------------------------------------------------------------
const boundaries = rows.filter(r => r.boundary);
console.log(`색 역할 대비 — ${rows.length}쌍 · 경계값 ${boundaries.length} (판정은 반올림 전 원시값)`);
for (const b of boundaries) console.log(`  경계 ${show(b.ratio)}  ${b.role} ${b.fg} on ${b.bg} (${b.where})`);
for (const n of note) console.log(`  ${n}`);
if (fail.length) {
  console.error('\n색 대비 게이트 FAIL');
  for (const f of fail) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('색 대비 게이트 PASS');
