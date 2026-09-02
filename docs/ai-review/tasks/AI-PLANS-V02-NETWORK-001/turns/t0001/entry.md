
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
