# LINKED-CHANGE 검수 R10 — 0227 최종 델타·R9-1 정책화 (Claude/Fable, 읽기 전용)

- 작성: 2026-09-12 · 검수자: Claude (Fable 5.1) · 방식: Windows MCP PowerShell 읽기 전용
- 대상 HEAD: `d33b3fa0aca0b76edbe426684a5668e76f156f23` (작업 트리 미커밋). 개발 DB 0214, 후보는 fresh DB 에만. 전체 verify 는 업그레이드 단계 진행 중이고 commit-byte evidence gate 실패가 있으므로 **전체 통과로 쓰지 않는다**. "확인" 은 파일·로그 대조, "추정" 은 미실행 추론.
- 제약: 소스/DB/Git/설정 변경 없음, 시험 실행 없음. R1~R9 원문 보존, 본 문서 1개만 신규. 범위: 0227, tests/85, tests/78 델타, ARCHITECTURE §3 정책, 지정 로그 3건.
- 입력 지문(sha256 앞 16): 0227 `tax_projection_null_and_scope` 1,230 B · 17:48:37 · `92342afbbf89c91e` · tests/85 5,584 B · 17:48:59 · `2db5870d2e42f125` · tests/78 5,193 B · 17:50:00 · `dcd5dd5c9919d050` · ARCHITECTURE.md 26,079 B · 17:50:00 · `d73f8003890f026f`.
- 로그(확인): `scope-projection-before.log` 85 **FAIL**(첫 실패 "다른 과세 상태로 범위 확장해도 기존 과세 메뉴의 재무 사건은 증가하지 않음", ok 3) · `scope-projection-after.log` 85 ok 25 / FAIL 0 · `fixed-past-month-final.log` 78 ok 30 / FAIL 0.

## 1. 결론 요약

- **0227 적절(확인)**. 두 helper 를 `create or replace` 로 바꿔 propagate 는 재패치 없이 새 정의를 쓴다. (1) `jsonb_typeof(p_items)='array'` 가 아니면 `'[]'` 로 정규화해 프로필 없는 quote 의 **JSON null**(`jsonb_build_object('rules', NULL)` 로 생기는 `'null'::jsonb`, 0225 의 `coalesce` 는 SQL NULL 만 처리) 에서 나던 "cannot extract elements from a scalar" 를 없앤다. (2) 재무 규칙 투영에서 `applies_to_treatments` 를 추가로 제외한다 — 적용 여부는 이미 `applicable_tax_change_items` 가 메뉴 treatment 로 해소했으므로, 범위 확장(taxable→taxable+exempt) 은 기존 과세 메뉴의 금액·규칙을 바꾸지 않아 affects=false 정보성(`tax_rules` 라벨은 "적용: …" 을 포함해 확장 사실을 보존) 이고, 새로 포함되는 면세 메뉴는 필터 결과가 [] → [규칙] 으로 달라지고 quote 세액이 생겨 monetary=true 재무 사건이 된다.
- **R9-1 정책화(확인)**. ARCHITECTURE.md §3 L86 에 "과거월 정정은 해당 월 `monthly_pl` 과 설정 수정 내역에 기록하고, 현재 메뉴·식재료 가격으로 과거 날짜의 메뉴 손익 점을 합성하지 않는다. 종료 영업일 스냅샷은 보존한다" 가 명시됐고, tests/78 L45–49 가 지난달 저장 후 `monthly_pl.fixed_cost=40000·revenue=100000`, `profit_trends` 불변, 메뉴 사건 불변을 4상태에서 단언한다. e4 는 과거월에서도 `monthly_pl` upsert 를 수행하고 recompute 만 당월로 제한되므로 문서와 코드가 일치한다. R9-1 은 "조용한 의미 변경" 지적이었고 계약 명시 + 시험으로 **해소**.
- 신규 P1/P2 없음. P4 메모 2건.

## 2. 항목별 검토

