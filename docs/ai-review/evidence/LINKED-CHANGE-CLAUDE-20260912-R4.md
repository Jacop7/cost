# LINKED-CHANGE 검수 R4 — 0210/0211/0212 + tests/68·69 (Claude/Fable, 읽기 전용)

- 작성: 2026-09-12 · 검수자: Claude (Fable 5.1) · 방식: Windows MCP PowerShell 읽기 전용
- 대상 HEAD: `d33b3fa0aca0b76edbe426684a5668e76f156f23` (작업 트리 미커밋 변경 포함, 0209~0212·tests/68~70 은 미추적 파일)
- 제약 준수: 소스/DB/Git/배포/설정 변경 없음 · 시험 재실행·DB 실행·서비스 쓰기·유료 도구 호출 없음 · 산출물은 이 파일 1개(신규) 뿐 · R1~R3 파일 보존
- 본 문서의 "확인"은 파일·로그를 직접 읽어 대조한 것, "추정"은 코드 읽기에 기반한 미실행 추론임. 공식 Fable CLI 게이트·전체 verify 를 대체하지 않음.

## 0. 입력 지문 (직접 산출)

| 대상 | 크기 | SHA-256 (앞 16) | 비고 |
|---|---|---|---|
| `packages/db/supabase/migrations/20260912000210_change_source_material_tax.sql` | 204 B | `b6fca61f4f6fa85b` | begin/commit 없음(enum ADD VALUE) |
| `…/20260912000211_material_change_propagation.sql` | 5,652 B | `0d2aaba8bc7e20d1` | v2→v3 복사·패치, e4 게이트 |
| `…/20260912000212_recipe_audit_money_boundary.sql` | 2,523 B | `253b485fb8f0a053` | e3 게이트·자유입력 부자재 이름·source_name |
| `packages/db/tests/68_recipe_composition_history.sql` | 5,956 B (16:21:12) | `dd4a52a4d9229937…931122` | 단언 29개(계산: 6×4 + pending 2×2 + ACL 1) |
| `packages/db/tests/69_material_propagation_matrix.sql` | 7,229 B (16:22:54) | `4a601202ee5c4249…fbd99e` | **요청문의 파일명 `69_material_change_propagation.sql` 과 다름**. 단언 43개(10×4 + pending 1×2 + ACL 1) |
| `.codex/material-history-20260912/composition-final.log` | 2,221 B (16:21:13) | `16a7a06296…dd711` | PASS 68, ok 29, FAIL 0 |
| `.codex/material-history-20260912/material-matrix.log` | 3,515 B (16:22:56) | `3316755291…3595c` | PASS 69, **ok 43**(요청문은 39), FAIL 0 |
| `.codex/material-history-20260912/material-db-all.log` | 148,856 B (16:20:54) | `8d8a3e8f02…101ae` | 71/71 통과(29.3s), `not ok`/FAIL 0 (grep 'fail' 11건은 모두 ok 라인 문구) |
| `.codex/material-history-20260912/before-status-0208-1789196852105.sql` | 1,644,018 B | `6a3bc958…` (R4 preflight 재확인) | 0208 적용 전 백업 존재 |

로그 버전 불일치(확인): `material-db-all.log` 안의 68 섹션은 25개 단언(“금액 동일한 구성 교체는 즉시 상태에서도 추이 추가 없음” 없음), 69 섹션은 39개 단언(“판매 중지 메뉴도 원가·이력은 갱신” 없음)으로, **현재 파일(29/43)보다 이전 판**으로 실행된 것이다. 즉 71/71 은 0211 까지의 회귀 증거이고, 0212 에 의존하는 단언은 단독 실행 로그(composition-final·material-matrix) 에만 있다.

범위 밖 관찰(요청 입력에 없으나 같은 폴더에서 확인): `linked-final-db-all.log`(16:25:50, sha `3d2d6aeb…`) 는 72/72 통과이며 `70_menu_metadata_history.sql` 이 추가되어 있고, 0212 의존 단언 4건(“즉시 상태에서도 추이 추가 없음”)과 69 의 43개 단언이 모두 ok 로 들어 있다. 이 로그가 어느 마이그레이션 세트로 돌았는지는 로그 자체에 기록이 없어(추정: 0212 포함, 단언 통과가 0212 e3 게이트 없이는 불가능) 공식 근거로는 ROOT 의 확인이 필요하다.

