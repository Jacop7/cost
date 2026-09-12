# LINKED-CHANGE 검수 R5 — 0213 0원 부자재 연결 보존 (Claude/Fable, 읽기 전용)

- 작성: 2026-09-12 · 검수자: Claude (Fable 5.1) · 방식: Windows MCP PowerShell 읽기 전용
- 대상 HEAD: `d33b3fa0aca0b76edbe426684a5668e76f156f23` (작업 트리 미커밋 변경 포함)
- 범위: 아래 입력 파일·단독 로그만. 0210~0212 는 재검수하지 않음(R4 참조). 소스/DB/Git/배포/설정 변경 없음, 시험·쿼리 실행 없음. R1~R4 보존, 본 문서 1개만 신규.
- 전체 SQL 최종 실행은 갱신 중이라는 ROOT 안내에 따라 **전체 회귀 통과를 전제하지 않는다**. 아래 판정은 단독 로그(tests/71, tests/16) 와 코드 읽기에 한정된다.

## 0. 입력 지문 (직접 산출)

| 대상 | 크기 · 시각 | SHA-256 |
|---|---|---|
| `packages/db/supabase/migrations/20260912000213_zero_cost_material_links.sql` | 3,106 B · 16:32:05 | `b1cc2fc50edfac52f627bfdc0f4ba1347c8bf7bfcd2ad12835529d7dead789de` |
| `packages/db/tests/71_zero_material_lifecycle.sql` | 3,922 B · 16:32:50 | `d52e4e569c63e2d5ca55093e908eb0da4c18d953807d5965ce4f3934c13658b2` |
| `.codex/material-history-20260912/zero-material-lifecycle.log` | 1,714 B · 16:32:51 | `bc818f1d4175cb513661e5295584902f4377086287f9151b42cb30b63333314b` — PASS 71, ok 21(5×4 + ACL 1), FAIL 0 |
| `packages/db/tests/16_change_retention.sql` (수정, 추적 파일) | 31,179 B · 16:34:37 | `d0cb15e064762fbacf1e3c06badc79fdf92fbcdb922549dcadfdbecd8557b55f` — diff +10/−2 |
| `.codex/material-history-20260912/acl-final.log` | 5,686 B · 16:34:38 | `af2013485cd93282099c2f60cecc72c89275c5b5586ef021f06b866408fcdd35f` — PASS 16, 1/1 통과, "내부 invoker 5개"·"v3 앱 역할 비공개" ok |

보조 대조(읽기): 0208 이전 백업 dump 의 `recipe_edit_extra_rows_v2`·`recipe_edit_shape_v2`·`recipe_draft_preview_internal` 정의, `20260911000204` L409(save_recipe 의 shape 비교), `20260912000209` L33/40/68(apply v3 의 shape 호출·facade 교체).

## 1. 결론 요약

- **결함 원인 확인**: 0204 의 v2 정규화 `recipe_edit_extra_rows_v2` 는 `where coalesce(case when m.id is not null then m.unit_cost*qty else amount end,0) <> 0` 로 **마스터 연결 행도 금액 0 이면 버린다**. 그래서 0원 부자재를 연결한 메뉴를 full save(이름만 수정) 하면 `delete → insert from rows_v2` 과정에서 연결이 사라지고, 이후 단가 복원(0211 전파) 이 닿을 메뉴가 없어 원가가 0에 남는다. 게다가 shape 비교도 같은 정규화를 쓰므로 DB 행(`[m,qty]`) 과 본문(버려짐) 이 달라 "변경" 으로 판정되어 no-op 도 아니었다.
- **0213 수정 적절**: v3 정규화는 `(m.id is not null and qty>0) or (m.id is null and amount<>0)` 로 바꿔 연결 행은 단가와 무관하게 보존하고 자유입력 행은 종전대로 금액 0 을 버린다. shape v3 는 v2 본문에서 정규화 호출만 v3 로 바꾼 사본이며, 현행 writer 두 곳(`save_recipe` 의 shape 비교 2회, `recipe_edit_apply_v3` 의 shape 2회 + rows 1회) 만 v3 로 연결했다. sealed `recipe_edit_extra_rows_v2`·`recipe_edit_shape_v2`·`recipe_edit_apply_v2` 는 건드리지 않았다(정확히-1회/2회 앵커 가드 있음).
- **숨은 연결 삭제 경로**: 없음(추정, 아래 §2.3). 명시적 `extras: []` 는 종전대로 전부 제거한다(tests/71 단언).
- **no-op 불일치**: 0213 후 DB 행 branch(`[material_id,qty]`, 금액 무시) 와 본문 branch(rows_v3) 가 같은 원소 형태를 내므로 0원 연결이 있는 상태의 재저장이 no-op 로 판정된다(추정 — tests/71 에 단언 없음, §4).
- **권한 우회**: 없음. v3 두 함수는 executor 소유·executor 전용 execute(0213 L33–38), SECURITY INVOKER(STABLE) 로 definer facade 아래서 executor 권한(RLS 적용) 으로만 실행. tests/16 은 invoker allowlist 를 3→5 로 명시 확장하고 anon/authenticated/service_role 직접 호출 금지를 단언, acl-final.log ok.
- 신규 P1/P2 없음. P3 1건(이미 유실된 연결은 복구되지 않음), P4 2건, 커버리지 공백 2건, 범위 밖 미확인 1건(앱 페이로드).

