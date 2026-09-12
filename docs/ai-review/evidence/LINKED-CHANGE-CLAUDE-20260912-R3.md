# 변경 전파·수정 사유 검수 — Claude 독립 검수 R3 (2026-09-12)

상태: 수정된 두 범위(자동 상태 전환 캐시, 0209 구성 이력)만 읽기 전용 검수. R1/R2 보존. 공식 게이트 대체 아님.
HEAD `d33b3fa` 미커밋 작업본. 읽은 파일 SHA(앞 16자): 0209 `a265a5ddd4be37e6`(16:12:56), tests/68 `90cb5b6deb636280`, businessDay.ts `4231a8f85791bb8e`, queryClient.ts `db1c5a753b2806fd`, recipeTaxBusinessDayInvalidation.test.tsx `d35a42995234b1de`. 로그: composition-before(0/1)→after(1/1, 25 ok), poll-before(2 실패)→poll-after(22 통과), status-local-apply(0208 schema_migrations 행 삽입·commit), status-db-tests-final(67, 12 ok).

## 1. 자동 상태 전환 캐시 — 종결(잔여 P4 1건)

- `queryClient.ts` `invalidateBusinessDayConsumers`: `invalidateOn.businessDay()`의 키 prefix에 걸리는 활성 쿼리를 predicate로 무효화하되 `qk.businessDay=['sales','business-day']` prefix는 제외. `qk.sales=['sales']`가 businessDay를 포함하지만 제외 조건이 먼저 걸려 자기 취소·반복이 없다(확인). `qk.configurationHistory`가 `invalidateOn.businessDay`에 추가돼 설정 링크 대기도 폴링으로 갱신된다.
- `businessDay.ts:154–156`: 감지 조건이 status/localDate에 businessDayId/businessDate까지 확장돼 다른 기기의 새 영업일 시작도 잡는다. `previous`는 queryFn 안에서 `getQueryData`로 읽으므로 첫 조회에는 무효화가 없고, 이후 변화 시에만 소비자 갱신(시험 L66–71 "unchanged status does not refetch consumers again").
- 시험 5건: open/break에서 서버 관측 종료가 mutation 없이 quote·history를 갱신, 무변화 시 재요청 없음, 실패한 open/catch-up이 fetch 수를 바꾸지 않음. poll-after 22/22.
- 잔여 **P4**: 이 기기에서 수동 전이하면 mutation onSuccess의 `invalidate(invalidateOn.businessDay())`가 소비자를 한 번 갱신하고, 이어지는 businessDay 재조회가 상태 차이를 보고 `invalidateBusinessDayConsumers`로 한 번 더 갱신한다(중복 요청, 결과는 정확). 원하면 onSuccess는 `qk.businessDay`만 무효화하고 나머지는 queryFn의 diff에 맡기면 된다. ≤60초 폴링 지연은 설계 한계로 문서화 대상.

## 2. 0209 구성 이력 — 종결(잔여 P3 1, P4 2, 미확인 1)

확인한 것:
- **봉인 helper 보존**: v2 본문을 CRLF 정규화 후 이름만 v3로 바꿔 복사(L23–27), 앵커 4곳을 각각 정확히 1회 치환(L30/37/47/51/63 계수 검사), v2는 그대로 남고 facade만 `recipe_edit_apply_v2(p_store,v_body ||`→v3로 교체(L67–70). CAS·receipt·no-op 판정은 facade 앞단에 그대로 있다.
- **같은 금액 구성**: `v_composition := shape0.lines ≠ shape1.lines or shape0.extras ≠ shape1.extras`(L42–43)를 `v_money`에 OR(L49–52)해 affects_sales=true. `recipe_edit_shape_v2`는 정렬된 다중집합이라 순서 변경은 잡지 않고, facade의 no-op 판정이 먼저 걸려 v3에 도달하지 않는다. 시험 68: 식재료·부자재 같은 금액 교체 4상태 모두 사건 1·direct·affects true·`before "기존 된장 100g"→after "새 된장 100g"`, open/break에서 `has_pending_change=true`, 그 외 false.
- **no-op/receipt 재호출**: 같은 request_id 재호출과 새 request_id 무변경 호출 모두 사건·추이·판본 불변(L53–60, 4상태 ok).
- **snapshot 보존**: open/break에서 저장 후 `business_days.snapshot` 동일(L62–63 ok).
- **종료 후 추이 중복**: 종료 시 0206 루프는 금액 5요소가 같으면 recompute하지 않으므로 같은 금액 교체는 추이 0(L67–69 ok). 종료 후 `has_pending_change=false`.
- **ACL/우회**: `recipe_composition_labels`·v3는 executor 전용, owner 이전은 기존 grant create→owner→revoke 패턴(L74–78), 시험 L73–75가 authenticated 실행 불가 확인. `assert_no_rpc_overloads` 통과. 새 공개 RPC 없음.
- 카테고리 변경은 direct 줄만 추가되고 v_money에 들어가지 않아 affects false(의도와 일치).

