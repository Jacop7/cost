# LINKED-CHANGE 검수 R8 — 0218~0223 수정분 재검수 (Claude/Fable, 읽기 전용)

- 작성: 2026-09-12 · 검수자: Claude (Fable 5.1) · 방식: Windows MCP PowerShell 읽기 전용
- 대상 HEAD: `d33b3fa0aca0b76edbe426684a5668e76f156f23` (작업 트리 미커밋). 개발 DB 0214, 0215~0223 은 fresh DB 에만 적용이라는 전제 유지. 최종 새 DB + 전체 게이트 진행 중 → **전체 완료를 전제하지 않는다**.
- 제약: 소스/DB/Git/설정 변경 없음, 시험 실행 없음. "확인" 은 파일·로그 대조, "추정" 은 미실행 추론. 범위는 요청대로 **신규 P1/P2 와 R7 잔여**에 한정하고, 그 밖은 P4 메모로만 남긴다.
- 입력 지문(sha256 앞 16): 0218 `db7c8b6ee0b37c26`(5,542 B) · 0219 `183877afcc31db82`(1,909 B) · 0220 `e5991d9440db3941`(1,513 B) · 0221 `93258e0ce3983d7f`(2,048 B) · 0222 `490b74d5ae3d8972`(4,422 B) · 0223 `5b205cc9b03d582e`(506 B) · tests/77 `5cebf4ed2a3cb629`(17:34:07) · 78 `087a73900cef866d` · 79 `00cc69a692a9c1cf` · 80 `c4c7f03f2a93a5a8` · 81 `8b5f3290922654e8` · 82 `a3a0cceabeb98eea` · `MyCountryScreen.tsx`(6줄, 17:32:13) · `InternationalTaxScreen.tsx`(17:32:13) · `queryClient.ts`(17:28:17).
- 로그(확인): `tax-first.log` 81 ok 36 · `tax-inheritance.log` 82 ok 32(8×4) · `tax-real-ledger.log` 77 ok 49 · `astra-country-ui-second.log` myCountry 4 + recipeTaxBusinessDayInvalidation 5 통과. FAIL 0.
- 대조: `fixed-writer.sql`(0218 전 `save_fixed_costs`), 0214 이전 백업 dump(`save_menu_tax_override` L11018–11107, `close_business_day_row` L2524–2572, `active_menu_business_basis`, `recipe_snapshot_entry`), 0208(`last_entity_change` fallback), 0215/0217 원문.

## 1. 결론 요약

- **R7 잔여 처리 판정**: R7-1(MY-12 시장 단독 저장) **해소** — `MyCountryScreen` 은 `InternationalTaxScreen` 을 그대로 렌더하고 원자 저장만 쓴다(앱 진입 경로 기준). R7-3(원장 없는 시험) **해소** — tests/77 이 `quick_inbound` 뒤 `store_has_money_ledger` true 를 단언하고 국가 변경 45017·가격기준 허용을 실제 원장에서 검증. R7-2 는 0219 로 구체화됐고 sort/key 표시성은 ROOT 판단 보류(§3 R8-1 과 연결). R7-4(레거시 시장 RPC 전파 부재) 는 초기설정 호환으로 **잔존**하되 앱 경로가 없어 위험도 하향(§4).
- 0218·0220·0221·0223 은 앵커·순서·권한이 맞고 시험(78/79/80/81/82) 과 부합한다. 0220 은 `close_business_day_row` 의 `tax_quote`(마감 시점 새 quote) 로 순매출을 비교하며, 상태가 `closed` 로 바뀐 뒤 루프가 돌아 basis quote 가 아닌 새 quote 를 본다(dump L2550–2562).
- **신규 P2 1건(추정)**: 0219 가 `before_label/after_label` 을 **프로필 전체 규칙 라벨로 덮어써** `tax_components` 라인이 메뉴별 적용 구성이 아니라 매장 규칙 문자열이 되고, 0215 의 `affects_sales=true` 고정과 결합해 **영향 없는 메뉴(명시 면세·0% 등)** 도 요율·납부주체 변경 때 사건과 open/break 대기가 생긴다. 0223 이 없앤 매장 전체 fallback 과 같은 종류의 오탐이 메뉴 단위로 남는다. 0222 의 `tax_inheritance` 라인(상속 전환만, 세액 동일) 도 같은 경로로 대기를 만든다.
- 신규 P1 없음. P4 메모 4건.

