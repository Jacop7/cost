
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