### 2.1 0227 (확인 + 추정)
- `applicable_tax_change_items`: 배열이 아니면 `'[]'`; 나머지 규칙(p_treatment null 전부 통과, `applies_to_treatments` 없는 항목 통과, primary→taxable, additional→배열 포함) 은 0225 와 동일.
- `tax_financial_change_rules`: `key/name/sort_order/applies_to_treatments` 제거 후 텍스트 정렬. 남는 필드(kind·rate_pct·calculation_basis·jurisdiction_level·remittance) 는 모두 금액 또는 납부 계산에 관여한다. `tax_profile_payload` 구성에 저장마다 바뀌는 id 가 없다는 점은 tests/84 "표시 이름은 … 정보성 사건"(affects=false) 통과로 간접 확인.
- propagate 순서(0225 §2.1) 는 그대로: 필터 → `a=b` → monetary → 라벨 → affects → changes → `tax_rules` 라인 → 기록. 범위 확장의 경우 필터된 `a.rules` 와 `b.rules` 는 `applies_to_treatments` 값이 달라 `a≠b` 로 진행하되 affects=false, `tax_rules` 라인만 남는다(tests/85 L47–49). 새로 포함된 면세 메뉴는 quote 세액이 0→양수라 monetary=true, `rec.active` 면 recompute(tests/85 L45–46).
- tests/85: 6단언×4 + null 처리 1 = 25. `applicable_tax_change_items('null',null)`·`(null,null)`·`tax_financial_change_rules('null')`·`(null)` 모두 `'[]'`.

### 2.2 tests/78 델타 + 정책 (확인)
- 7단언×4 + pending 2 = 30. 신규 L45–49 는 `to_char(d-interval '1 month','YYYY-MM')` 저장으로 과거월을 만들고 monthly_pl 실제 반영·추이 불변·사건 불변을 본다.
- 0226 + 0218 의 결합 의미(과거월: 설정 이력·monthly_pl 만) 가 ARCHITECTURE §3 L82·L86 과 일치한다. 종료 스냅샷은 어떤 writer 도 쓰지 않는다(0215 시험 L59 로 별도 확인됨).

## 3. 발견 사항 (신규 P1/P2 없음)

### R10-1 · P4 · primary 항목의 적용 판정이 배열을 무시
- `applicable_tax_change_items` 는 `kind='primary'` 를 항상 taxable 에만 적용한다. 계산 엔진이 primary 에도 `applies_to_treatments` 를 존중한다면, primary 를 exempt 로 넓힐 때 면세 메뉴의 세액은 바뀌어 monetary=true 로 사건은 생기지만 필터된 규칙·`tax_rules` 라벨에는 primary 가 빠져 사유 문구가 비게 된다. 엔진이 primary 를 taxable 전용으로 두면 무해. 정책 확인용 기록.

### R10-2 · P4 · 필터 결과가 `a=b` 게이트에 `applies_to_treatments` 를 그대로 남김
- 범위 확장은 재무 투영에서만 제외되고 `a=b` 비교에는 남아 사건(정보성) 이 생긴다. 이는 "원본 범위 정보 이력 보존" 의도와 맞으므로 결함이 아니며, 범위 축소(taxable+exempt→taxable) 도 같은 경로로 정보성 사건이 된다는 점만 기록.

## 4. 상태 표

| 항목 | 상태 |
|---|---|
| Astra 0225 범위확장 오탐(P2) | 해소(0227 + tests/85, 수정 전 실패 로그) |
| JSON null helper 오류(44/64/83) | 해소(0227 정규화 + tests/85 null 단언). 전체 verify 재실행 결과는 ROOT 확인 |
| R9-1 P3 과거월 back-dated 추이 | 해소(계약 명시 §3 L86 + tests/78 L45–49) |
| R9-2 P4 key-only generic 사건 | 변동 없음 |
| R7-4 레거시 시장 단독 RPC | 초기설정 호환 경로 유지(ROOT 결정) |
| R4-1·R5-1·R6-1~3·R7-5 | 변동 없음 |