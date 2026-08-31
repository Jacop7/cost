# INTL-BASELINE-COMMIT-001 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `9467c97c14fc757948bf715d6a1b73bb8c80d82c`

## 요약

INITIAL COMMIT 검수 결과 PASS. (1) INTL-BASELINE-001: 다섯 공식 문서가 최신 main `eb78b650`·migration 166개(최신 0177)·DB 시험 파일 39개·verify 6/6(DB 36/36, core 178·2 skipped, mobile 212, upgrade 13/13, 웹 번들)·스테이징 0177 pending 0·운영 관측 장애/회복 훈련 완료·production 미적용을 동일 수치로 서술하며, 스테이징 배포 증거 JSON(`803ac0a`, protected-gate success, migration_count 166, 0176·0177 적용)과 운영 drill 증거가 문서 주장과 일치한다. (2) INTL-BASELINE-002: 국제 출시 기획안 상태 블록, 브랜치·DB 기획안 개정 4판·§3.3, 서버 확장 기획안 채택 상태 표, 작업큐 INTL-1(depends_on: [INTL-BASELINE-1])이 모두 “COMMIT Fable 검수와 동일 SHA 보호 CI 완료 전 DB 구현 금지”라는 같은 선행 게이트와 확장→이관→전환→정리 배포 순서를 말하며 모순이 없다. (3) INTL-BASELINE-003: ARCHITECTURE는 ops-health를 운영 상태 조회 전용, 제품 BFF·Webhook Edge Function을 미도입으로 구분하고, 실제 ops-health 소스는 전용 OPS_HEALTH_TOKEN 상수시간 비교 후 Cron 상태만 반환하는 GET 전용 함수이며 workflow는 10분 주기 외부 점검·이슈 관리 전용이라 서술이 실제 구조와 일치한다. 서버 확장 기획안의 BFF 토폴로지는 목표 구조로 명시적으로 구분된다. (4) INTL-BASELINE-004: 직전 WORKING Fable r002 PASS의 유일한 Improvement(프로토타입 docs/prototypes/ 경로를 링크 검사 범위에 명시)가 작업큐 INTL-BASELINE-1 완료 조건에 제안 문구 그대로 반영됐고, 스냅샷 내부에서 해석 가능한 상대 링크(두 2026-08-31 배포 증거, 문서 간 상호 참조)는 모두 유효하다. (5) INTL-BASELINE-005: AGENTS 검사 실행 절, ARCHITECTURE §9, 운영 기획안 §4.3·§8.2, 작업큐 공통 규칙이 로컬 verify 6/6과 정확한 feature SHA protected-gate를 동일하게 구현 착수 게이트로 유지한다. 서버 계산 권위(DB RPC)·전진 migration·단일 공식 문서 불변식도 다섯 문서에서 일관된다. 비차단 Improvement 1건: 프로토타입 HTML과 2026-08-29/30 배포 증거 JSON 등 일부 상대 링크 대상이 이번 봉인 스냅샷의 물질화 범위 밖이라 실존을 독립 확인하지 못했고 SOLAR 선언 링크 검사에 의존한다. PASS·VERIFIED는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 유지된다.

## Findings

### INTL-BASE-F001-UNMATERIALIZED-LINK-TARGETS — Improvement / OPEN

- 범주: OTHER
- 영향: 스냅샷 내부 링크와 2026-08-31 증거 2건은 모두 유효함을 확인했으나, 물질화되지 않은 링크 대상(프로토타입 HTML, 과거 배포 증거 JSON)의 실존은 독립 재현되지 않았다. 계산 계약·배포 순서·게이트 일관성에는 영향이 없는 비차단 개선 항목이다.
- 근거: docs/국가-통화-세금-국제출시-기획안.md:13, docs/브랜치-DB-운영-기획안.md:358, docs/작업큐.md:173
- 완료 조건: 다음 COMMIT 회차의 evidence_paths에 docs/prototypes/international-tax-settings.html 또는 과거 배포 증거 대표 파일이 물질화되어 링크 대상 실존이 독립 확인되거나, 링크 검사 실행 로그가 증거로 봉인된다.
- 필요한 테스트: target commit 기준 다섯 문서 전체 상대 링크(프로토타입·docs/deployments 포함) 유효성 검사

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
