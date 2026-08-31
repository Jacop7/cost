# INTL-BASELINE-COMMIT-001 공동 작업 장부

> 이 장부는 국제 출시 구현 전 기준선 문서의 정확한 COMMIT 판본을 검수하는 append-only 기록이다.
> 직접 편집은 이 최초 패킷 작성까지만이며 이후 턴은 `corepack pnpm fable:append` 또는 검수
> 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `9467c97c14fc757948bf715d6a1b73bb8c80d82c`
- artifact_hashes: COMMIT manifest가 `task.json`의 다섯 공식 문서 bytes와 Git blob을 봉인한다.
- changed_artifact_paths: `ARCHITECTURE.md`, 국제 출시 기획안, 브랜치·DB 운영 기획안, 서버 확장 기획안, 작업큐
- 충족해야 할 요구사항·불변식: `INTL-BASELINE-001..005`, DB RPC 권위, 전진 migration, 정확한 feature SHA CI 선행
- 이번에 바꾼 내용: 최신 main `eb78b650`의 0177 운영 구조와 스테이징 증거를 국제 출시 기준선에 합류시켰고, 현재 운영 감시 Edge Function과 아직 없는 제품 BFF를 분리했다. 앞선 WORKING Fable의 프로토타입 링크 검사 개선사항도 반영했다.
- 집중 검토 질문: 다섯 문서가 실제 0177 구조·스테이징 상태·검증 수치와 일치하는가? 구현 전 선행 게이트와 배포 순서가 서로 모순되지 않는가? 운영 감시 Edge를 제품 서버로 과장하거나 이미 완료된 것을 미완료로 쓰는 문구가 남았는가? 상대 링크와 앞선 Fable 증거 연결이 유효한가?
- 실행한 테스트·현재 증거: target commit에서 `corepack pnpm verify` 6/6 통과(DB 36/36, core 178·2 skipped, mobile 212, upgrade 13/13, 웹 번들), 다섯 문서 상대 링크와 `git diff --check` 통과. 스테이징 배포·운영 drill JSON 2건과 앞선 Fable r002 PASS를 증거로 선언했다.
- 사람 결정이 필요한 항목: 국제 출시 DB 구현과 운영 배포는 이 COMMIT 검수 및 정확한 feature SHA 보호 CI가 모두 통과한 뒤에만 시작한다.
- next_review_request: `FABLE_REVIEW`

<!-- FABLE_REVIEW/FABLE_RECHECK 턴은 실행기가 review 원본 링크와 hash를 아래에 자동 추가한다. -->

<!-- fable-review:r001 sha256=be388f095a41c82104f9cdd7e178655352d991597c445eea667ba5a97efa2deb -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `be388f095a41c82104f9cdd7e178655352d991597c445eea667ba5a97efa2deb`
- target_commit_sha: `9467c97c14fc757948bf715d6a1b73bb8c80d82c`
- input_files_sha256: `dc92af5d0de50627532f239cad477b222193ea2f23ae676efb4df149656e9f8f`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: INTL-BASE-F001-UNMATERIALIZED-LINK-TARGETS
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

