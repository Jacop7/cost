# 판매 채널 가변화·매출 연동 상세 계획안

> 상태: Claude 1차·Astra Ultra 독립 검수 반영본  
> 범위: `C:\Users\jacop\프로젝트\식자재관리앱` 저장소 한정  
> 운영 DB 배포: 범위 밖  
> 목표: 판매 채널을 이름 수정 없이 최대 5개까지 추가·삭제하고, 메뉴 판매 수량·기타 매출·일별 손익·매출 분석·세금·재고 원장을 같은 서버 계약으로 연결한다.

## 1. 확정 제품 규칙

1. 신규 매장은 기존과 동일하게 `매장(hall)`, `배달(delivery)`, `포장(takeout)` 3개를 기본 생성한다.
2. 활성 판매 채널은 기본 3개를 포함해 매장당 최대 5개다. 따라서 최초 상태에서는 사용자 채널을 2개 더 추가할 수 있다.
3. 채널 이름은 생성 후 수정할 수 없다. 오타나 명칭 변경은 기존 채널 삭제 후 새 채널 추가로 처리한다.
4. 기본 3개도 사용하지 않으면 삭제할 수 있으며 다른 채널과 같은 보존 규칙을 적용한다.
5. 판매·세금·완료 판본·초안 기준 manifest 어디에도 참조되지 않은 채널만 완전 삭제할 수 있다.
6. 위 참조 이력이 하나라도 있는 채널은 `active=false`, `retired_at`으로 사용 중지한다. 과거 판매·손익·세금 화면과 수정 초안에서는 당시 이름과 금액을 계속 표시한다.
7. 삭제된 이름을 다시 추가하면 사용 이력이 있는 동일 채널을 복구한다. 새 ID를 만들어 같은 이름의 과거·현재 채널을 겹치게 하지 않는다.
8. 활성 채널은 최소 1개를 유지한다.
9. 같은 매장의 활성·사용 중지 채널 이름은 공백 정규화와 대소문자 무시 기준으로 중복을 허용하지 않는다.
10. `editing` 또는 `pending_inventory_resolution` 상태의 매출 초안이 하나라도 있으면 채널 추가·삭제·복구를 모두 막는다.
11. 화면 비활성화만으로 끝내지 않는다. 초안 생성과 채널 변경 RPC가 같은 매장 범위 잠금을 잡고 서버에서 경합을 차단한다.
12. 플랫폼·배달 수수료는 채널 설정으로 되돌리지 않는다. 기존처럼 고정 지출에서만 관리한다.

사용자 안내 문구:

> 작성 중인 매출이 있어 판매 채널을 변경할 수 없습니다. 매출 작성을 완료하거나 초기화한 뒤 다시 시도해 주세요.

판매 이력이 있는 채널 삭제 안내:

> 이 채널은 판매 기록이 있어 과거 내역에는 유지됩니다. 삭제 후에는 새 매출 작성에서 표시되지 않습니다.

## 2. 현재 구조와 확인된 결함

현재 계약은 표시만 세 채널인 것이 아니라 저장·계산·세금까지 `hall`, `delivery`, `takeout`에 고정돼 있다.

- `daily_sales_items`는 `qty_hall`, `qty_delivery`, `qty_takeout` 세 컬럼만 가진다.
- 앱의 `ChannelCode`와 `CHANNEL_LABEL`도 세 코드의 합집합으로 고정돼 있다.
- `save_channel`은 새 코드가 세 값 중 하나가 아니면 거절한다.
- 매출 작성의 메뉴 판매량과 기타 매출은 설정 목록이 아니라 고정 `CHANNEL_LABEL`을 그린다.
- MY의 `active=false`는 매출 작성 입력 목록에서 실제로 빠지지 않는다.
- 현재 이름 수정은 `sales_channels.name`을 바로 갱신한다. 기간 손익은 현재 이름을 조인하므로 과거 표시명이 함께 바뀐다.
- 기타 매출 상세 일부는 DB 이름이 아닌 앱의 고정 이름표를 사용해, 이름 수정 결과가 화면마다 다르다.
- 국제 세금의 채널 타입은 `international_sales_channel_code` enum 세 값으로 고정돼 있다.
- 채널 손익 계산 일부는 `hall`, `delivery`가 아닌 코드를 `takeout`으로 처리한다. 채널 행만 추가하면 포장 매출이 새 채널에도 중복될 수 있다.

