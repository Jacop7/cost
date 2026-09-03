# AI-ORCH-PLANS-MASTER-CHAT-FABLE-001 공동 작업 장부

> 최신 마스터 채팅 번호와 04·05의 사람 결정 발화·01 자동 연결 계약을 Fable이 독립 검수한다.
> 기존 감사 원본과 사용자 소유 변경은 입력 범위에서 제외하며, Fable 턴은 공식 실행기만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6e99bd93b737bf291f14a8d3a6465a1d5110fa6c`
- input_files_sha256: `r001 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `r001 manifest에서 실행기가 봉인·검증 예정`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/AI-오케스트레이션-상세기획안.md`, `docs/작업큐.md`, `scripts/ai-plan-network-simulation.mjs`, `scripts/ai-plan-network-simulation.test.mjs`
- 충족해야 할 요구사항·불변식: 01 사람 결정·02 마스터 AI·03 부 AI·04 개발/스테이징·05 운영 순서, 04와 05의 사람 직접 결정, 01 자동 연결, 반복 입력 금지, 04 결정의 운영 승인 비확대, 05 명시적 승인 필수
- 이번에 바꾼 내용: 팀 구성안 v1.5와 오케스트레이션 초안 v0.4에 새 마스터 채팅 순서와 게이트별 사람 결정 경계를 반영하고, 작업큐 disposition hash chain과 시뮬레이션 검사를 갱신했다.
- 집중 검토 질문: 새 번호와 권한 경계가 모순 없이 작동하는가? 사람이 04·05에서 한 번 말한 결정이 01에 자동 연결되면서도 04가 운영 권한을 획득하지 않는가? AI가 사람의 결정을 추정하거나 반복 입력을 요구하는 경로가 남아 있는가?
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 70/70 PASS, `git diff --check` 오류 없음. `verify --no-db` 4/6은 직전 기준 증거이며 이번 변경 후 전체 재실행으로 주장하지 않는다.
- 사람 결정이 필요한 항목: Fable 작업 전체 상한은 USD 4.00이다. 초과가 필요하면 실행을 멈추고 사람에게 다시 결정 요청한다.
- 검수 규칙: 기존 Opus 자문과 과거 Fable 회차를 이번 판본의 PASS로 재사용하지 않는다. 기존 감사 원본을 수정하거나 재분류하지 않는다.
- next_review_request: `FABLE_REVIEW`

