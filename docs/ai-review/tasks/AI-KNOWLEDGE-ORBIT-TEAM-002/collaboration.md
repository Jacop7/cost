# AI-KNOWLEDGE-ORBIT-TEAM-002 공동 작업 장부

> 팀 구성안 단계만 검수하는 축소·정상화 Task다. 과범위였던 TEAM-001의 실패 원본은 보존하며
> 그 미완성 출력을 Finding이나 검수 결과로 재포장하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `37659fb82f5b192d49e8753e7235df4fc4b527c9`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`
- 충족해야 할 요구사항·불변식: 기존 역할·사람 승인·독립 감사 보존, 팀·채팅의 비권위 라우팅, Steward 관측 전용, AI 부 오케스트레이터 복원 책임, docs/team 단일 권위
- 이번에 바꾼 내용: 팀 구성안 1.3에 다섯 팀 그룹, 마스터 5개·부서 6개·임시 Task 채팅, Server · Supabase · Operations 경계, Context & Token Steward 계약을 추가했다.
- 집중 검토 질문: 새 구조가 기존 역할을 대체하거나 사람 승인·독립 Quality·공식 문서 단일 권위를 우회하는가? 사전기획에서 팀 구성안에 배정한 필수 항목이 빠졌는가?
- 실행한 테스트·현재 증거: `git diff --check`, `corepack pnpm ai:plans:simulate` 59/59 통과
- 사람 결정이 필요한 항목: 필수 Finding이 있으면 같은 공식 파일에 반영하고 새 commit successor로 재검수한다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=37a303a758db68f4875318d336b37ed616ea3467e53a1dcae7d6bcadab78916f -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `37a303a758db68f4875318d336b37ed616ea3467e53a1dcae7d6bcadab78916f`
- target_commit_sha: `37659fb82f5b192d49e8753e7235df4fc4b527c9`
- input_files_sha256: `7040751744bed6538c9ec52943571fa8ea3ddb125e6669a7ae9aea3f2fa629ea`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: ORBIT-TEAM-STEWARD-REG-001, ORBIT-TEAM-XREF-PACKET-002
- 선택 미종결 Finding: ORBIT-TEAM-SIM-COVERAGE-003
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

팀 구성안 1.3의 §1.3·§1.4·§3.2.1을 기존 §1.1·§4·§5·§11 및 사전기획 §3·§4·§17과 전문 대조했다. (1) 다섯 팀 그룹(§1.3)은 사전기획 §4.1/§4.1.1 대응을 누락·과장 없이 반영하고, 팀 그룹이 새 승인 주체가 아니라 라우팅 경계이며 승인·독립성은 §1.1·§4를 따른다고 명시한다. Data · Backend의 계산 권위와 Server · Supabase · Operations의 호스팅·운영 책임 분리, 세금·손익·원장 공식 불변경, 자격증명·백업·과금 단독 결정 금지, `server-supabase-operations` slug와 `Platform` 금지(145~149행)가 사전기획 §4.1(117~120행)·§4.1.1(134~137행)과 일치한다. (2) 채팅 라우팅(§1.4)은 마스터 5개·부서 6개·임시 Task 채팅을 사전기획 §3.1·§3.2와 동일하게 정의하고, 채팅이 공식 기억·승인 장부가 아니며 상태 변경은 권위 파일·증거로만 효력이 생긴다는 경계(153~154행), 채팅별 경쟁 공식 문서·`_shared` 권위 금지(179~181행)를 유지한다. (3) `04 Quality · Review`는 조정 전용이고 실제 감사는 §5.4의 회차별 클린 컨텍스트로 분리되며(175~177행), Quality verdict와 사람 Go/No-Go 분리도 §1.1·§3.2.1 금지 목록에서 보존된다. (4) Steward(§3.2.1)는 관측·전환 신호 전용으로 사전기획 §4.3의 허용·금지를 보수적으로 반영(금지 항목을 오히려 확대)하고, 복원·전이 책임을 AI 부 오케스트레이터에, 예산 상향·배포를 사람에 남긴다. (5) 증거 시뮬레이션 파일에서 test 블록 정확히 59개를 확인해 장부의 59/59 주장과 정합함을 확인했다(직접 실행은 범위 밖). 다만 필수 Finding 2건이 남는다. [Minor] ORBIT-TEAM-STEWARD-REG-001: Steward가 §3.2.1에 확정 역할로 기술되면서도 §1.1 최종 역할 배정표·§1.2 조직도·§5.1 필수 컨텍스트 분리 목록에 등록되지 않았다. 사전기획 §4.3은 확정 시 팀 구성안 개정으로 소속 컨텍스트를 지정하라고 요구했는데 채팅 소속만 있고 실행 컨텍스트 ID가 없어, SOLAR-ORCH 겸용 시 부 오케스트레이터의 Steward 신호 검토가 자기 검토가 되고 `ROLE_CONTEXTS.md`에 등록할 ID도 없다. [Minor] ORBIT-TEAM-XREF-PACKET-002: §1.4(179행)가 Task Packet의 정의 절을 §5.2가 아닌 §11로 잘못 참조해, 발행 시점 스냅샷(§5.2)과 현재값 권위(§11 작업큐)의 경계를 문서 스스로 흐린다. [Improvement, 비차단] ORBIT-TEAM-SIM-COVERAGE-003: 59개 테스트 중 신설 §1.3/§1.4/§3.2.1 계약(역할 책임 중복 검사·Steward 과권한 시뮬레이션)을 다루는 항목이 없다. 사전기획 §13·§17.3상 검사기 단계 후속 작업이므로 차단 사유는 아니다. 세 건 모두 같은 공식 파일에 반영 가능한 proposed_edits를 제공했다. VERIFIED·PASS는 외부 게이트를 종결하지 않으며 gate_state는 OPEN으로 유지된다.

### 공동 편집 제안 색인

- EDIT-TEAM-STEWARD-CONTEXT-A: ADD `docs/팀구성_상세기획안.md` · OPUS-ADVISORY       사람이 승인한 문서 묶음을 파일·셸 권한 없이 검토하는 비게이트 자문 컨텍스트 · 원문은 review.md 참조
- EDIT-TEAM-STEWARD-ROLE-ROW-B: ADD `docs/팀구성_상세기획안.md` · | 부 오케스트레이션·문서 관리 | 솔라 울트라 전용 컨텍스트 | 페이블 정기 운영 감사 | AI 부 오케스트레이터, 정책 변경만 사람 | · 원문은 review.md 참조
- EDIT-TEAM-XREF-PACKET-C: REPLACE `docs/팀구성_상세기획안.md` · 마스터·부서·Task 채팅 모두 §11의 같은 Task Packet과 `docs/team/ROLE_CONTEXTS.md`를 참조한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `37a303a758db68f4875318d336b37ed616ea3467e53a1dcae7d6bcadab78916f`
- target_commit_sha: `37659fb82f5b192d49e8753e7235df4fc4b527c9`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: 1df832c37c8a2c79641b670f9cfd95c407aadccb77b5b11be7f2be6ced8dba1d, change_type: MODIFIED }]`

