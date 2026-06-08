# features/ — 화면 ID ↔ 기능 모듈 매핑

탭별 feature 모듈. 각 모듈은 `screens/`(화면) · `components/`(전용 UI) · `hooks/`(쿼리·뮤테이션)로 구성한다.
공통 UI 킷은 `src/components`, 계산은 `@sikjae/core`, 데이터 계약은 `@sikjae/types`.

## 화면 인벤토리 (⑦ 1장)

| 모듈 | 화면 ID | 이름 | 유형 |
|---|---|---|---|
| `orders` | ORD-01 | 발주 현황 홈 (후보/대기/완료) | 화면 |
| `orders` | ORD-02 | 발주하기(등록) | 화면 |
| `orders` | ORD-03 | 입고 확정 → **E1** | 시트 |
| `orders` | ORD-04 | 레시피 계산기 → **E6** (2차) | 시트 |
| `ingredients` | ING-01 | 식재료 리스트 | 화면 |
| `ingredients` | ING-02 | 식재료 상세 | 화면 |
| `ingredients` | ING-03 | 식재료 추가 | 화면 |
| `ingredients` | ING-04 | 재고 수정 → **E2/E5** | 시트 |
| `ingredients` | ING-05 | 구매 링크 추가 (2차 자동추출) | 시트 |
| `recipes` | RCP-01 | 레시피 리스트 | 화면 |
| `recipes` | RCP-02 | 레시피 상세 | 화면 |
| `recipes` | RCP-03 | 레시피 추가/수정 → **E3** | 화면 |
| `recipes` | RCP-04 | 고정 지출 자세히 | 시트 |
| `recipes` | RCP-05 | 판매가 시뮬레이션 (2차) | 시트 |
| `recipes` | RCP-07 | 평균 판매량 입력 | 화면 |
| `my` | MY-01 | 마이페이지 홈 | 화면 |
| `my` | MY-02 | 고정 지출(월) → **E4** | 화면 |
| `my` | MY-03 | 카테고리 관리 | 화면 |
| `my` | MY-04 | 단위 설정 (2차 전환) | 화면 |
| `my` | MY-05 | 구매처·브랜드 (병합 2차) | 화면 |
| `my` | MY-06 | 알림 설정 (2차) | 화면 |
| `my` | MY-07 | 월 손익 리포트 (그래프 2차) | 화면 |

전파 이벤트(E1~E7)는 `src/lib/supabase.ts` 의 `rpc.*` 로 호출하고, 성공 후 `qk` 키를 무효화한다.