따라서 기존 테이블에 채널 두 행을 추가하는 방식은 금지한다.

## 3. 목표 데이터 모델

### 3.1 판매 채널

`sales_channels`의 UUID를 사용자 채널의 불변 식별자로 사용한다.

- `id uuid`: 불변 키
- `store_id uuid`
- `name text`: 생성 후 불변
- `normalized_name text`: 중복 검사 전용
- `sort_order int`
- `active boolean`
- `retired_at date null`: 현재 DDL 형식을 유지한다.
- `created_at timestamptz`
- 채널 목록 CAS는 전용 `store_sales_channel_state.revision`을 사용한다. 전역 `settings.revision`과 분리해 다른 설정 저장과 충돌하지 않게 한다.

기존 `code text not null unique`는 전환 기간의 기본 3개 식별용으로만 유지한다. 사용자 채널은 `custom_<하이픈 없는 UUID>` 형식의 불변·비표시 호환 코드를 서버에서 생성하며, 계산·이름·정렬의 권위 키로 사용하지 않는다.
신규 매장 시드는 `hall=매장`, `delivery=배달`, `takeout=포장` 순서로 만들고 세 채널 모두 활성화한다. 기존 매장은 같은 코드의 기존 UUID와 현재 이름을 보존해 과거 연결을 끊지 않는다.

앱 역할은 `sales_channels`를 직접 INSERT/UPDATE/DELETE/TRUNCATE할 수 없다. 신규 migration에서 `anon`, `authenticated`의 해당 권한과 직접 DML RLS policy를 회수하고, `sales_channels_rpc_only` 방어 trigger와 이름 불변 trigger를 둔다. 정규화 이름 unique index와 활성 1~5개 검증은 RPC 트랜잭션 안에서만 변경 가능하게 한다.

### 3.2 초안 메뉴별 채널 수량

새 테이블 `sales_draft_menu_channel_quantities`:

- `draft_menu_line_id uuid`
- `sales_channel_id uuid`
- `quantity numeric >= 0`
- 기본키: `(draft_menu_line_id, sales_channel_id)`

초안 화면과 저장 API는 고정 `qtyHall/qtyDelivery/qtyTakeout` 대신 채널 ID별 행 배열을 사용한다.

### 3.3 확정 메뉴별 채널 수량

새 테이블 `daily_sales_item_channel_quantities`:

- `daily_sales_item_id uuid`
- `sales_channel_id uuid`
- `channel_name_snapshot text`
- `quantity numeric >= 0`
- 기본키: `(daily_sales_item_id, sales_channel_id)`

과거 화면은 현재 `sales_channels.name`을 조인하지 않고 `channel_name_snapshot`을 표시한다.
완료 판본·판매·기타 매출·세금에 참조된 채널 UUID 외래키는 `ON DELETE RESTRICT`로 보호하며 연쇄 삭제하지 않는다.

### 3.4 기타 매출

신규 작성분의 기타 매출은 항목당 다음 값을 확정한다.

- `sales_channel_id`
- `channel_name_snapshot`
- `name_snapshot`
- `unit_price`
- `quantity`
- 세금 quote와 구성 항목별 반올림 결과

장기 권위는 정규화된 `daily_sales_etc_lines`로 옮긴다. 기존 `daily_sales.etc_items`와 `etc_tax_snapshot`은 전환 전 기록 읽기용으로 유지하고 신규 읽기는 정규화 행을 우선한다.

