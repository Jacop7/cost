# LINKED-CHANGE 검수 R9 — 0224~0226 마지막 수정분·R8-1 해소 여부 (Claude/Fable, 읽기 전용)

- 작성: 2026-09-12 · 검수자: Claude (Fable 5.1) · 방식: Windows MCP PowerShell 읽기 전용
- 대상 HEAD: `d33b3fa0aca0b76edbe426684a5668e76f156f23` (작업 트리 미커밋). 개발 DB 0214 유지, 0215~0226 은 fresh DB 에만. 전체 verify 실행 중 → **완결을 전제하지 않는다**. "확인" 은 파일·로그 대조, "추정" 은 미실행 추론.
- 제약: 소스/DB/Git/설정 변경 없음, 시험 실행 없음. R1~R8 원문 보존, 본 문서 1개만 신규.
- 입력 지문(sha256 앞 16): 0224 promoted_tax_override_carry 778 B · 17:37:04 · `624c590928a71abe` · 0225 pplicable_tax_change_scope 3347 B · 17:44:24 · `727289c44ee3e650` · 0226 ixed_month_trend_scope 459 B · 17:44:24 · `9b55ac05d9e36418` · tests/78 `c63d63462cae88de`(4,617 B · 17:44:50) · 83 `4895ee6cae8c2257`(4,443 B) · 84 `e76cbd5e00270660`(6,173 B · 17:44:50).
- 로그(확인): `future-carry-final.log` 83 ok 6 / FAIL 0 · `nonapplicable-before.log` 84 **FAIL**(첫 실패 "같은 과세 상태의 상속 전환은 직접 정보성 이력·대기 없음", ok 3) · `nonapplicable-after.log` 84 ok 28 / FAIL 0 · `fixed-month-before.log` 78 **FAIL**("다른 월 최초 저장도 현재 메뉴 손익 추이 생성 없음", ok 5) · `fixed-month-after.log` 78 ok 26 / FAIL 0. 수정 전 반례 실패 → 수정 후 통과가 로그로 남아 있다.
- 대조: 0215/0219/0222 원문, 0214 이전 백업 dump 의 `recipe_tax_quote_for_price`(quote components 가 `kind`·`applies_to_treatments` 를 포함, L~8690) 와 `e4_fixed_cost_saved`(L4244–4247 주석·`v_day := least(월말, 오늘)`).

## 1. 결론 요약

- **R8-1 해소(확인)**. 0225 는 (1) 규칙 라벨을 `before_rules/after_rules` 로 분리해 0219 가 덮어쓰던 `tax_components` 를 메뉴 적용 구성 라벨로 되돌리고, (2) 비교 전에 `rules`·`components` 를 메뉴 treatment 로 필터해(primary→taxable, additional→applies_to_treatments) 적용 대상이 없는 메뉴는 `a=b` 로 사건 자체가 없으며, (3) `affects := monetary or treatment/price_basis distinct or 재무규칙(key·name·sort 제거) distinct` 로 상속 전환·표시성 변경은 affects=false 정보성 사건이 된다. tests/84 가 R8-1 재현 A(면세+요율, 면세+납부주체) 와 B(같은 과세 상속 전환) 를 4상태에서 단언하고, 수정 전 로그가 B 에서 실패했다.
- 0224(미래 예약 승격 시 carry 상한을 `greatest(p_date, 프로필 시작일)` 로) 적절. tests/83 이 공개 writer 로 D+2 예약을 만들고 합성 종료일만 지워 승격을 재현, 두 경로(프로필 단독·원자) 6단언 통과.
- 0226(e4 추이를 당월에만) 은 미래월 가짜 추이를 없애지만 **과거월 정정의 월말 back-dated 점도 함께 없앤다** — e4 주석이 의도한 동작이라 정책 확인이 필요(P3, §3).
- 신규 P1/P2 없음.

## 2. 항목별 검토

### 2.1 0225 (확인 + 추정)
- 앵커 4개(`if a is null or b is null or a=b then continue;`, `material:=…`, `if a->'rules' is distinct … and changes='[]'`, `changes,true,null,corr,`) 는 0215 본문에 1회씩 존재(0215 L28/36/46/56). `monetary boolean;` 선언 확장, 0219 의 `before_label:=…/after_label:=…` 는 `before_rules/after_rules` 로 이름만 바뀌어 0215 L30–35 의 구성 라벨이 보존된다.
- 순서(추정, 함수 본문 재구성): 필터 → `a=b` continue → monetary → 구성 라벨 → 규칙 라벨(0219) → affects(0225) → material/ext/fixed → changes 5종(0215)+`tax_inheritance`(0222) → `tax_rules` 라인(0225) → generic fallback(라벨까지 같을 때만: key-only) → `record_entity_change(..., affects, ...)` → `monetary and active` 면 recompute. 변수는 사용 전에 모두 대입된다.
- 필터 함수: `p_treatment null`(프로필 없음) 이면 전부 통과, `applies_to_treatments` 없는 항목 통과, primary 는 taxable 에만, additional 은 배열 포함 검사. quote components 는 `kind`·`applies_to_treatments` 를 갖고 있어(dump) 0원 비적용 항목이 제거된다. 재무규칙은 `key/name/sort_order` 를 뺀 뒤 정렬해 순서 무관 비교.
- 회귀 확인(추정): tests/75 "배달 납부 주체만 변경" 은 과세 메뉴에서 재무규칙(remittance) 차이로 affects=true·`tax_rules` 라인 → n+3 유지. "같은 세금 재저장 무사건" 은 필터 후 `a=b`. tests/82 의 기본값 변경·분류 삭제 단언은 treatment 차이라 그대로 성립.
- ACL: 두 immutable helper 는 executor 전용, propagate 는 postgres 소유 definer 에서 호출.

