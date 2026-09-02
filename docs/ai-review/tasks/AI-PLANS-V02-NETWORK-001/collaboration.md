# AI-PLANS-V02-NETWORK-001 공동 작업 장부

> 다섯 공식 기획안 v0.2 후보의 권위·다중 채팅·HANDOFF·디렉터리·평가 상호작용을 최소 입력으로
> 검수하는 장부다. 비-Fable 턴은 전용 append 명령으로만 추가한다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `3209b873d56d5914e1b05d9e04dee94108189f53`
- changed_artifact_paths: `docs/AI-오케스트레이션-상세기획안.md`, `docs/디렉터리-문서신경망-재설계-기획안.md`, `docs/AI-품질-학습-자율성-평가기획안.md`
- 충족해야 할 요구사항·불변식: 다섯 공식 문서의 단일 권위, Fable 필수 검수, 채팅 비권위, Steward 신호 전용, L0~L4·단조 HANDOFF·lease 인계, DRAFT 전 materialization 금지
- 집중 검토 질문: 마스터·부서·임시 Task 채팅이 경쟁 장부를 만드는가? rollover와 HANDOFF 사이에 권한 우회가 있는가? 디렉터리 배치·평가·스타터 키트가 앞 문서와 모순되는가?
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 68/68. 축소 증거가 공식 문서 blob·실행 코드 blob·HANDOFF 반례를 결속한다.
- 사람 결정이 필요한 항목: 유효 Fable 결과 뒤 네 DRAFT 문서를 ACTIVE로 원자 승격할지 여부. 현재 회차는 승인 누적 USD 8.00 중 남은 범위에서 최대 USD 0.92만 사용한다.
- next_review_request: `FABLE_REVIEW`

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-s001`
- 상태: `PACKET_PREFLIGHT_FAILED`
- 원인: 작업 파일 CRLF의 SHA-256을 넣어 target commit의 LF `AGENTS.md` 원문 SHA-256과 달랐다.
- 외부 Fable 호출 여부: target commit 입력 검증에서 중단되어 모델 호출·비용 사용 없음.
- 보존 결정: 발행된 Task 계약과 장부는 고치지 않고, commit blob SHA-256을 사용한 새 Task ID로 재발행한다.
- next_review_request: `SUCCESSOR_TASK`