### 3.5 세금 원장

`daily_sales_item_tax_snapshots`, `sales_tax_events`, `channel_tax_remittance`의 고정 enum 연결을 채널 UUID 연결로 전환한다.

- 확정 스냅샷과 세금 이벤트에는 `sales_channel_id`와 `channel_name_snapshot`을 함께 보존한다.
- 기존 append-only `sales_tax_events`는 UPDATE하지 않는다. legacy enum 코드와 채널 UUID를 연결하는 감사된 매핑을 두고, 신규 UUID 이벤트는 별도 v2 원장 또는 명시적 포맷 버전으로 기록한다.
- 기존 스냅샷도 원본을 덮어쓰지 않고 legacy mapping/link 또는 새 판본을 통해 읽는다. 이관은 원본 hash·행 수·항목별 합계 영수증을 남긴다.
- 세금 계산선은 `영업일 × 메뉴 × 판매 채널 × 세금 구성 항목`을 유지한다.
- 채널 삭제는 기존 세금 스냅샷·이벤트를 삭제하거나 다시 계산하지 않는다.
- 사용된 세금 프로필의 자식 행은 봉인되므로 채널 추가 시 기존 `channel_tax_remittance`에 행을 삽입하지 않는다.
- 세금 프로필은 구성 항목별 기본 납부 주체와 선택적 채널 UUID override를 갖는 판본형 규칙으로 바꾼다. 신규 채널은 기본 납부 주체를 사용하며, 채널별 override가 필요하면 기존 프로필을 수정하지 않고 새 적용일의 프로필 판본을 만든다.
- 기존 기본 3개 remittance 행은 전환 프로필의 override로 보존한다. 실제 판매 시 해석된 납부 주체는 채널 UUID·이름과 함께 판매 스냅샷에 고정한다.
- `current_recipe_tax_quote`, 메뉴 초안 미리보기처럼 현재 `hall`을 대표 채널로 고정한 함수는 사용자 채널과 무관한 프로필 기본 규칙을 사용하도록 바꾼다. 기본 `hall` 채널 삭제 여부가 메뉴 견적을 바꾸면 안 된다.

## 4. 잠금과 상태 전이

채널 변경 RPC와 `open_sales_draft`는 반드시 기존 공통 권위 함수 `lock_store_write_scope(p_store)`를 먼저 호출한다. 별도 설정 행 잠금 체계를 만들지 않는다.

1. `lock_store_write_scope(p_store)`
2. 같은 잠금 범위에서 `expire_sales_drafts(p_store)` 실행
3. 대상 채널 행 잠금(삭제·복구일 때)

채널 변경 RPC는 잠금 안에서 다음을 다시 검사한다.

- 소유 매장인지
- 만료 처리 뒤 `sales_day_drafts.status in ('editing','pending_inventory_resolution')`가 없는지
- `sales_day_drafts.status in ('editing','pending_inventory_resolution')`가 없는지
- 활성 채널 수가 1~5 범위인지
- 정규화 이름이 중복되지 않는지
- 삭제 대상의 판매·세금·기타 매출·완료 판본과 모든 상태(`editing`, `pending_inventory_resolution`, `finalized`, `discarded`, `expired`)의 초안 manifest·자식 행 참조 이력이 있는지
- 요청 revision이 최신인지

`open_sales_draft`도 같은 매장 잠금 안에서 활성 채널 목록을 기준 판본에 포함한다. 채널 변경 검사와 초안 생성 사이의 check-then-act 경합을 허용하지 않는다.
채널 목록은 `build_day_snapshot`과 `sales_normalize_basis_manifest`가 만드는 초안 basis manifest의 정식 구성 요소다. migration `0112`의 basis publish/guard trigger도 `sales_channels` 변경을 추적한다. 채널 변경은 새 basis revision을 발행하고 이전 basis 초안을 stale 처리하며, 매장이 `freezing` 상태면 채널 변경을 거절한다.