### ORBIT-TEAM-STEWARD-REG-001

- disposition: `APPLIED`
- 적용 위치: §1.1, §1.2, §3.2.1, §5.1
- 적용 내용: `CONTEXT-STEWARD`를 최종 역할표·조직도·필수 컨텍스트 목록에 등록하고 제작·검수·복원 컨텍스트와 겸용하지 않도록 했다. Steward는 관측·신호까지만 담당하고 전이·복원과 예산·정책 권한은 각각 AI 부 오케스트레이터와 사람에게 남겼다.

### ORBIT-TEAM-XREF-PACKET-002

- disposition: `APPLIED`
- 적용 위치: §1.4
- 적용 내용: 발행 시점 계약은 §5.2 Task Packet, 현재 복원 권위는 §11 작업큐 필드로 나눠 참조하도록 바로잡았다.

### ORBIT-TEAM-SIM-COVERAGE-003

- disposition: `APPLIED`
- 적용 위치: `scripts/ai-plan-network-simulation.test.mjs`
- 적용 내용: 팀 그룹의 비승인 라우팅, Steward 전용 컨텍스트·금지 권한, 채팅 비권위·Task Packet/현재 권위 분리를 직접 검증하는 회귀시험 3건을 추가했다.

- 실행한 테스트: `git diff --check`; `corepack pnpm ai:plans:simulate` 62/62
- 판정 해석: r001의 필수 2건과 선택 1건을 모두 반영했으나 같은 발견 역할의 successor 재검수 전에는 VERIFIED·CLOSED를 주장하지 않는다.
- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `37659fb82f5b192d49e8753e7235df4fc4b527c9`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: 1df832c37c8a2c79641b670f9cfd95c407aadccb77b5b11be7f2be6ced8dba1d, change_type: MODIFIED }]`
- finding_ids: `ORBIT-TEAM-STEWARD-REG-001, ORBIT-TEAM-XREF-PACKET-002, ORBIT-TEAM-SIM-COVERAGE-003`
- 실행 명령: `git diff --check`; `corepack pnpm ai:plans:simulate`
- 종료 코드·결과: 전부 0; 문서 네트워크·업무 수명주기 시뮬레이션 62/62 통과
- 검증 내용: §1.1·§1.2·§3.2.1·§5.1에 `CONTEXT-STEWARD` 등록과 겸용 금지가 함께 존재하고, §1.4가 §5.2 발행 패킷과 §11 현재 권위를 구분한다. 새 시험 3건은 라우팅 팀의 승인권 획득, Steward 금지선 제거, 채팅 권위·절 참조 회귀를 직접 실패시킨다.
- 미실행 항목과 이유: 전체 `pnpm verify`는 문서·시뮬레이션 전용 중간 판본이며 공식 5개 기획안 누적 개정이 아직 진행 중이라 최종 게이트에서 실행한다.
- next_review_request: `AI_DEPUTY_SUCCESSOR_HANDOFF`
