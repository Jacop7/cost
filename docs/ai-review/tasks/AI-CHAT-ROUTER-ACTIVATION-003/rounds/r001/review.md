# AI-CHAT-ROUTER-ACTIVATION-003 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `6497666e655609a4f4bfe10bfaea6070dad01286`

## 요약

AI-CHAT-ROUTER-ACTIVATION-003 초기 검수(FABLE-ARCH, 봉인 단일-pass) 결과 PASS다. (1) SHA 결속: activation-decision.json의 designSha256(83baffef…)·modelPlanSha256(60d7cb6a…)과 activation-receipt.json의 decisionSha256(c8efb3a8…)·policySha256(92dc3a05…)·designSha256·modelPlanSha256·구현 증거(c6052e41…)·R2(225ff42d…)·R5(14449cd2…) SHA-256이 모두 봉인 입력의 현재 bytes sha256과 정확히 일치하고, model-plan.json.sha256 sidecar도 일치한다. 승인 원문 '실제 자동 라우팅 활성화를 승인합니다'·승인 시각 2026-09-04T07:02:35+09:00·DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001이 decision JSON, DECISIONS.md, 협업 장부에서 동일하다. (2) exact edge: 11개 manifest의 route_edges 합계 21개(01:1, 02:5, 03:6, 04:2, 05:2, 부서01~05:5, 부서00:0)와 edge별 kind가 설계 v0.4 §3 표와 정확히 일치하며 policy.json의 12개 allowedMessageKinds·expectedChatCount=11도 일치한다. (3) 전달 의미론: SENT_UNCONFIRMED는 도구 수락일 뿐이고 receipt/target ACK 뒤에만 DELIVERED를 append함이 증거 문서와 설계 §6에 결속되고 로컬 시험으로 확인됐다. (4) 비밀 격리: 원시 provider endpoint·HMAC key는 Git 밖 사용자 전용 ACL runtime에만 두고 ledger에는 HMAC ref만 남기며 route JSONL 비노출 시험이 있다. (5) 금지 유지: humanRelayEnabled=false, productionRoutesEnabled/databaseMutationEnabled/deploymentMutationEnabled=false, DECISIONS.md의 human relay·자동 새 작업·제품·DB·Supabase·git·staging·production·비밀·배포 mutation 금지가 유지된다. (6) Mission Relay가 1.7·successor 생성을 소유하고 Router는 복원·Study Gate 뒤 generation CAS만 수행함이 설계 §8과 활성화 허용 범위에 결속된다. Codex 증거(Router 34/34, wrapper 52 bundles, policy/manifest valid, Get-Acl 사용자+SYSTEM, endpoint 11개 generation 1)와 '검수 통과 전 실제 dispatch 미실행'이 required_evidence를 충족한다. 필수 Finding(Blocker~Minor)은 없고 Improvement 2건만 기록한다: ① policy.json allowlist가 STAGING/PRODUCTION 게이트 kind를 전역 포함하는 반면 activation-decision은 productionRoutesEnabled=false이고 설계 §12-9는 운영·배포 edge를 별도 사람 게이트 파일럿 전까지 닫도록 하므로, 첫 비운영 파일럿의 게이트 edge 제외와 §10 fail-closed 조건을 증거 문서에 명시할 것(proposed_edits 제공). ② DECISIONS.md의 CRLF/LF 혼합 개행을 단일 규약으로 전진 정정할 것. 이 PASS는 로컬 판정이며 외부 보호 게이트(gate_state)는 OPEN으로 남는다.

## Findings

### ACT003-GATE-EDGE-KIND-SCOPE — Improvement / OPEN