채널 허용 목록은 초안 종류에 따라 다르다.

- 신규 영업일 초안: 초안을 여는 시점의 활성 채널 목록을 기준 판본에 봉인한다.
- 완료 매출 수정 초안: 현재 활성 목록을 새로 적용하지 않고, 수정 대상 `sales_day_version`에 저장된 당시 채널 목록과 이름 스냅샷을 복제한다.
- 수정 초안에서는 이후 사용 중지된 채널도 기존 날짜의 수량 증가·감소·0원 취소 정정에 사용할 수 있다.
- 수정 대상 판본에 없던 현재 신규 채널을 과거 날짜에 끼워 넣지 않는다.
- 저장·완료 RPC는 채널의 현재 `active` 여부가 아니라 해당 초안의 봉인된 채널 manifest 소속 여부를 검증한다.

권장 서버 오류 detail:

- `SALES_CHANNELS_LOCKED_BY_DRAFT`
- `SALES_CHANNEL_LIMIT_REACHED`
- `SALES_CHANNEL_MINIMUM_REQUIRED`
- `SALES_CHANNEL_NAME_DUPLICATE`
- `SALES_CHANNEL_REVISION_CONFLICT`

## 5. 계산 계약

### 5.1 메뉴 판매와 재고

- 메뉴 총 판매 수량 = 모든 채널 수량 합계
- 판매 매출 = 판매가 스냅샷 × 채널 수량
- 재료·부자재 소진량 = 메뉴 1개 필요량 × 모든 채널 판매 수량 합계
- E8/E9의 증감 수량도 채널 합계의 이전 목표와 새 목표 차이로 계산한다.
- 조리 후 폐기는 판매 채널에 귀속하지 않으며 기존 `qty_waste` 계약을 유지한다.

### 5.2 기타 매출

- 기타 매출 한 줄은 반드시 하나의 채널에 귀속한다.
- 매출·순매출·세금은 해당 항목의 가격·수량·채널 세금 quote로 계산한다.
- 전환 전 `channel`이 없는 행만 `채널 미지정`으로 남긴다. 새 입력에는 미지정을 허용하지 않는다.

### 5.3 일별 손익과 기간 분석

- 일별 손익, 매출 분석, 채널별 손익은 같은 서버 확정 판본과 같은 채널 행을 읽는다.
- 채널 매출 = 메뉴 채널 매출 + 해당 채널 기타 매출
- 채널 재료비는 해당 채널 메뉴 판매 수량으로 정확히 계산한다.
- 고정 지출·추가 지출·채널에 직접 귀속할 수 없는 손실은 당일의 채널 귀속 매출 비중으로 배분한다.
- 배분 분모에는 채널이 지정된 메뉴 매출과 기타 매출을 모두 포함한다.
- 전환 전 채널 미지정 매출은 어떤 채널에도 추정 배분하지 않고 `미지정`으로 별도 보존한다.
- 채널 귀속 매출 합계가 0인 날의 고정 지출·추가 지출·폐기 손실은 임의 채널에 넣지 않고 `unallocated_fixed_cost`, `unallocated_daily_extra`, `unallocated_waste_loss`로 반환한다.
- 매출·순매출·세금·비용·손익 각 항목에서 `채널 합계 + 채널 미지정 + 미배분 = 일별/기간 총합`이 성립해야 한다. 고정 지출 미확정 `null`은 0으로 바꾸지 않고 각 합계 층에서 그대로 유지한다.
- 채널별 배분 합계와 일별/기간 총합의 통화 minor unit 차이는 마지막 유효 채널에 결정적으로 배정하고, 합계 불변 시험을 둔다.
- 여기서 반올림 잔액 대상은 `귀속 매출 > 0`인 채널 중 `(sort_order, sales_channel_id)` 오름차순의 마지막 채널로 고정한다. 대상이 없으면 해당 잔액도 `미배분` bucket에 둔다.

### 5.4 세금