## 2. 항목별 검토

### 2.1 sealed v2 helper 보존 (확인)
- 0213 은 `recipe_edit_extra_rows_v2`/`recipe_edit_shape_v2` 를 `pg_get_functiondef` 로 읽어 **이름을 바꾼 사본**만 `execute` 한다(L17, L20–21). 원본에 대한 `create or replace`·`alter`·`drop` 없음. `recipe_edit_apply_v2` 는 등장하지 않는다.
- L7–8: v3 두 함수가 이미 있으면 raise → 재적용 시 fail-closed.
- L18 의 shape 정의는 CRLF 정규화를 하지 않았으나 치환 대상이 함수 이름뿐이라 영향 없음.

### 2.2 v3 정규화/shape 와 현행 facade/writer 연결 (확인)
- L22–31: `save_recipe(uuid,jsonb)` 와 `recipe_edit_apply_v3(uuid,jsonb)` 각각에서 `recipe_edit_shape_v2(` 가 정확히 2회(save_recipe: 0204 L409 의 no-op 비교 양변; apply v3: 0209 의 `v_shape0/v_shape1`) 임을 가드한 뒤 v3 로 치환, apply v3 에서만 `recipe_edit_extra_rows_v2(` 1회(0204 L91 의 insert 소스) 를 v3 로 치환. 단독 로그 통과가 앵커 성립을 증명한다.
- 0209 L68 에서 facade 는 이미 `recipe_edit_apply_v3` 를 부르므로, 앱 → `save_recipe` → shape v3 비교 → `recipe_edit_apply_v3` → rows v3 의 경로가 완성된다. sealed `recipe_edit_apply_v2` 만 rows v2 를 계속 참조하지만 facade 에서 도달하지 않는다.
- `create or replace` 는 소유자·ACL 을 바꾸지 않으므로(0211/0212 와 동일 패턴) `save_recipe`/`apply_v3` 의 executor 소유가 유지된다. tests/16 "postgres 권한의 SECURITY DEFINER 목록이 그대로다" ok 가 이를 간접 확인(두 함수가 목록에 나타나지 않음).
- `recipe_draft_preview_internal`(0208 dump L7238–7245) 은 자체 계산으로 연결 행을 `qty*coalesce(unit_price,0)` 에 더하고 0원 행을 버리지 않으므로 미리보기와 저장의 연결 취급이 일치한다.

### 2.3 숨은 연결 삭제 경로 점검 (추정)
| 경로 | 0원 연결 행 처리 |
|---|---|
| `recipe_edit_apply_v3` `if p_payload ? 'extras'` | delete 후 rows_v3 로 재삽입 → 연결 보존(qty>0). 키 없으면 무접촉. 명시적 `[]` → 전부 삭제(의도, tests/71 단언) |
| `save_recipe` no-op 비교 | shape v3 양변 동일 → apply 호출 없음(§2.4) |
| 0211 부자재 전파 | update/loop 만, delete 없음. 단가 0 → 500 복원 시 `amount_per_serving=500`·이력 +1(tests/71 단언) |
| `deactivate_material` | `materials.active=false` 만(tests/69 에서 연결 보존 단언) |
| 자유입력 행 amount 0 | 종전대로 버림(저장 자체가 안 되므로 "삭제" 가 아니라 "미생성") |
| material_id 가 qty ≤ 0 | rows_v3 에서 제외 → 제거로 취급. v2 도 금액 0 으로 버렸으므로 동일 |
| 다른 매장 material_id | `left join materials` 에 매장 필터는 없으나 v3 는 INVOKER 이고 executor 는 nobypassrls 라 RLS 로 보이지 않음 → `m.id null` → 자유입력 분기(amount 없으면 버림). 기존 v2 와 동일한 방어 |

### 2.4 no-op 불일치 점검 (추정)
- DB branch: `[material_id,qty]`(연결) / `[null,qty,name,amount]`(자유). 본문 branch(rows_v3): 같은 형태. 0원 연결이 있는 메뉴에서 앱이 같은 extras 를 다시 보내면 `[m,qty]=[m,qty]` → no-op(판본·이력·추이·e3 없음). 0213 이전에는 본문 쪽이 빈 배열이 되어 항상 "변경" 이었고, 그 결과가 곧 이번 결함이었다.
- 앱이 연결 행에 `amount:0` 을 함께 보내도 rows_v3 는 연결 행의 amount 를 무시하므로 결과 동일.
- 0212 의 자유입력 이름 제외 비교(`e->0='null'`) 는 원소 형태가 그대로라 계속 성립.