## 1. 결론 요약

- **0210** 적절. `change_source` 에 `material`,`tax` 추가. 별도 트랜잭션 없이 ADD VALUE 만 두어 0211 이 새 값을 함수 본문에서 쓸 수 있게 한 순서도 맞다. 단 `'tax'` 값을 쓰는 writer 는 아직 없다(레거시 `save_store_tax` 는 여전히 `'fixed_cost'`, 국제 세금 프로필 writer 는 여전히 이력 없음 → F8·F3 미해결 유지).
- **0211** 핵심 목표(F1 P1 부자재 단가 자동 이력, F2 무변경 저장, R3-3 stale 이름, F10 고정지출 동일합계) 를 코드·로그로 확인. v3 helper ACL 은 executor 전용으로 닫혀 있고(테스트로 `authenticated` 만 확인), no-op 는 **모든 쓰기 이전** 에 조기 반환하므로 updated_at·설정 이력·메뉴 이력·추이 모두 불변. 0원은 `coalesce` 로 보존되어 실제 변경으로 기록. 이름만 변경은 연결 이름 동기화 + `affects_sales=false` 정보 이력. inactive 메뉴도 원가·이력은 갱신하되 recompute 는 건너뛴다(대기 없음). 다중 메뉴는 correlation 1개.
- **0212** e3(추이 점) 를 금액 변화(가격/재료비/부자재비/세금/순매출) 때만 호출하도록 바꿔 R3-1(즉시 모드 동일 금액 교체의 동일 추이 행) 을 해소. 자유입력 부자재의 이름만 변경은 `v_composition`(=금액 권위) 에서 제외되나 0209 의 구성 change_line(감사) 에는 남는다 — R3-2 권고와 일치. `change_event_json.source_name` 에 material 분기 추가로 앱 `sourceLabel('material')` 의 `sourceName` 이 채워진다.
- 신규 결함 P1/P2 없음. P3 1건(기존 불일치 이름 backfill 부재, 정책 판단 필요), P4 5건, 커버리지 공백 4건.
- **미해결 유지**: F3(국제 세금 자동 이력), 구매가·용량 계약(미구현, 입고평균 vs 수동가 우선순위는 최종 사용자 답변 대기), F8(`'tax'` 값 미사용).

## 2. 항목별 검토

### 2.1 0210 `change_source` 확장 (확인)

- 두 줄 `alter type … add value if not exists` 만 있고 begin/commit 이 없다. PostgreSQL 은 새 enum 값을 같은 트랜잭션 안에서 사용할 수 없으므로 0211(별도 파일·별도 트랜잭션) 에서 리터럴 `'material'` 을 쓰는 구성이 맞다.
- 앱 측(범위 밖, 작업 트리 관찰): `apps/mobile/src/features/changes/hooks.ts:32` `ChangeSource` 에 `'material' | 'tax'` 포함, `sourceLabel` 254–268 에 `material → "{sourceName} 변경"/"부자재 변경"`, `tax → "세금 설정"` 분기 존재. `ChangeSourceBadge` 의 `automatic = sourceType !== 'direct'` 규칙과도 일관.

### 2.2 0211 `recipe_edit_material_apply_v3` (확인 + 추정)

원본 v2 는 0204 가 `save_material` 본문을 그대로 복사한 것으로, `linked-functions.txt` 로 본문을 대조했다. 0211 의 세 앵커(선언·`if v_id is null then`·전파 블록) 는 v2 본문에 정확히 1회 존재하고, 정확히-1회 카운트 가드가 있다(L12·28·56·60·74).