## 2. 항목별 판정 (요청 항목)

| 후보 | 판정 | 근거 |
|---|---|---|
| 0218 같은 금액 구성 변경·정확한 no-op·당월 전파 | 적절(확인) | `v_prev` 앵커 뒤 `for update` 로 before 캡처(L35–37), `insert` 앵커 앞 no-op 조기 반환(L40–44: items·revenue 모두 동일 → e4 미호출, updated_at·추이·이력 불변), e4 의 옛 이력 블록 제거(L27–31, `end loop;` 앵커 순서 가드), `p_month=store_local_month` 일 때만 전 메뉴(비활성 포함) 사건 + generic `fixed_detail` fallback. 순이익은 `pending_recipe_tax_quote` 로 0221 과 같은 대기 세금 기준. tests/78 6단언×4 |
| 0219 구체 세금 규칙 사유 | 부분(§3 R8-1) | 라벨 자체는 요율·계산기준·적용 treatment·채널별 납부주체를 담아 R7-2 의 "구체화" 를 충족. 그러나 삽입 위치가 구성 라벨 계산(0215 L30–35) 뒤라 두 라벨 변수를 **무조건 덮어쓴다** |
| 0220 마감 net_sales 비교 | 적절(확인) | 비교식과 cause CASE 양쪽에 net 추가, `old_basis#>'{tax_quote,net_sales}'` 는 `recipe_snapshot_entry` 가 저장하는 키. tests/80 110원·세액 10 동일 반례 open/break 통과. 앵커는 `position=0` 검사 + 전체 `replace`(정확히-1회 패턴은 아님, P4) |
| 0221 이력 세금 기준 통일 | 적절(확인) | 5개 앵커 모두 카운트 가드(=1). 원장(sales/재고) 은 건드리지 않고 이력의 quote 만 `next_unopened` 기준. 과거일 입고의 추이(과거일 quote) 와 이력(대기 quote) 이 갈릴 수 있음(P4) |
| 0222 inherit_default+CAS+carry | 적절(확인) | 기본값 false 로 과거 행 추정 없음, `inherit → tax_category null` 제약, no-change 비교에 flag 포함, 두 insert·update·두 return 치환이 dump 원문과 1:1 일치(L11072–11105), carry 복원은 새 프로필 `default_treatment` 로 재계산, `recipe_tax_app_state.treatment` null 로 앱 선택 복원, 카탈로그 삭제 분류는 복구하지 않음(tests/82) |
| 0223 영향 없는 대기 fallback 제거 | 적절(확인) | `(c.kind='tax' or (c.kind='fixed_cost' …` → `((c.kind='fixed_cost' …` 로 괄호 균형 유지. 세금은 0215 per-menu 사건이 대체. 단 §3 R8-1 이 남는다 |
| MY-12 공유·원자 저장 | 적절(확인) | `MyCountryScreen` 6줄, `InternationalTaxScreen({title})`, 프로필 없는 매장은 `primaryDraft(country)` 시드. 레거시 `useSaveMarketProfile` 사용처는 훅 파일 내 정의뿐 |
| queryClient 정확한 키 제외 | 적절(확인) | `query.queryKey.length===qk.businessDay.length && every(...)` 로 `['sales','business-day']` 자신만 제외, `day_menu_basis` 등 자식 키는 무효화 |

## 3. 발견 사항