### 2.5 권한 우회 점검 (확인)
- 0213 L33–38: owner 이전(`grant create` → `alter owner` ×2 → `revoke create`), `revoke all … from public,anon,authenticated,service_role`, executor 만 execute.
- tests/16 diff: invoker allowlist 를 v2 3개 → v3 포함 5개로 **명시** 확장(와일드카드 아님), 추가 단언 "v3 내부 정규화 함수는 앱 역할에 열리지 않는다" 로 anon/authenticated/service_role EXECUTE 부재 확인. acl-final.log 두 단언 ok, "definer 함수 중 anon 이 부를 수 있는 것 = 0" 유지.
- v3 두 함수는 SECURITY INVOKER + `search_path public,pg_temp` 이며 definer facade 아래서만 실행되므로 권한 상승 표면이 없다. 직접 호출은 위 revoke 로 막힌다.
- 참고: 같은 diff 에 `record_material_configuration_change()` 가 postgres 소유 definer 목록에 추가되어 있는데 이는 0207 의 트리거 함수이지 0213 산출물이 아니다(목록 갱신 자체는 타당).

### 2.6 tests/71 (확인)
4 상태 × 5 단언 + ACL 1 = 21, 로그 21 ok. 검증 항목: 처음부터 0원인 부자재 연결 생성(`r0`), 0원 뒤 이름 수정 full save 후 연결 유지, 단가 복원 시 금액 500·자동 이력 +1, 영업 상태별 적용 시점(open/break 는 effective 300 유지, 그 외 500), 명시적 `[]` 제거 후 단가 700 변경이 전파·이력 생성 안 함, v3 helper authenticated 비공개.

## 3. 발견 사항

### R5-1 · P3 · 0213 이전에 이미 유실된 연결은 복구되지 않음 (데이터 영향, 정책 판단)
- v2 정규화는 0204(커밋 `14c1ddf` 이전 포함) 부터 dev DB 에 있었다. 0원 부자재를 연결한 메뉴를 그 사이에 full save 한 적이 있으면 연결 행은 이미 삭제되어 있고, 0213 은 함수 정의만 바꾸므로 되살리지 않는다.
- 탐지 가능성: 0209 이전에는 구성 change_line 이 없어 `entity_change_events` 로도 추적이 어렵다. 0209 이후 fresh DB 에서만 "부자재 구성" before/after 라벨로 확인 가능.
- 조치(안): dev DB 에 대해 "0원 부자재가 있고, 그 부자재를 연결한 메뉴가 0건인" 조합을 읽기 쿼리로 나열해 운영자가 수동 재연결 여부를 결정. 자동 복구는 권장하지 않음(어느 메뉴에 연결돼 있었는지 원장이 없음). 본 검수는 실행하지 않았다.

### R5-2 · P4 · 커버리지 — 0원 연결 상태의 재저장이 no-op 인지 단언 없음
- tests/71 은 이름 수정 후 연결 유지만 본다. 같은 extras 를 다시 보내는 재요청/의미상 무변경에서 `edit_revision`·이력·추이가 그대로인지(§2.4 의 핵심 효과) 단언을 추가하면 회귀 방지가 된다(tests/68 의 "재요청·무변경" 패턴 재사용 가능).

### R5-3 · P4 · 커버리지 — 자유입력 0원 행의 종전 동작 유지 단언 없음
- rows_v3 의 두 번째 분기(`m.id is null and amount<>0`) 가 회귀하지 않았음을 보이는 단언이 없다. `{name:'기타', amount:0}` 이 저장되지 않고 shape 에도 나타나지 않는지 1건이면 충분.

### R5-4 · 범위 밖 미확인 · 앱이 0원 연결 행을 extras 페이로드에 포함해 보내는지
- 0213 은 DB 가 받은 본문을 보존한다. 앱(RecipeDetail/편집 화면) 이 금액 0 인 부자재 행을 클라이언트에서 걸러 보내면 같은 증상이 재현된다. 본 R5 는 지정된 세 파일과 로그만 읽었으므로 앱 코드는 확인하지 않았다. ROOT 가 앱 payload builder 를 한 번 확인하기를 권고.

## 4. 미해결·전제

- F3(국제 세금 자동 이력)·구매가/용량 계약(최종 사용자 답변 대기)·F8·R4-1(기존 extras 이름 backfill) 은 그대로.
- 전체 SQL 실행은 갱신 중이므로 0213 의 전체 회귀(특히 56/61/62 의 receipt·shape 의존 시험) 는 본 문서에서 판정하지 않는다. 단독 로그 2건(tests/71, tests/16) 만 근거다.