| 점검 | 판정 | 근거 |
|---|---|---|
| ACL | 확인 | L63–67: owner 이전(`grant create` → `alter owner` → `revoke create`), `revoke all … from public,anon,authenticated,service_role`, executor 만 execute. `save_material` facade 앵커 v2→v3 교체(L58–61). tests/69 마지막 단언은 `authenticated` 의 EXECUTE 부재만 검사. |
| no-op | 확인 | L15–20: `for update` 로 행을 잠근 뒤 `row(name,category_id,unit_cost,unit_label,memo)` 를 **v2 update 절과 동일한 정규화**(`nullif(category_id)`, `coalesce(unit_cost)`, `coalesce(nullif(unit_label))`, `nullif(memo)`) 로 비교해 같으면 `return v_id`. 이 반환은 update(=updated_at 갱신·0207 트리거)·extras 동기화·recompute·record 보다 앞이라 tests/69 "무변경 저장은 설정 이력·메뉴 이력·추이·시각 유지" 4개 stage 모두 ok. |
| 0원 | 확인 | `coalesce((p_payload->>'unit_cost')::numeric, v_before.unit_cost)` 는 0 을 보존하고, v2 의 `< 0` 검사만 있으므로 0 은 유효값. tests/69 "0원도 실제 단가 변경으로 기록" ok(연결 extras 0, 메뉴 이력 +1). |
| 이름 변경 | 확인 | L40–42: extras 의 `name` 을 마스터 이름으로 동기화(변경된 행만). L47–48: `change_line('material_name', …, 'derived')` 로 정보 이력, `affects_sales = (v_old is distinct from v_new)` = false, 제목 "부자재 정보 반영". tests/69 "이름 변경은 연결 이름·정보 이력만 갱신"·"이전 단가 대기를 숨기지 않음" ok. |
| 카테고리·메모·단위만 변경 | 추정 | no-op 아님 → update 실행(0207 트리거가 설정 이력 기록) → 루프에서 `v_ch = []` → `record_entity_change` 가 빈 배열에 null 반환(0078) → 메뉴 이력 없음. 합리적이나 테스트 단언 없음(§4). |
| 원복 | 추정 | 단가 500→300 원복은 no-op 가 아니므로 단가 이력 1건 추가·affects true. 열린 영업 중이면 has_pending_change 는 이벤트 시각 계약(F7-1) 대로 true 유지, 종료 시 close loop 는 raw 와 basis 가 같아 recompute 없음. tests/69 에 원복 단언은 없음(§4). |
| inactive 메뉴 | 확인 | L43–44 루프는 active 조건 없이 연결 메뉴 전부를 돌고, L49 만 `rec.active` 로 recompute 를 제한. tests/69 "시작 기준에 없는 판매 중지 메뉴도 원가·이력은 갱신하고 대기는 없음"(extra_cost 1000, has_pending false) ok. |
| 다중 메뉴 | 확인 | `v_corr` 1개를 루프 전체가 공유. tests/69 "연결 메뉴 각각 자동 갱신 1건·미연결 0건"(distinct correlation 1, bool_and(affects) true) ok. `v_costs`(L21–25) 는 **갱신 전** 메뉴별 extras 합계를 잡아 before 금액을 정확히 만든다(자유입력 extras 포함 합계이므로 부자재비 항목과 단위가 같음). |
| 열린 영업 보존 | 확인 | raw `recipe_extra_costs` 는 즉시 갱신되지만 `recompute_recipe` 는 basis 존재 시 조기 반환(0206), effective 값은 유지. tests/69 "열린 영업 금액 유지/영업 전후 즉시 적용"·"종료 후 최종 0원 반영·대기 해제" ok. |
| 기존 원장 보존 | 확인 | 0211 은 DDL·데이터 backfill 이 없고 함수 정의만 바꾼다. `profit_trends`·`entity_change_events`·`store_configuration_changes`·`recipe_extra_costs` 기존 행을 건드리는 문장 없음. 71/71(0211 까지) 에서 01~67 회귀 없음. |
| e4 게이트 | 확인 | L70–76: `perform recompute_recipe(rec.id,'fixed',v_day)` 앵커(0208 백업 dump L4249 와 동일 들여쓰기) 를 `if p_prev_rate is null or p_prev_rate is distinct from v_rate then … end if` 로 감쌈. 첫 저장(prev null) 은 종전대로 추이 생성. tests/69 "같은 고정지출 합계 구성 변경은 추이 추가 없음" 4 stage ok. `monthly_pl` upsert 는 루프 밖이라 영향 없음. |

### 2.3 0212 `recipe_edit_apply_v3` 금액 경계 (확인 + 추정)