### 2.2 0224 (확인)
- `tax_override_carry` 를 `o.effective_from <= greatest(p_date, p.effective_from)` 로 재정의. 승격(합성 종료일 삭제 → `next_unopened` 가 앞당겨짐) 시 새 `v_effective`(D) 가 기존 예약 override 의 `effective_from`(D+2) 보다 앞서도 프로필 시작일(D+2) 까지 읽는다. capture 시점은 0215/0217 대로 프로필 삭제·마감 전(`v_effective` 직후) 이라 삭제 cascade 전에 잡힌다. 복원은 0222 그대로(새 유효일 D, revision·inherit·category 보존; tests/83 L37–42).
- 잔여(P4): 프로필 시작일보다 **뒤에** 저장된 override 가 승격으로 `p_date` 아래로 떨어지는 경우(예약 프로필 시작 후 다시 미래 종료일이 생겼다가 지워지는 합성 시나리오) 는 여전히 제외된다. 공개 writer 로는 만들 수 없는 상태라 기록만.

### 2.3 0226 + tests/78 (확인 + 추정)
- 앵커 `if p_prev_rate is null or p_prev_rate is distinct from v_rate then`(0211 L75 산출문) 1회, `p_month=public.store_local_month(p_store) and (...)` 로 교체. tests/78 L41–44 "다른 월 최초 저장(2040-01)" 추이 불변 단언이 수정 전 실패·후 통과.
- e4 의 `v_day := least(월말, 오늘)` 는 미래월엔 오늘(가짜 점), **과거월엔 그 달 말일**(dump L4244–4247 주석: "과거 월을 수정했는데 오늘 날짜로 점을 찍으면 그 달의 추이가 아니라 오늘 추이가 된다") 을 뜻한다. 0226 의 `=` 조건은 둘 다 막는다.

## 3. 발견 사항

### R9-1 · P3 (추정) · 0226 이 과거월 정정의 back-dated 추이 점까지 제거
- 위치: 0226 L8. 재현: 종료 상태 매장에서 지난달 `save_fixed_costs` 로 률이 바뀌는 정정(총매출 또는 항목 금액 변경). 0226 이전: e4 가 `recompute_recipe(rec,'fixed', 지난달 말일)` 로 각 활성 메뉴에 그 달 말일 점 추가(원장 `profit_trends` 의 과거 구간이 정정을 반영). 0226 이후: 점 없음. 0218 도 당월만 메뉴 사건을 남기므로 과거월 정정은 `store_configuration_changes`·`monthly_pl` 외에 메뉴 손익 흔적이 사라진다.
- 판단: R8 P4-3 의 지적은 "미래월 첫 저장" 이었고, 과거월 back-dated 점은 e4 가 의도한 설계다. 새 영업 기준(0206) 아래서 과거 점을 계속 찍을지는 정책 사항이나, 조용히 사라지는 것은 R8 요청 범위를 넘는다. 기존 시험(17/24/28) 은 당월만 다뤄 전체 verify 로도 잡히지 않는다(grep 확인).
- 최소 수정(안): 조건을 `p_month <= public.store_local_month(p_store)`(미래월만 제외) 로 두거나, 과거월 점 제거를 계약으로 명시하고 tests/78 에 "과거월 정정 → 추이 없음(또는 말일 점 1개)" 를 단언.

### R9-2 · P4 · generic `tax_rules` fallback 의 잔존 경로
- 0225 후에도 `if a->'rules' distinct and changes='[]'` 는 라벨이 같은 key-only 변경에서 "이전 설정 → 변경한 설정" 을 남긴다(affects=false). 정보성이라 무해하나, key 는 화면에 안 보이는 값이라 이력 노이즈다. 0225 의 재무규칙 비교처럼 key 를 라벨 비교에서도 무시하면 사건 자체가 없어진다. R7-2 의 ROOT 판단(이름/순서 보존) 과는 독립.

### R9-3 · P4 · 앵커 가드 방식
- 0224/0225/0226 은 `position()=0` 검사 + 전체 `replace`(0225 의 `monetary boolean;` 치환은 가드 없음). 현재 본문에서 모두 1회라 실해 없음. 0211/0221 의 카운트 가드와 통일 권고(기록만).

## 4. 상태 표

| 항목 | 상태 |
|---|---|
| R8-1 P2 영향 없는 메뉴 세금 사건·대기 | 해소(0225 + tests/84, 수정 전 실패 로그) |
| R8 P4-3 미래월 첫 고정지출 가짜 추이 | 해소(0226 + tests/78) — 단 R9-1 의 과거월 부수 효과 |
| Astra 최종 반례(미래 예약 승격 carry) | 해소(0224 + tests/83) |
| R7-4 레거시 시장 단독 RPC | 초기설정 호환 경로로 유지(ROOT 결정), 앱 진입은 전부 원자 저장 |
| R4-1·R5-1·R6-1~3·R7-5 | 변동 없음 |