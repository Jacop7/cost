# 앱 수정본 커밋 전 확인 — 2026-09-09

## 범위

- 사용자 요청: 미커밋 변경을 확인하고 커밋·푸시.
- 공식 작업 위치: `C:/Users/jacop/프로젝트/식자재관리앱`.
- 대상 브랜치: `codex/ingredient-write-integrity-review`.
- 기준 커밋: `03f385cee92730b6156c31ca1ec3e28409f5334f`. 조회한 origin/main `59738f43d300e8febc119744b122b4d399f3f15b`를 포함한다.
- 기존 앱 작업본의 식재료·레시피·발주·매출·MY 화면/공통 UI/관련 시험과 식재료 migration 0192~0195를 채택했다. 변경된 추적 파일 98개와 필요한 신규 소스·시험·증거 41개를 명시적으로 대조했다.
- 공식 저장소의 별도 자동 갱신 보완을 합쳤다. 판매 저장 후 레시피, 설정 변경 후 레시피/발주를 갱신하고 부자재 저장의 중복 무효화를 제거했다. 회귀 시험 `queryInvalidation.test.tsx` 9개를 포함한다.
- 공식 저장소의 AI 팀 운영 초안, 개인 Claude 설정, 임시 파일과 캡처는 이 커밋에 포함하지 않는다. 원래 브랜치의 미커밋 변경은 로컬 Git stash `29ba3e811780cd5082201ee9e4eabbacb2ec6de2`에 보존한 뒤 작업 종료 때 복원한다. stash는 삭제하지 않는다.
- 모델 계획은 실행 위치만 공식 저장소로 복원·재봉인했다. 외부 검수 예산이나 승인 상태를 승격하지 않았다.

## 이번 통합본 검사

- 모바일 TypeScript: PASS.
- 모바일 vitest: **79파일, 771테스트 PASS** (2026-09-09 22:14 실행).
- AppMap samples/model: 각각 13개, **26개 PASS**.
- `git diff --check`: PASS.
- Fable 연결 검사: 정상. 공식 저장소의 기존 실행기 자체 시험 52개 묶음 및 protocol 1.2 시험 22개 PASS. 이는 제품 독립검수가 아니다.
- 식재료 DB 54파일·경합 8시나리오 등 이전 실행 증거는 `INGREDIENT-WRITE-INTEGRITY-20260909.md`를 참조한다. 이번 커밋 절차에서 실제 재고·원장 데이터는 변경하지 않았다.

## 남은 게이트

기존 `three-surface-p0-check.mjs` 화면 변경 금지 실패, 전체 업그레이드 23경로 미완료 및 독립 제품 검수 미완료 상태를 보존한다. 승인 영수증을 생성하거나 실패 게이트를 제거하지 않았다. 이 커밋·feature 브랜치 푸시는 코드 보존과 후속 검수를 위한 것이며, 전체 verify 6/6·main 병합·운영 배포 승인이 아니다.

## 후속 승인 게이트 점검

대상 커밋 `d45d76bea9aef0d3134d8ba53febe945e14b5420`의 원격 verify run은 `34356211754`다. Node 20.19.4·24 job은 모두 ③에서 실패했다. Node 24 로그의 첫 오류는 shallow checkout에서 역사 기준 커밋 `c0b0b85e94c68487c10e6ff809f376f77bb23b90`의 tree를 찾지 못한 것이다. 원격 전체 DB job의 완료는 아직 확인하지 않았으며 전체 통과로 쓰지 않는다.

수정 및 실행 증거:

- 모든 verify job에 `fetch-depth: 0` 적용. 기존 protected-gate도 같은 설정이었다. exact HEAD 검사와 필수 job 조건은 유지했다. `node --test scripts/verify-shell.test.mjs` **7/7 PASS**, 세 job의 history checkout 회귀시험 포함.
- `node scripts/three-surface-sync-check.mjs --write`로 현재 README에서 registry 재생성. 변경은 README hash 및 ING-05 설명 두 곳뿐이다. 이후 sync **65화면·55라우트·185타깃·orphan 0 PASS**.
- 설치된 Claude Code `2.1.260`의 격리 CLI 옵션을 도움말에서 확인하고 실행기 allowlist에 정확한 버전만 추가. `fable:check` 로그인/연결 PASS, `fable:self-test` **52묶음 및 protocol 1.2 22/22 PASS**. 외부 모델은 호출하지 않았고, 비용·읽기 전용·경로 제한은 변경하지 않았다.
- 기존 선언에 대한 visual diff 5화면·responsive 20/20 및 색 대비 44쌍 PASS. 이는 서비스 전체 화면의 새로운 승인이나 독립검수를 뜻하지 않는다.

남은 실제 차단:

1. P0/P2 제품 동결 기준과 이후 P3 제품 변경 사이의 승인·승계 미완료. 제품을 옛 화면으로 되돌리거나 freeze/해시 검사를 제거하지 않았다.
2. byte artifact manifest의 여섯 content hash 불일치 및 이후 생성된 증거/검사 스크립트의 미등록. 이전 디자인 exact 게이트와 터치 영역 목록도 현재 제품 입력과 일치하지 않는다. 임의 새 기준선·승인 영수증으로 덮어쓰지 않았다.
3. 독립검수 실행에는 제품 검수용 프로젝트 예산 및 해당 회차의 정확한 `soft_budget_overrun_risk_accepted` 사람 승인이 필요하다. 기존 AI 기획 문서용 예산을 이 제품 검수에 전용하지 않았다.

기존 원장·재고의 수정, main 병합, 원격 DB 적용, 운영 배포는 하지 않았다.