- e3 앵커(L7) 를 `if v_new then … end if` 로 바꾸고, update 분기의 `v_money :=` 직전(L11–17) 에 가격/`v_mat`/`v_ext`/`v_tax`/`v_net` 중 하나라도 distinct 일 때만 e3 호출을 삽입. update 경로에서 e3 가 두 번 불릴 수 없고(원래 호출은 v_new 전용이 됨), `v_net0/v_net1` 은 v2 본문(0191 기원) 에 이미 선언·계산되어 있어 앵커가 성립한다(단독 실행 통과가 이를 증명).
- `recompute_recipe` 는 `profit_trends` 삽입만 하고 캐시 컬럼을 쓰지 않으므로(linked-recompute.txt 대조), 금액 5요소가 모두 같으면 생기는 행은 직전 행과 동일했을 것 → 게이트로 빠져도 정보 손실 없음. 과거 날짜(`occurred_at`) 편집도 금액 변화가 없으면 점을 찍지 않게 되는데, 이는 의도된 방향이며 `28_past_edit_round_trip` 는 linked-final-db-all(범위 밖) 에서 ok.
- 자유입력 부자재(L21–28): `e->0 = 'null'` 이면 `[e0,e1,e3]`(material_id,qty,amount) 로 축약해 이름을 금액 비교에서 제외. shape 원소가 `[material_id,qty,name,amount]` 임은 R3-2 에서 확인. 0209 의 감사용 change_line(L59) 은 원본 shape 비교를 유지하므로 이름 변경도 "부자재 구성" 항목으로 남는다.
- `change_event_json.source_name` 에 `when 'material' then (select name from materials where id=source_entity_id and store_id=…)` 추가(L32–36). 0211 이 `source_entity_id = 부자재 id` 를 넣으므로 매칭된다.

### 2.4 테스트 커버리지 대응표

| 요구 항목 | tests/68 | tests/69 |
|---|---|---|
| helper ACL | `recipe_edit_apply_v3`, `recipe_composition_labels` (authenticated) | `recipe_edit_material_apply_v3` (authenticated) |
| no-op | 재요청(receipt replay)·의미상 무변경 → 이력·추이·판본 유지 | 무변경 저장 → 설정 이력·메뉴 이력·추이·updated_at 유지 |
| 동일 금액 | 식재료/부자재 교체 direct 1건, 즉시 상태에서도 추이 없음, 종료 후 추이 없음 | 같은 고정지출 합계 구성 변경 추이 없음 |
| 0원 | — | extras 0·이력 +1 |
| 이름 변경 | — | 연결 이름 동기화·정보 이력·대기 불변 |
| 원복 | — | — (공백) |
| inactive/다중 | — | 미연결 0건, 판매중지 메뉴 갱신·대기 없음, correlation 1 |
| 열린 영업 보존 | snapshot 불변 | effective 금액 유지·종료 후 반영 |

## 3. 발견 사항

### R4-1 · P3 · 기존 `recipe_extra_costs.name` 불일치 행에 대한 backfill 부재 (정책 판단 필요)
- 위치: `20260912000211` L40–42 (동기화는 **해당 부자재를 다시 저장할 때만**) · no-op 조기 반환 L20.
- 내용: 0211 이전 v2 는 이름을 동기화하지 않았으므로, 과거에 이름이 바뀐 부자재의 연결 extras 는 옛 이름을 갖고 있을 수 있다(R3-3). 0211 은 이를 일괄 정정하지 않으며, no-op 저장은 조기 반환하므로 "그냥 한 번 더 저장" 으로도 정정되지 않는다. 결과적으로 0209 의 구성 라벨(`recipe_composition_labels`, `ec.name` 사용)·recipe_detail extras 표시가 다음 실제 변경 때까지 옛 이름을 보인다.
- 재현(추정): 0211 이전에 부자재 이름 변경 → 0211 적용 → 해당 메뉴 상세/구성 이력에서 옛 이름 확인.
- 최소 수정(안): 별도 데이터 마이그레이션 `update recipe_extra_costs ec set name=m.name from materials m where ec.material_id=m.id and ec.store_id=m.store_id and ec.name is distinct from m.name;` (이력 이벤트 없이, 금액 무관). 단, "연결 시점 이름 스냅샷" 을 의도한 설계라면 하지 않는 것이 맞으므로 **정책 결정 사항**. dev DB 영향 규모는 읽기 쿼리 `select count(*) from recipe_extra_costs ec join materials m on m.id=ec.material_id where ec.name is distinct from m.name` 로 확인 가능(본 검수는 미실행).