- 범주: ARCHITECTURE
- 영향: policy allowlist가 게이트 kind를 전역 허용하므로 첫 비운영 파일럿에서 02→04/05 게이트 edge로 메시지를 보낼 수 있는지 해석이 갈린다. 설계 §12-9의 파일럿 순서와 activation-decision의 productionRoutesEnabled=false 사이의 경계를 명시하지 않으면, 게이트 kind 발송이 발생했을 때 승인 범위 위반인지 사후 감사에서 논쟁의 소지가 있다. 실제 mutation 권한은 열리지 않으므로 차단 사유는 아니다.
- 근거: .codex/team-router/policy.json:13, .codex/team-router/activation-decision.json:8, docs/team/DECISIONS.md:66
- 완료 조건: 활성화 구현 증거 001에 02→04/05 게이트 kind edge는 포인터 메시지 운반만 하며 설계 §10의 fail-closed 조건을 따르고, 첫 실제 비운영 파일럿은 게이트 kind가 아닌 edge만 사용함을 명시한다. / 또는 policy.json 전진 정정으로 이번 활성화 allowlist에서 게이트 kind를 제외하고 receipt의 policySha256을 재결속한다.
- 필요한 테스트: §10 조건(사람 승인·exact SHA·보호 CI·스테이징 증거·복구 계획) 부재 시 02→04/05 게이트 kind dispatch가 BLOCKED_POLICY로 차단되는 sabotage 시험

### ACT003-DECISIONS-MIXED-EOL — Improvement / OPEN

- 범주: DATA_INTEGRITY
- 영향: 이 체계는 승인 장부를 byte-exact SHA-256으로 결속하므로, 혼합 개행은 편집기·git autocrlf 등 도구별 정규화로 의도치 않은 해시 변경과 diff 잡음을 유발해 이후 결속·감사 비교를 불안정하게 만들 수 있다.
- 근거: docs/team/DECISIONS.md:1, docs/team/DECISIONS.md:60
- 완료 조건: DECISIONS.md 전체 개행을 단일 규약(LF 권장)으로 전진 정정하고, 이후 장부 append 도구가 같은 규약을 유지한다.
- 필요한 테스트: 문서 개행 규약 검사(docs graph checker 또는 lint)에 DECISIONS.md를 포함해 혼합 개행 재발을 탐지

## 공동 편집 제안

### EDIT-ACT003-GATE-EDGE-NOTE — ADD

- 대상: `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md`
- 위치: - `humanRelayEnabled=false`를 유지하고 자동 새 작업 생성·백그라운드 서비스는 포함하지 않는다.
- 연결 Finding: ACT003-GATE-EDGE-KIND-SCOPE
- 이유: policy.json 전역 allowlist의 게이트 kind와 activation-decision의 productionRoutesEnabled=false·설계 §12-9 파일럿 순서 사이의 경계를 증거 문서에 명시해 승인 범위 해석 논쟁을 제거한다.

    - `STAGING_GATE_REQUEST`·`STAGING_GATE_RESULT`·`PRODUCTION_GATE_REQUEST` kind의 02→04·02→05 edge는
      포인터 메시지 운반만 하며, 설계 §10의 사람 승인·exact SHA·보호 CI·스테이징 증거·복구 계획 조건이
      없으면 `BLOCKED_POLICY`로 fail-closed한다. 첫 실제 비운영 파일럿은 게이트 kind가 아닌 edge만 사용한다.

### EDIT-ACT003-DECISIONS-EOL-COMMENT — COMMENT

- 대상: `docs/team/DECISIONS.md`
- 위치: # 사람 Decision 장부
- 연결 Finding: ACT003-DECISIONS-MIXED-EOL
- 이유: 혼합 개행이 도구별 정규화로 장부 해시를 불안정하게 만들 수 있어 정규화 시점과 주의사항을 카운터파트에 전달한다.

    이 파일은 전반부 CRLF·후반부 LF의 혼합 개행 상태다. byte-exact SHA 결속 대상이므로 별도 전진 정정 commit에서 전체를 LF로 정규화하고, `pnpm fable:append` 등 장부 append 도구가 동일 규약을 유지하도록 정렬할 것을 권고한다. 정규화는 내용 무변경이지만 파일 sha256이 바뀌므로 같은 commit에서 관련 결속을 함께 갱신해야 한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