잔여:
- **R3-1 · P3 · 즉시 모드 같은 금액 교체가 금액 동일한 profit_trends 행을 만든다.** v3는 legacy 본문의 `recompute_recipe` 호출을 그대로 상속하고, `recompute_recipe`는 append-only로 직전 행과 같아도 삽입한다(0083:189–216). before_open/closed에서 같은 금액 교체 1회 = 추이 +1(값 동일). 시험 68은 replay/no-op 전후 추이만 검사해(L52, L59) 교체 직후 추이 수는 단언하지 않는다. F2/F10과 같은 유형이며 0209가 새로 만든 결함은 아니다. 수정: `recompute_recipe`에서 `v_row`의 price/material/extra/tax/fixed가 `v_prev`와 모두 같으면 삽입 생략(첫 기준선 제외) — F2/F10을 한 곳에서 함께 해결한다. 회귀: 즉시 상태 같은 금액 교체·부자재 이름만 변경·같은 합계 고정지출 → 추이 0.
- **R3-2 · P4 · 사용자 정의 부자재 이름만 바꿔도 구성 변경으로 잡힌다.** shape의 비-material extras 벡터가 `[null,qty,name,amount]`라 이름 변경이 `v_composition`=true → affects_sales=true → 영업 중 대기 표시. 판매 소진·원가 무관. 필요하면 v3에서 extras 비교 시 name을 제외한 벡터로 재비교.
- **R3-3 · P4 · 라벨 이름 stale.** `recipe_composition_labels`는 `recipe_extra_costs.name`을 쓰는데 EDGE 관찰대로 부자재 마스터 이름 변경 시 이 열은 옛 이름을 유지한다. material_id가 있으면 `materials.name`을 join해 표기.
- **미확인**: 0209를 포함한 전체 SQL 스위트(69+1) 실행 로그가 없다(composition-after는 68 단독). `56_recipe_edit_roundtrip`·runner first-gate가 facade 본문/helper md5를 고정하고 있다면 v3 교체로 기대값 갱신이 필요할 수 있다 — dev 적용 전 전체 스위트 필수. facade 앵커 `v_body ||`는 fresh DB 실행 성공으로만 확인했고 배포 facade 원문은 읽지 않았다.

## 3. 0208 로컬 적용 확인
`status-local-apply.log`는 0208 트랜잭션 commit과 `schema_migrations` 행 삽입(`20260912000208|application_status_summary`, t)을 보여 준다. `status-db-tests-final.log` 67 시험 12 ok(부자재 단가만 바뀐 메뉴 대기, 미연결 메뉴 비대기 포함). "백업 후 적용"의 백업 파일은 폴더에 `before-0207.dump`만 있고 0208 직전 dump는 보이지 않는다 — 다른 경로에 있다면 기록 위치만 남겨 주면 된다.

## 4. 종합
두 범위 모두 요청한 항목(ACL·helper 우회·같은 금액 구성·no-op/receipt·snapshot 보존·종료 후 추이 중복)에서 결함 없음. 남는 것은 즉시 모드의 무변화 추이(R3-1, 기존 유형)와 P4 2건, 전체 스위트 미실행이다. F1/F2/F3/F10·참고 구매가 계약은 이번 범위 밖으로 미해결 유지.