INITIAL COMMIT 검수 결과 PASS. (1) INTL-BASELINE-001: 다섯 공식 문서가 최신 main `eb78b650`·migration 166개(최신 0177)·DB 시험 파일 39개·verify 6/6(DB 36/36, core 178·2 skipped, mobile 212, upgrade 13/13, 웹 번들)·스테이징 0177 pending 0·운영 관측 장애/회복 훈련 완료·production 미적용을 동일 수치로 서술하며, 스테이징 배포 증거 JSON(`803ac0a`, protected-gate success, migration_count 166, 0176·0177 적용)과 운영 drill 증거가 문서 주장과 일치한다. (2) INTL-BASELINE-002: 국제 출시 기획안 상태 블록, 브랜치·DB 기획안 개정 4판·§3.3, 서버 확장 기획안 채택 상태 표, 작업큐 INTL-1(depends_on: [INTL-BASELINE-1])이 모두 “COMMIT Fable 검수와 동일 SHA 보호 CI 완료 전 DB 구현 금지”라는 같은 선행 게이트와 확장→이관→전환→정리 배포 순서를 말하며 모순이 없다. (3) INTL-BASELINE-003: ARCHITECTURE는 ops-health를 운영 상태 조회 전용, 제품 BFF·Webhook Edge Function을 미도입으로 구분하고, 실제 ops-health 소스는 전용 OPS_HEALTH_TOKEN 상수시간 비교 후 Cron 상태만 반환하는 GET 전용 함수이며 workflow는 10분 주기 외부 점검·이슈 관리 전용이라 서술이 실제 구조와 일치한다. 서버 확장 기획안의 BFF 토폴로지는 목표 구조로 명시적으로 구분된다. (4) INTL-BASELINE-004: 직전 WORKING Fable r002 PASS의 유일한 Improvement(프로토타입 docs/prototypes/ 경로를 링크 검사 범위에 명시)가 작업큐 INTL-BASELINE-1 완료 조건에 제안 문구 그대로 반영됐고, 스냅샷 내부에서 해석 가능한 상대 링크(두 2026-08-31 배포 증거, 문서 간 상호 참조)는 모두 유효하다. (5) INTL-BASELINE-005: AGENTS 검사 실행 절, ARCHITECTURE §9, 운영 기획안 §4.3·§8.2, 작업큐 공통 규칙이 로컬 verify 6/6과 정확한 feature SHA protected-gate를 동일하게 구현 착수 게이트로 유지한다. 서버 계산 권위(DB RPC)·전진 migration·단일 공식 문서 불변식도 다섯 문서에서 일관된다. 비차단 Improvement 1건: 프로토타입 HTML과 2026-08-29/30 배포 증거 JSON 등 일부 상대 링크 대상이 이번 봉인 스냅샷의 물질화 범위 밖이라 실존을 독립 확인하지 못했고 SOLAR 선언 링크 검사에 의존한다. PASS·VERIFIED는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 유지된다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `9467c97c14fc757948bf715d6a1b73bb8c80d82c`
- verified_input_files_sha256: `dc92af5d0de50627532f239cad477b222193ea2f23ae676efb4df149656e9f8f`
- finding_ids: `INTL-BASE-F001-UNMATERIALIZED-LINK-TARGETS`
- 실행 명령: 권위 작업 루트에서 `corepack pnpm verify`; target commit 다섯 공식 문서 상대 링크 검사와 `git diff --check`; GitHub Actions REST API로 exact SHA run `33356799254`의 전체 job 결과 대조.
- 종료 코드·결과: 로컬 verify 6/6 exit 0(DB 36/36, core 178·2 skipped, mobile 212, ACL·배포 계약, 새 DB·경합·locale parity, upgrade 13/13, 웹 번들). 원격 run `33356799254`의 Node 20.19.4·Node 24·full-db-required·protected-gate가 모두 completed/success.
- Fable 판정: r001 PASS, 필수 미해결 0건. review/run SHA-256은 `be388f095a41c82104f9cdd7e178655352d991597c445eea667ba5a97efa2deb` / `11172d72cb993aeb171397eb3b5c1e34779a8edd8ea480c3e8945d8bd11c12d4`다.
- target 결속: COMMIT manifest가 target tree `6c4b8a600d787cafdb5fff2544534ff35960f225`의 다섯 문서와 reference/evidence bytes를 봉인했다. 사용자 WIP는 target commit·Fable 입력·스테이징에서 제외했다.
- 미실행 항목과 이유: production 배포와 국제 출시 DB 구현은 기준선 외부 게이트 종결 뒤 별도 작업이다.
- next_review_request: `AI_DEPUTY_GATE_REVIEW`

## BACKLOG_DISPOSITION · turn-o001

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-f001`
- optional_finding_ids: `INTL-BASE-F001-UNMATERIALIZED-LINK-TARGETS`
- backlog_id: `P2-8`
- owner: `SOLAR-ARCH`
- 재검토 조건·시점: 다음 국제 출시 COMMIT 검수에서 프로토타입 HTML과 과거 배포 증거 대표 파일을 evidence_paths로 물질화하거나, target commit 기준 다섯 공식 문서 전체 상대 링크 검사 로그를 봉인한다.
- 공식 산출물 반영 여부: `docs/작업큐.md`의 `P2-8 국제 출시 문서 상대 링크 증거 봉인`에 비차단 완료 조건을 등록했다.
- review_state_effect: `NON_BLOCKING`

## AI_DEPUTY_GATE_DECISION · turn-o002 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-c001`
- verified_review_sha256: `be388f095a41c82104f9cdd7e178655352d991597c445eea667ba5a97efa2deb`
- verified_run_sha256: `11172d72cb993aeb171397eb3b5c1e34779a8edd8ea480c3e8945d8bd11c12d4`
- verified_input_files_sha256: `dc92af5d0de50627532f239cad477b222193ea2f23ae676efb4df149656e9f8f`
- artifact_hashes: `target commit 9467c97c14fc757948bf715d6a1b73bb8c80d82c의 COMMIT manifest와 input_files_sha256로 다섯 공식 문서·reference·evidence를 봉인함`
- gate_anchor_commit_sha: `22906a14825d2d5b320923caf2ec148689385105`
- required_external_gate: `이 결정 턴을 포함한 정확한 decision commit SHA의 protected-gate 성공, 이후 main fast-forward와 main 동일 SHA protected-gate 성공`
- open_required_finding_ids: `[]`
- optional_finding_backlog_ids: `P2-8`
- Codex 실행 증거: `turn-c001`; 로컬 verify 6/6, target SHA run `33356799254`와 anchor SHA run `33357347346`의 Node 20.19.4·24·full-db-required·protected-gate 모두 completed/success.
- requested_outcome: `MERGE_CANDIDATE`
- 종결 요청 또는 사람 이관 근거: 필수 Finding 0건, Fable PASS, 최신 main·0177 운영 증거·국제 출시 선행 게이트가 일치한다. 비차단 링크 증거 보강은 `P2-8`로 분리했다. 정확한 최종 decision commit 보호 CI 뒤 main fast-forward 후보로 승인한다.

> 이 턴 자체는 로컬 status를 닫지 않는다. 정확한 최종 decision commit의 보호 원격 체크와 main 반영이 외부 종결 증거다.
