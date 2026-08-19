# @sikjae/db — Supabase 데이터 레이어

데이터 플랫폼의 **진실의 원천**. 스키마·RLS·전파 RPC·시드를 한곳에서 관리한다.

## 구조

```
supabase/
├── config.toml                 # 로컬 개발 설정
├── migrations/                 # 순서 보장 SQL (타임스탬프 prefix)
│   ├── 20260608000001_tenancy.sql            # 멀티테넌시 + 열거형 + RLS 헬퍼
│   ├── 20260608000002_master_data.sql        # 카테고리·식재료·구매처·브랜드·옵션
│   ├── 20260608000003_inventory_purchasing.sql # 재고·이벤트·발주·후보·계산실행·단가추이
│   ├── 20260608000004_recipes_pl.sql         # 레시피·라인·추가지출·순이익추이·고정지출·월손익·설정
│   ├── 20260608000005_rls.sql                # 전 테이블 store_id 격리 정책
│   ├── 20260608000006_calc_helpers.sql       # 기준단가·로스율·고정지출률·손익 재계산
│   └── 20260608000007_rpc_propagation.sql    # E1~E7 전파 트랜잭션
└── seed.sql                    # 카테고리 12종 + 검산 데모
src/
└── database.types.ts           # `pnpm db:types` 로 생성
```

## 엔터티 (17 + 파생/스냅샷)

기준정보: `categories` `ingredients` `vendors` `brands` `purchase_options`
재고·구매: `inventory_states` `inventory_events` `order_records` `order_candidates` · `price_trends`(파생)
레시피·손익: `recipes` `recipe_lines` `recipe_extra_costs` · `profit_trends`(파생)
월 경영: `fixed_costs_monthly` · `monthly_pl`(파생)
설정: `settings`

## 전파 RPC (E1~E7)

| RPC | 트리거 | 핵심 |
|---|---|---|
| `e1_confirm_inbound` | 입고 확정 | 재고+ → 단가 → 추이 점 → 손익 → 월재료비 → 후보해소 → 급등판정 |
| `e2_discard` | 폐기 | 폐기 기록 → 실측 로스율 → 단가 보정 → 손익 |
| `e3_recipe_saved` | 레시피 저장 | 손익 재계산 → 파랑 점 |
| `e4_fixed_cost_saved` | 고정지출 저장 | 률 재계산 → 전 레시피(회색 점) → 월 손익 리포트 |
| `e5_stock_adjusted` | 재고 수정·실사 | 개수 보정 → 뱃지 → 후보 생성 |
| `e7_place_order` | 발주 등록 | 발주됨 레코드 + 후보 '주문함' (재고·단가 불변) |

> 모든 RPC는 단일 트랜잭션 = 원자성. 공식은 `packages/core`와 일치해야 한다.

## 명령

```bash
pnpm db:start    # 로컬 기동 (Docker)
pnpm db:reset    # 마이그레이션 + 시드 재적용
pnpm db:types    # DB → src/database.types.ts
pnpm db diff     # 변경분 마이그레이션 생성
```
