# 재부팅 재개 기록 — 2026-09-11

## 기준점

- 작업 루트: `C:\Users\jacop\프로젝트\식자재관리앱`
- 브랜치: `codex/ingredient-completion-parallel`
- 현재 HEAD / 원격 브랜치: `f07b85fcc29e8dc7fc7f568efb3fa2cfc936631d`
- 원격 `main`: `59738f43d300e8febc119744b122b4d399f3f15b`
- 작업 트래킹 파일은 clean 상태다. 사용자의 미추적 산출물은 건드리지 않는다.

## 완료된 변경과 확인

- `b372bd1`: 식재료·레시피 쓰기 흐름 변경.
- `dfec474`: 레시피 상세 계약의 순환 import 제거.
- 대상 시험:
  - `apps/mobile/tests/domainBoundaries.test.ts`: 6/6 통과.
  - 레시피 폼·쓰기 대상 시험: 37 통과.
  - `corepack pnpm verify --no-db`: 타입, core·mobile 시험(1169 통과·7 skip), 웹 번들은 통과.
- 현재 CI run `34539415671`은 `full-db-required`, Node 20/24, `protected-gate` 모두 실패했다. Node 20/24 실패는 기존 P0 화면 변경 금지 게이트가 P3 변경을 막는 것으로 로컬에서 재현했다. full DB 실패의 정확한 로그 원인은 재개 후 별도로 확인한다.

## 배포·승인 제약

- `docs/prototypes/ingredient-p3-scope-decision.json`은 P0→P3 범위 내 변경·재검증만 승인한다.
- 이 승인에는 `main` 병합이나 운영 배포가 포함되지 않는다.
- 대상 후보는 식재료 44항목만을 넘어 공용·레시피 등 258개 제품 범위 델타를 포함한다. 기존 승인만으로는 배포할 수 없다.
- P3 evidence adapter는 `registry.states: array required`로 실패하고, P3 progress 스크립트는 stale `surfaceRegistry.generated.json` accounting input으로 실패한다. 게이트를 약화하거나 우회하지 말고, 정확한 범위 manifest·독립검수·명시 승인을 갖춰야 한다.

## Claude 독립 검수

- 요청 대상: P3 승계·배포 게이트 가능 여부의 읽기 전용 독립 검수.
- Claude Cowork 브라우저 탭은 열려 있으나 Codex Browser Use 연결은 `User unavailable`로 탐색·메시지 전송이 불가했다.
- 연결 복구 후에는 외부 메시지 전송 직전에 사용자 확인을 받고, 다음만 요청한다: 현재 후보 SHA와 P3 범위·evidence adapter 실패를 독립 확인하고, 게이트 우회 없는 최소 공식 산출물과 승인 순서를 판정.

## Docker·검증 재개

- 로컬 Supabase 컨테이너 `supabase_db_margincook` (`75d34ec2e032`)은 기록 시점 healthy였다.
- `packages/db/scripts/upgrade-check.sh`가 `fresh_upgrade_check_21774_12573` DB에서 진행 중이었다. 재부팅하면 중단되므로 성공으로 기록하지 않는다.
- 재개 순서:
  1. Docker Desktop이 완전히 기동되고 `supabase_db_margincook` healthy인지 확인한다.
  2. 현재 실행 중인 upgrade-check 프로세스가 재부팅으로 종료됐음을 확인한다.
  3. `bash packages/db/scripts/upgrade-check.sh`를 새 실행으로 처음부터 다시 실행한다. 기존 fresh DB는 삭제·재사용하지 않는다.
  4. CI `34539415671`의 `full-db-required` 실패 로그를 확인해 P0 이외의 실패가 없는지 분리한다.
  5. Browser Use 연결이 정상화된 경우에만 Claude 읽기 전용 독립검수를 보낸다.
  6. P3 공식 승계·검수·정확한 배포 승인 전에는 `main` 병합·운영 배포를 하지 않는다.

## 다음 단일 안전 행동

재부팅 뒤 Docker 상태를 확인한 뒤 업그레이드 검증을 새로 시작하고, 현 CI의 full DB 실패 원인을 로그로 확정한다.