- 세금 포함 판매가는 채널별 수량과 구성 항목별로 세액을 분리하고 순매출에서 차감한다.
- 세금 별도 판매가는 판매가를 순매출로 유지하고 고객 결제액에 세금을 더한다.
- 구성 항목별 반올림 후 합산하는 현재 국제 세금 계약을 유지한다.
- 채널 추가·삭제가 과거 세금 quote, 순매출, 고객 결제액을 변경하면 안 된다.

## 6. API와 앱 계약

### 6.1 설정 API

기존 `save_channel`의 이름 수정 경로를 폐기하고 목적별 RPC로 분리한다.

- `create_sales_channel(store_id, name, expected_channel_revision)`
- `delete_sales_channel(store_id, channel_id, expected_channel_revision)`
- `restore_sales_channel(store_id, channel_id, expected_channel_revision)`
- `sales_channel_settings(store_id)`

삭제 응답은 `deleted` 또는 `retired`를 명시한다.

### 6.2 매출 API

고정 수량 객체를 다음 배열 계약으로 교체한다.

```json
{
  "recipe_id": "uuid",
  "channels": [
    { "sales_channel_id": "uuid", "quantity": 5 }
  ],
  "qty_waste": 0
}
```

기타 매출도 `sales_channel_id`를 받는다. 서버는 타 매장 채널과 해당 초안의 봉인된 채널 manifest에 없는 채널을 거절한다. 신규 초안의 manifest에는 활성 채널만, 과거 수정 초안의 manifest에는 수정 대상 판본의 당시 채널이 들어간다.

서버에는 `sales_item_channel_rows(item)`에 해당하는 단일 채널 권위 resolver를 둔다. `channel_storage_version`이 신규이면 행이 0개여도 행 구조만, legacy이면 검증된 구형 3열만 읽는다. 아래 함수·계약은 같은 migration 묶음에서 이 resolver를 사용하도록 함께 전환한다.

- `apply_sale_items`, 3수량 인자의 `e10_sale_recorded`, `finalize_sales_draft` item assembly
- `sales_draft_matches_committed`, `sales_draft_inventory_deltas`, `sales_draft_payload`
- `day_sales_detail`, `sales_day_versions.payload`, `sales_range`, `range_menu_detail`
- `sales_authoritative_range_detail`, `sale_shortages`, `day_menu_detail`
- `sales_etc_by_channel`, `sales_channel_fixed`, `channel_net_sales`
- `sales_tax_breakdown`, `sales_waste_breakdown`
- 국제 세금 enum 반복부, 세금 snapshot/event/remittance key 생성부

레거시 기타 매출의 `null`/빈 채널은 `hall`로 추정하지 않고 `unassigned`로 확정한다. 비교·백필·일별·기간 읽기 모두 같은 의미를 사용해 과거 매출 수정 초안을 열었다 닫는 것만으로 변경 판본이 생기지 않게 한다.

### 6.3 앱 화면

신규 입력 화면은 서버의 현재 활성 채널 배열을 사용하고, 과거 조회·수정 화면은 완료 판본 또는 수정 초안의 당시 채널 배열을 사용해야 한다.
활성 채널 한도는 현재 설정에만 적용한다. 채널 교체가 누적된 기간 분석에는 과거 채널이 5개를 초과해 표시될 수 있으며 합치거나 숨기지 않는다.

- MY 판매 채널: 추가·삭제·복구, 이름 수정 없음, `n/5` 표시
- 매출 작성 판매 수량
- 매출 작성 기타 매출 판매 수량
- 작성 중 미리보기
- 일별 손익과 채널별 매출
- 매출 분석과 채널별 손익
- 메뉴 손익의 채널 구성
- 과거 매출 수정

작성 중 초안이 있으면 MY 화면의 추가·삭제 버튼을 비활성화하고 서버가 반환한 동일 사유를 표시한다.

## 7. 이관 순서

