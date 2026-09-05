# 팀 서비스 계획 검수 판정 정정 001

날짜: 2026-09-05. 이 기록은 과거 원본을 덮어쓰지 않고 현재 해석만 정정한다.
R2의 실제 raw verdict는 그대로 보존한다. 현재 허용 판정은
`PLAN_READY_FOR_P1A_P2_INVESTIGATION_ONLY`이며 읽기·mock 가능성 조사·모델 계획 검증만 포함한다.
계획 v0.3 전체 교차검수 결과는 TEAM-SERVICE-FLOW-CURRENT.json에 별도로 연결한다.

## 원본 체인

- docs/팀서비스-자동흐름-구현계획.md: `eab9e85c246db6e5feffa54ef85131f3b204409495e7c5914dda8ae8242c14e5`
- docs/ai-review/evidence/TEAM-SERVICE-FLOW-PLAN-R1.md: `8c432760f2c2adb30be57753a38b461da9dfe28b49df77b20909cccd3a6b15ff`
- docs/ai-review/evidence/TEAM-SERVICE-FLOW-PLAN-R1.input.json: `d103905c0b18bfcdaaf8899442e8f05d114bbdd7186f48275a665f843b342039`
- docs/ai-review/evidence/TEAM-SERVICE-FLOW-PLAN-R2.md: `e0b9e3cb2892521576f31992ec662a08058969934e455ac57815a18529a5501d`
- docs/ai-review/evidence/TEAM-SERVICE-FLOW-PLAN-R2.input.json: `ecdcf1905dcbd839eb419a9cdde6e1a80edcd0f40aae412c92d6542b0678d846`
- docs/ai-review/evidence/TEAM-SERVICE-OPUS-001.md: `86377a96a2a39c676f3cc586e982d49bbcf1445dcf5d737d6683b4f39002d18a`
- docs/ai-review/evidence/TEAM-SERVICE-OPUS-001.run.json: `e192e00dae8cd36e4813cf44bd3056a450828241d797397bdbdab920348bd2e2`
- docs/ai-review/evidence/TEAM-SERVICE-OPUS-001.input-snapshot.json: `8e8c2d2c0c09808307e40473aad8c939f011f138ce9c955ffeda478830453a18`

## 계획 반영과 실행 게이트 분리

| Finding | R2의 계획 수준 판정 | 현재 실행 게이트 |
| --- | --- | --- |
| SR1 | PLAN_SATISFIED (v0.2 범위) | NOT_EXECUTED: host 출처·fence 가능성 |
| SR2 | PLAN_SATISFIED (v0.2 범위) | NOT_EXECUTED: 승인 후 실제 wake/ACK |
| SR3 | PLAN_SATISFIED (v0.2 범위) | NOT_IMPLEMENTED: intent CAS·복원 |
| SR4 | PLAN_SATISFIED (v0.2 범위) | NOT_IMPLEMENTED: 중복 effect·STOP·DAG |
| SR5 | PLAN_SATISFIED (v0.2 범위) | NOT_IMPLEMENTED: epoch 전환·복구 |
| SR6 | PLAN_SATISFIED (v0.2 범위) | GATE_BLOCKED: 봉인 계획의 exact Sol ultra profile 부재 |

이는 R2가 보고한 계획 판정이지 v0.3 새 독립검수 PASS 선언이 아니다.

## Opus 회차의 실제 지위

TEAM-SERVICE-OPUS-001 세 파일을 직접 확인했다. 유형은 OPUS_DIRECT_ADVISORY이며,
사용자가 승인한 1회/$2 soft cap 직접 자문이다. 240초 ETIMEDOUT, stdout/stderr 비어 있음,
verdict·실제 model attestation·usage 없음. 따라서 성공 검수 또는 필수 게이트 PASS로 세지 않는다.
Sol ultra는 이후 사용자가 지정한 별도 교차검수이며, Opus/Fable 필수 게이트 승계가 아니다.
이 증거에서 필수 게이트 우회 사실은 확인되지 않았고, 필수 게이트는 여전히 미통과다.

## P0 처분

- 계획/검수/관련 소스 19개를 `4ddcbc19f8ff1ca684befaf61611ef61e4cb4a1f`에 보존.
- 그래프 검사/11 manifest 의존성은 `dfc2e355530553cab9a0f09f8baf9a2450c5c5f0`에 보존.
- 42/38/44는 새 baseline runner가 고정 source commit에서 재실행하고 원출력·SHA를 보존한다.
  새 보고서가 생성·커밋·검증되기 전에는 재현 완료라고 하지 않는다.
- 과거 전체 verify 4/6은 당시 전체 소스/runner hash·DB 상태가 없어 재현 확인 불가.
  현재 hash의 소급 결속을 금지하고 HISTORICAL_UNPINNED_NOT_REPRODUCED로 유지한다.
- PH-FEASIBILITY는 HOST-SCOPE-001의 30분·출처별 실패 재시도 1회·검색 2회로 제한했다.
- 외부 검토의 '미추적 파일 3회 소실' 및 과거 Fable 결함 재발 주장은 이번에 독립 입증하지 않았다.

## 다른 작업 변경과 스크래치 처분

관련 변경만 커밋했으며 다른 작업의 M/미추적 파일을 무차별 스테이징하지 않았다.
scripts/.tmp-alias-gate-14.mjs는 디자인 토큰 작업이며 기존 design-token-contrast.mjs와 hash가 다르다.
동일 복사본 또는 폐기 가능 파일이라는 증거가 없어 삭제하지 않고 해당 작업 정리 대상으로 남긴다.
빈 오래된 .git/index.lock은 활성 Git 프로세스 부재·정확한 경로·생성 시각 재확인 후
.git/index.lock.stale-20260904-052536으로 이동 보존했다. 브랜치 전환/main 승격/원격 push는 없다.

## 후속 기준선 실행 결과

source commit: bdebbebb32aeaf94a750ea36b3038c36ac4c90f1.
보고서: TEAM-SERVICE-BASELINE-20260905-001.json (증거 보존 commit da7edab).
보고서 SHA256: 3471c93ad7cf81e45aa17de7e818ba725386811483a9e46676483517ee784c0e.
실제 재실행으로 Node 42/42, Router 38/38, REQUIREMENTS_NOT_MET 44건을 확인했다.
커밋 후 --verify 결과 COMMITTED_EVIDENCE_INTEGRITY_VERIFIED이며 서비스 준비 판정은 false다.
증거/명세 검사 명령: node --test scripts/team-service-baseline.test.mjs scripts/team-service-plan-contract.test.mjs.
이 13/13 검사는 증거 형식·변조 거부·수용 목록 검사일 뿐 AC-01~16 실제 실행이 아니다.

## R3 이후 현재 판정 (앞선 조사 허용 해석을 대체)

독립 전체 검토 R3는 CHANGES_REQUIRED이며 SF-R3-01~07을 반환했다.
현재 판정은 PLAN_CHANGES_REQUIRED_BEFORE_PH_FEASIBILITY다. READ/PLAN_REPAIR/PLAN_TEST만 허용한다.
계획 v0.4와 acceptance v2, 상태 후보 계약에 7개 대응을 작성했으나 독립 종결은 아직 PENDING이다.
최신 plan/acceptance/state/review SHA는 TEAM-SERVICE-FLOW-CURRENT.json에 결속한다.
R3 대상 v0.3 원문은 R3.input.json과 918a29c에 보존되어 있다.
현재 명세/증거 검사 16/16은 21개 수용 시험의 실제 실행 또는 formal gate PASS가 아니다.
