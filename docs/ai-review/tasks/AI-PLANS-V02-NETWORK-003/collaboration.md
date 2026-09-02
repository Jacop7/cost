# AI-PLANS-V02-NETWORK-003 공동 작업 장부

> NETWORK-002의 소액 상한 실패 뒤 중복 reference를 제거하고 기본 envelope로 재발행한 장부다.
> 다섯 공식 기획안 원문은 모두 유지하며 비-Fable 턴은 전용 append 명령으로만 추가한다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `3209b873d56d5914e1b05d9e04dee94108189f53`
- changed_artifact_paths: `docs/AI-오케스트레이션-상세기획안.md`, `docs/디렉터리-문서신경망-재설계-기획안.md`, `docs/AI-품질-학습-자율성-평가기획안.md`
- 충족해야 할 요구사항·불변식: 다섯 공식 문서의 단일 권위, Fable 필수 검수, 채팅 비권위, Steward 신호 전용, L0~L4·단조 HANDOFF·lease 인계, DRAFT 전 materialization 금지
- 집중 검토 질문: 경쟁 장부·권한 우회·인계 원자성·DRAFT 활성화 순서에 Critical/Major 반례가 있는가? 같은 원인의 표현상 지적은 합치고 필수 Finding 최대 5개로 답한다.
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 68/68. 축소 증거가 공식 문서와 HANDOFF 반례를 결속하며 큰 실행 원본은 hash로만 가리킨다.
- 사람 결정이 필요한 항목: 유효 Fable 결과 뒤 네 DRAFT 문서를 ACTIVE로 원자 승격할지 여부. 먼저 USD 2.00 회차 하나만 실행한다.
- next_review_request: `FABLE_REVIEW`

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-s001`
- 상태: `RUN_FAILED`
- terminal_reason: `budget_exhausted`
- primary_error: `CLAUDE_EXECUTION_FAILED`
- 실제 사용량: `$2.855787`
- 구조화 결과: 없음. PASS·Finding·유효 검수 회차로 세지 않는다.
- 분석: 다섯 문서 전체 약 24만 바이트를 한 회차에 넣어 USD 2.00 요청 상한 안에서 구조화 응답을 끝내지 못했다. 기존 두 문서의 유효 Fable PASS를 계승하고, 이번 판본에서 바뀐 세 문서만 원문으로 보내며 두 기존 문서는 고정 해시·축소 증거로 결속한 successor Task로 재검수한다.
- next_review_request: `SUCCESSOR_TASK`