### 단계 A — 스키마와 이관 기반

1. 새 채널 수량·기타 매출·세금 연결 컬럼/테이블과 `store_sales_channel_state` 추가
2. 기본 3개 채널 UUID 확인 및 누락 매장 보정
3. `qty_hall`, `qty_delivery`, `qty_takeout`을 새 행으로 백필
4. 기존 기타 매출 JSON의 채널 코드를 채널 UUID·이름 스냅샷으로 백필
5. 기존 세금 스냅샷과 이벤트를 UUID 채널로 연결
6. 백필 합계가 원본과 같은지 매장·일자·메뉴별 검증
7. 기존 완료 판본과 열려 있는 수정 초안에 당시 채널 manifest를 백필하고, 이후 사용 중지된 채널이 수정 화면에서 사라지지 않는지 검증
8. `normalized_name` 유일 제약 전에 매장별 기존 이름을 정규화해 중복을 감사한다. 충돌은 자동 병합·자동 개명하지 않고 별도 이관 충돌 영수증을 남기며 해당 매장 cutover를 중단한다.
9. 과거 판매 시점 이름을 복원할 원자료가 없는 백필은 `channel_name_quality=legacy_current_name`으로 표시한다. 신규 확정분만 `captured_at_sale` 품질을 갖는다.
10. `sales_channels` 앱 역할 직접 DML 권한·policy를 제거하고 RPC-only/이름 불변 trigger, 정규화 unique index, `ON DELETE RESTRICT`를 적용한다.
11. `build_day_snapshot`, `sales_normalize_basis_manifest`, migration `0112`의 basis publish/guard 계약에 채널 목록을 넣고 `freezing` 변경 차단을 적용한다.
12. 구형 `save_channel`·`retire_channel` 실행 권한을 제거하고 ACL allowlist를 신규 목적별 RPC만 허용하도록 갱신한다.

### 단계 B — 서버 이중 읽기와 신규 쓰기

1. 신규 RPC는 행 기반 구조에만 쓴다.
2. `행 존재 여부`로 신규/구형을 판정하지 않는다. 신규 0건·전액 취소와 미이관 데이터를 구분하도록 `channel_storage_version` 또는 동등한 서버 권위 마커를 영업일·초안·완료 판본에 저장한다.
3. 마커가 신규 권위면 채널 행이 0개여도 구형 `qty_*`·JSON으로 폴백하지 않는다. 그래야 전액 취소 뒤 구형 수량이 부활하지 않는다.
4. 마커가 legacy이고 백필 영수증이 없는 기록에만 기존 세 컬럼/JSON 폴백을 허용한다.
5. 초안 기준 판본에 허용 채널 목록과 revision을 포함한다.
6. 채널 변경·초안 생성 공통 잠금을 적용한다.
7. 신규 payload에 채널 계약 버전을 넣고, 동적 채널 cutover가 완료된 매장에서는 구형 `qty_hall/qty_delivery/qty_takeout` payload를 `CLIENT_UPGRADE_REQUIRED`로 쓰기 전에 거절한다.
8. 기존 `save_channel`·`retire_channel`의 앱 실행 권한을 회수하거나 새 공통 가드 RPC로만 위임한다. 구형 앱이 이름 수정·무잠금 사용 중지를 되살릴 수 없어야 한다.
9. 전환용 DB는 구형·신형 읽기를 지원하되, 매장 cutover 이후에는 새 writer 하나만 권위가 된다. 5채널 활성화보다 payload capability gate가 먼저 배포돼야 한다.
10. cutover는 `legacy_active → draining → dynamic_active` 상태로 진행한다. `draining`에서 신규 구형 쓰기를 막고 기존 미확인 영수증을 조회·종결한 뒤 열려 있는 초안을 새 포맷으로 이관한다.
11. 구형 요청 키와 payload hash는 보존한다. cutover 전 시작한 요청은 결과 확인만 허용하며 다른 계약 버전으로 자동 재실행하지 않는다.
12. 백필·합계 검산·권위 마커·writer 전환을 매장 단위 영수증으로 묶고, 일부 단계 실패 시 `dynamic_active`를 공개하지 않는다.
13. legacy 기타 매출의 `null`/빈 채널은 `unassigned`로 idempotent 백필하며, `sales_draft_matches_committed`를 포함한 모든 읽기·비교 함수가 이를 동일하게 해석한다.