### R8-1 · P2 (추정) · 영향 없는 메뉴에 세금 사건·대기가 남는 경로 2개
- 위치: 0219 L21–22(라벨 덮어쓰기, 0215 L30–35 뒤·L36 `material:=` 앞) → 0215 L41 `change_line('tax_components', …)` → 0215 L53–56 `record_entity_change(…, changes, **true**, …)`. 0222 L53–55 `change_line('tax_inheritance', …)` 도 같은 `true` 로 기록된다.
- 재현 A(추정): 매장 기본 taxable, 메뉴 X 에 `save_menu_tax_override(…, null, 'exempt', 0)`; 영업 open; 프로필 저장으로 primary 요율 10→20(또는 배달 납부주체만 변경). 기대: X 는 세액 0→0·순매출 동일·적용 구성 [] → [] 이라 사건 없음(tests/82 L45–47 의 정신). 실제(추정): `a.rules≠b.rules` 라 L28 continue 를 지나고, 0219 가 두 라벨을 "부가세 10% · …" / "부가세 20% · …" 로 채워 `tax_components` 라인이 생겨 X 에 `세금 설정 반영`·affects_sales=true 사건 → `last_entity_change(X).has_pending_change=true`, 마감 후에도 X 의 basis 는 변하지 않아 "대기" 였던 것이 아무것도 반영하지 않는다. 0215 단독에서도 generic `tax_rules` 로 같은 결과였고 0219 는 문구만 바꿨다.
- 재현 B(추정): 메뉴 Y 에 명시 `'taxable'` 저장(기본값도 taxable) 후 open 상태에서 `(null,null)` 저장 → 0222 로 flag 만 false→true, treatment 동일 → `tax_inheritance` 라인만 있는 `메뉴 세금 수정` direct 사건, affects_sales=true → 대기. 과거(0222 이전) 명시 행을 "매장 기본값" 으로 되돌리는 정상 조작이 모두 이 경로를 탄다.
- 왜 P2: 0223 의 목적("영향 없는 메뉴의 세금 대기 제거") 이 메뉴 단위에서 미완이고, 면세 메뉴가 있는 매장의 요율 변경이라는 흔한 조작에서 대기 배지·자동 갱신 사건이 오탐으로 남는다. 데이터 손상은 없다.
- 최소 수정(안): (1) 0219 의 규칙 라벨은 `tax_components` 를 덮지 말고 별도 키(`tax_rules`, 기존 generic 자리) 로 두어 메뉴별 적용 구성 라벨을 복원; (2) `affects := monetary or a->'treatment' distinct or a->'price_basis' distinct or (rules distinct and (a->'components'≠'[]' or b->'components'≠'[]'))` — 적용 구성이 비어 있는 메뉴의 규칙 변경과 상속 전환만은 affects=false 로 정보성 기록; (3) tests/82 에 "면세 메뉴 + 요율 변경 → 사건 0·대기 false", "명시 taxable→상속(동일 기본값) → 대기 false" 두 단언 추가. sort/key 표시성(R7-2) 은 이 규칙 안에서 ROOT 가 결정하면 된다 — 이름/순서를 이력에 남기더라도 affects=false 면 대기 오탐은 없다.

## 4. R7 잔여 상태

| R7 | 상태 | 비고 |
|---|---|---|
| R7-1 P2 MY-12 시장 단독 저장 | 해소 | 앱 경로 없음. 서버 RPC 는 초기설정 호환으로 유지(ROOT 결정) |
| R7-2 P3 generic tax_rules | 부분 해소 → R8-1 | 문구는 구체화, affects/대기 오탐은 남음 |
| R7-3 P3 tests/77 원장 미검증 | 해소 | L25–31 실제 입고·45017 |
| R7-4 P3 레거시 시장 RPC 전파 부재 | 잔존(위험 하향) | `save_store_market_profile` 은 authenticated 에 열려 있고 0223 으로 매장 전체 fallback 도 사라져, 이 RPC 로 가격기준을 바꾸면 메뉴 사건·대기가 전혀 없다. 초기설정 전용이면 메뉴가 없어 실해는 작지만, tests/34 facade 수에 남는 한 "설정 진입 경로 전부 원자 저장" 을 서버가 보증하지는 않는다. 옵션: 메뉴가 1개라도 있는 매장에서는 22000 으로 거부 |
| R7-5~9 P4 | 변동 없음 | 0221 이 이력 기준을 통일했지만 closed 상태 추이 점 날짜(R7-5) 는 그대로 |

## 5. P4 메모 (판정 불변, 기록만)
1. 0220 은 `position()=0` 검사 후 전체 `replace` — 다른 후보들의 정확히-1회 가드와 다르다. 현재 본문에서 두 앵커는 1회씩이라 실해 없음.
2. 0221 과거일 입고(`p_occurred_at`) 는 이력 순이익이 대기 세금 기준, 추이 점은 과거일 quote 기준으로 갈릴 수 있다(원장 날짜 유지 정책의 부수 효과).
3. 0218 이후에도 미래 월 고정지출 첫 저장은 e4 의 `p_prev_rate null` 게이트로 오늘 날짜에 당월 값과 동일한 추이 점을 추가한다(R1 F7-2 잔여, 0218 범위 밖).
4. `menu_tax_overrides.inherit_default` 는 과거 행에서 false 라 "명시" 로 보이며, 되돌리기 저장이 R8-1 재현 B 를 탄다. 정책대로 추정하지 않는 것은 맞고, R8-1 의 affects 규칙으로 흡수된다.