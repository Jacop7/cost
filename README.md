# 식자재 관리 앱

> 식당 사장님이 수기 입력만으로 **재고 → 발주 → 입고 → 원가 → 판매 → 손익**을 한 흐름으로
> 기록하는 모바일 운영 데이터 플랫폼.

현재 제품은 Expo 앱과 Supabase Postgres를 한 저장소에서 관리하는 모듈러 모놀리스다. 확정 계산과
원장은 DB RPC가 소유하고, 앱은 입력·표시·캐시 무효화, `packages/core`는 미리보기와 검산을 맡는다.

## 현재 구성

| 영역 | 현재 채택 | 비고 |
|---|---|---|
| 앱 | Expo SDK 54 · React 19 · RN 0.81 · expo-router 6 | 식재료·레시피·발주·매출관리·MY 5탭 |
| 서버 | Supabase Postgres · Auth · Data API/RPC · RLS · pg_cron | Queue·Edge Function·외부 Worker는 아직 미도입 |
| 계산 | DB RPC(확정) + `packages/core`(미리보기·검산) | 같은 공식을 시험으로 대조 |
| 저장소 | pnpm 9.12 모노레포 · `node-linker=hoisted` | RN/Metro 호환 |

```text
apps/mobile                 점주 앱과 화면별 훅
packages/core               순수 계산·서식·검산
packages/types              앱에서 쓰는 소형 도메인 계약
packages/db                 마이그레이션·RLS·RPC·Cron·시드·DB 시험
docs                        제품·운영·서버 확장 기획
ARCHITECTURE.md             현재 원장·계산·전파 구조
```

화면과 모듈의 실제 인벤토리는
[apps/mobile/src/features/README.md](./apps/mobile/src/features/README.md)를 단일 출처로 사용한다.

## 필수 런타임

- Node.js **20.19.4 이상**. CI는 하한 `20.19.4`와 개발 기준 `24`를 모두 실행한다.
- pnpm **9.12.0**. 전역 버전 대신 `corepack pnpm` 사용을 권장한다.
- 로컬 DB 검증에는 Docker Desktop과 Git Bash가 필요하다.
- 폰 확인에는 Expo Go SDK 54가 필요하다.

## 처음 실행

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm db:start
```

로컬 DB를 시드 상태로 다시 만들 때만 다음 명령을 사용한다. **현재 로컬 데이터는 삭제된다.**

```bash
corepack pnpm db:reset
corepack pnpm db:types
```

앱은 저장소 루트에서 다음처럼 시작한다.

```bash
corepack pnpm mobile start

# 폰과 외부 네트워크에서 확인할 때
cd apps/mobile
npx expo start --tunnel

# 브라우저 미리보기
npx expo start --web
```

Node 24에서 Expo CLI의 네트워크 의존성 확인이 실패하면 `EXPO_OFFLINE=1`을 사용할 수 있다. 오프라인
모드는 localhost 기준이므로 폰에서는 `--lan` 또는 정상화된 터널을 사용한다.

## 검증

전체 로컬 게이트는 한 명령이다.

```bash
corepack pnpm verify
```

1. 전 패키지 타입 검사
2. core · DB · mobile 시험
3. ACL 스크립트의 비밀번호·인자·환경 격리 시험
4. 빈 DB에 전체 마이그레이션 적용 + DB 33개 스위트 + 2세션 경합 + 로케일 실측 대조
5. 중간 버전에서 최신까지의 업그레이드 경로
6. Expo 웹 번들

Docker DB가 없는 환경에서는 아래 범위만 확인할 수 있다. 출력도 **전체 통과가 아닌 4/6 선택 범위**로
표시한다.

```bash
corepack pnpm verify --no-db
```

GitHub Actions는 Node `20.19.4`·`24`에서 이 빠른 범위를 실행한다. 별도 `full-db-required` job은
격리된 Supabase를 띄워 `pnpm verify` 6/6(새 DB·경합·parity·업그레이드 포함)을 실행하며,
둘 다 성공한 정확한 SHA에만 `protected-gate`가 붙는다. `main` ruleset은 이 context를 필수로 요구한다.

## 핵심 데이터 규칙

- 저장 단위는 g/ml/개 최소 단위와 1인분 기준이다.
- 기준단가는 **쓴 돈 ÷ 실제 들어온 양**이다. 팩 개수나 로스율로 가중하지 않는다.
- 발주(E7)는 기록만 하고, 입고(E1) 전에는 재고·단가를 바꾸지 않는다.
- 판매(E10→E8)는 필요한 전량을 원장에 기록한다. 재고가 부족해도 판매를 막거나 0으로 자르지 않고
  음수 잔액을 보존한다.
- 재고 상태는 **여유 / 소진 임박 / 소진** 3단계이며 `packages/core`의 `stockStateOf`가 단일 판정처다.
- 반제품은 1차 범위 밖이며 DB 제약과 `save_recipe`가 등록을 막는다.
- 영업일의 판매가·재료·원가·세금·고정지출은 시작 시 스냅샷으로 고정한다. 종료된 날은 다시 열지
  않고 정정 RPC와 감사 원장으로 수정한다.

고정 검산값과 이벤트 전체 목록은 [ARCHITECTURE.md](./ARCHITECTURE.md)에서 확인한다.

## 환경과 배포

| 환경 | 용도 | 원칙 |
|---|---|---|
| 로컬 Supabase | 개발·파괴적 시험·경합 | 시드/합성 데이터만 사용 |
| 스테이징 | 운영 계약 통합 검증 | 아직 미구축. 첫 실매장 전에 별도 프로젝트로 준비 |
| 운영 | 실제 매장 데이터 | 아직 연결·적용 이력 미확인. `main`의 승인된 이력만 적용 |

현재 1차 계약은 `stores.owner_id UNIQUE`, 즉 계정 하나당 매장 하나다. 다매장·직원 권한은 미래 확장
범위이며 현재 지원 기능으로 간주하지 않는다.

`supabase db push`를 로컬 관성으로 운영에 실행하지 않는다. Supabase CLI는 로컬 절차를 완주한
`2.116.0`으로 고정했다(P1-2). 첫 원격 프로젝트 연결 전에는 원격 ACL 읽기 전용 감사(P1-1)를
실측해야 한다. 브랜치·마이그레이션·배포·
복구 절차는 [브랜치·DB 배포 운영 기획안](./docs/브랜치-DB-운영-기획안.md), 서버 분리 판단은
[서버 확장 아키텍처 기획안](./docs/서버-확장-아키텍처-기획안.md)을 따른다.