### 단계 C — Expo 화면 전환

1. 공용 `SalesChannel` 모델과 동적 채널 목록 훅 도입
2. 판매 수량·기타 매출 입력을 ID 기반 배열로 전환
3. 일별·기간·메뉴·채널 상세의 고정 라벨 제거
4. MY 채널 화면에서 이름 수정 제거, 추가·삭제·복구 제공
5. 작성 중 차단 상태와 최대 5개 안내 적용
6. 고정 채널을 참조하는 `features/sales/lifecycle.ts`, `channels.ts`, `recipes/draftPreviewContract.ts`, `priceSimulationContract.ts`, `international-tax/contracts.ts`, `changes/configurationHistory.ts`와 관련 화면·훅을 함께 전환한다.

### 단계 D — 구형 경로 봉인

1. 모든 신규 저장이 새 행 구조를 쓰는지 관측
2. 기존 세 수량 컬럼과 enum을 읽기 호환 전용으로 표시
3. 충분한 운영 검증 전에는 구형 컬럼을 삭제하지 않는다.
4. 운영 DB 적용은 별도 배포 계획과 승인 뒤 진행한다.

## 8. 필수 시험

### DB 계약

- 기본 3개 백필 후 메뉴·채널·일별·기간 총합 불변
- `anon`/`authenticated`의 Data API 직접 INSERT/UPDATE/DELETE/TRUNCATE와 이름 변경이 거절되고 목적별 RPC만 허용됨
- 기타 매출을 포함한 채널 합계 불변
- 국제 세금 포함/별도 및 구성 항목별 반올림 불변
- 5개 활성 성공, 6번째 거절
- 마지막 활성 채널 삭제 거절
- 미사용 채널 완전 삭제
- 사용 채널 soft delete 및 과거 이름·합계 보존
- 삭제 이름 재추가 시 기존 채널 복구
- 작성 중/재고 처리 대기 초안이 있으면 추가·삭제·복구 거절
- 만료 초안은 공통 잠금 안에서 만료 처리된 뒤에만 채널 변경을 허용하고, `finalized/discarded/expired` 초안 자식 행이 참조하는 채널은 hard delete되지 않음
- 초안이 먼저 잠금을 얻으면 삭제는 `SALES_CHANNELS_LOCKED_BY_DRAFT`로 거절되고, 삭제가 먼저 커밋하면 초안은 변경 후 채널 목록으로 정상 생성되는 두 순서를 모두 검증
- 활성 4개에서 서로 다른 채널 두 개 동시 생성 시 하나만 성공하고 최종 활성 수가 5
- 활성 5개에서 사용 중지 채널 복구 거절
- 활성 2개에서 서로 다른 채널 두 개 동시 삭제 시 하나만 성공하고 최소 1개 유지
- 정규화 동일 이름의 생성 대 생성, 생성 대 복구 동시 요청에서 하나만 같은 UUID로 확정
- 재시도 idempotency와 revision 충돌
- 동적 채널 cutover 뒤 구형 3열 payload가 새 채널 수량을 0으로 덮지 못하고 업그레이드 오류로 종료
- 신규 권위 마커에서 채널 수량 0행·전액 취소·기타 매출 전체 삭제 후 구형 값으로 폴백하지 않음
- `build_day_snapshot` 채널 변경이 새 basis를 발행하고 이전 초안을 stale 처리하며, `freezing` 단계에서는 채널 변경이 거절됨
- legacy 기타 매출 `null`/빈 채널 백필을 반복해도 결과가 같고, 이를 포함한 과거 수정 초안을 무변경 완료해도 새 판본이 생기지 않음
- 구형 3열과 신규 행이 섞인 이관 구간에 `sales_range`, feed, fixed, net, tax가 공통 resolver로 같은 합계를 반환함
- 이미 판매에 사용된 봉인 세금 프로필에서 신규 채널 추가, 예약 프로필이 있는 상태의 추가·복구, `hall` 삭제 후 메뉴 견적 불변
- 판매량은 0이지만 완료 판본 manifest에 참조된 채널이 hard delete되지 않고 soft retire되며 과거 수정 가능
- 귀속 매출 0인 날의 폐기 손실·추가 지출, 미지정 기타 매출, 미확정 고정비 `null`에서 `채널 + 미지정 + 미배분 = 총합`
- 채널 교체가 누적돼 역사 채널이 6개 이상인 기간 조회의 전 채널 표시와 합계 불변
- 타 매장 채널 사용·삭제 거절
- E8/E9 재고 이벤트 합계가 채널 수와 무관하게 정확함