### R4-2 · P4 · e4 recompute 게이트와 이력 게이트의 비교식 불일치
- 위치: 0211 L75 `p_prev_rate is distinct from v_rate` vs 기존 e4 이력 게이트 `round(v_rate0,6) is distinct from round(coalesce(v_rate,0),6)` (0208 dump L4255).
- 영향: 6자리 미만의 반올림 차이나 `v_rate` null(수익 0 등) 인 경우 추이 행은 추가되고 메뉴 이력은 남지 않는 조합이 가능. 실사용 빈도 낮음. 최소 수정: 두 게이트를 같은 식으로 통일.

### R4-3 · P4 · 0212 e3 게이트(정확 비교) 와 `v_money`(round 4) 비대칭
- 위치: 0212 L12–14 vs v2 본문 `v_money` 의 `round(…,4)`.
- 영향: 0.0001 미만 차이에서 추이 점은 생기는데 `affects_sales=false` 로 기록될 수 있음. 실질 영향 미미. 통일 권고.

### R4-4 · P4 · 0211 owner 이전 후 스키마 CREATE 폐쇄 검증 생략
- 위치: 0211 L63–65. 0204 는 같은 패턴 뒤 `has_schema_privilege('margincook_rpc_executor','public','CREATE')` 가 false 인지 raise 로 확인했으나 0211 은 생략. `34_rpc_least_privilege` 가 이를 상시 검증하는지는 본 검수에서 미확인. 일관성 차원의 권고.

### R4-5 · P4 · 부자재 기인 추이 행의 원인 표기(기존 동작)
- 0211 L49 는 v2 와 같이 `recompute_recipe(rec.id,'recipe',null)` 을 호출하므로 `profit_trends.source_type='recipe'`, `source_label='직접 수정'`, `source_entity_id=메뉴` 로 남는다. 메뉴 이력은 이제 `material` 로 구분되지만 추이 쪽은 여전히 "직접 수정" 이다. `trend_cause` 의 `'material'` 은 식재료 의미로 쓰이고 있어 값 추가가 필요한 정책 사항. 이번 범위 밖이며 기록만 남긴다.

### R4-6 · P4 · 커버리지 공백 (tests/68·69)
1. 원복(단가 A→B→A) 시 이력 1건 추가·대기 유지·종료 후 추이 없음 — 단언 없음.
2. 카테고리/메모/단위만 변경 — 설정 이력은 1건 추가되고 메뉴 이력·추이는 없어야 함 — 단언 없음.
3. 고정지출 동일합계 구성 변경 — 추이 없음은 검증되나 `store_configuration_changes(kind='fixed_cost')` 가 여전히 기록되는지(F10 해소가 이력을 지우지 않았는지) 단언 없음(63 테스트가 덮을 수 있으나 본 검수 미확인).
4. tests/69 의 `count(distinct correlation_id)=1` 은 첫 단가 변경 직후만 검사한다. 이름 변경 후에는 correlation 이 2개가 되어야 하는데 재검사 없음(사소).

## 4. 미해결·범위 밖 (변경 없음)

- F3 국제 세금 프로필 writer 의 메뉴 이력·추이 부재 — 0210 의 `'tax'` 값은 준비만 됐고 writer 는 아직 없음.
- F8 레거시 `save_store_tax` 의 `'fixed_cost'` 표기 — 앱은 `title.includes('세금')` 우회 유지.
- 구매가·용량 계약(B안/C안) — 미구현. 입고 평균가 vs 수동 수정가 우선순위는 최종 사용자 답변 대기. 본 검수는 이를 완료로 취급하지 않는다.
- 0212 는 요청 입력 로그(71/71) 에 포함되지 않았다. 범위 밖 로그(linked-final-db-all 72/72) 가 0212 포함 실행으로 보이나 ROOT 확인 필요.

## 5. 검증 한계

- 모든 판정은 파일 읽기와 기존 로그 대조에 근거. 시험·마이그레이션·쿼리를 실행하지 않았다.
- 새 후보는 독립 fresh DB 에만 적용되어 있고 dev DB 는 0208 까지라는 전제를 그대로 둔다.
- 앱 측(`hooks.ts` 등) 은 요청 범위 밖이라 enum 대응 여부만 관찰했다.