### 앱 계약

- 활성 채널만 새 판매 입력에 표시
- 사용 중지 채널은 과거 상세에 당시 이름으로 표시
- 사용 중지 채널이 들어 있는 완료 매출을 수정할 때 당시 채널 수량을 그대로 불러오고 증가·감소·취소 가능
- 과거 수정 초안에는 그 판본 이후 새로 추가된 채널이 나타나지 않음
- 채널 교체가 누적돼 기간 내 역사 채널이 6개 이상이어도 모두 표시되고 총합이 유지됨
- 판매 수량과 기타 매출이 같은 동적 채널 목록 사용
- 작성 중 MY 추가·삭제 버튼 차단 및 안내
- 320px·글자 2배에서 최대 5개 채널 입력 가능
- 채널 1개·3개·5개, 기타 매출만 있는 날, 메뉴 매출만 있는 날 표시

### 전체 게이트

- `corepack pnpm verify`
- DB fresh migration과 업그레이드 경로
- 채널 변경 대 초안 생성 2세션 경합 시험
- 별도 2세션 스크립트로 생성 대 생성, 생성 대 복구, 삭제 대 초안 생성, 만료 대 채널 변경의 잠금 결과 검증
- 웹 번들
- 네이티브 기기 증빙은 현재 프로젝트 규칙에 따라 advisory 결과를 별도 보존

## 9. 완료 기준

1. 모든 신규 매출 입력과 확정 원장이 채널 UUID 행 구조를 사용한다.
2. 판매 수량·기타 매출·일별 손익·매출 분석의 채널별 금액과 수량이 같은 서버 확정값으로 일치한다.
3. 채널 추가·삭제 전후에 과거 매출·세금·손익이 바뀌지 않는다.
4. 작성 중 채널 변경 경합이 DB에서 차단된다.
5. 최대 5개·최소 1개·이름 불변·삭제/복구 규칙이 앱과 DB에서 동일하다.
6. 전체 필수 게이트를 통과하고 Claude·Astra Ultra의 차단 Finding이 없다.

## 10. 검수 요청 사항

Claude와 Astra Ultra는 다음을 독립적으로 판정한다.

1. 이름 불변과 삭제/복구 정책이 과거 원장 보존에 충분한가
2. 작성 중 변경 차단의 잠금 순서가 초안 생성과의 경합을 막는가
3. 3열 구조에서 행 구조로 이관할 때 합계를 잃거나 중복할 경로가 있는가
4. 기타 매출·세금 스냅샷·채널 손익에서 빠진 연결점이 있는가
5. 최대 5개 제한이 앱이 아니라 DB 트랜잭션에서 보장되는가
6. 구형 기록 폴백과 신규 기록 권위의 경계가 명확한가
7. 구현 전에 반드시 수정해야 할 R0/R1 위험이 있는가
