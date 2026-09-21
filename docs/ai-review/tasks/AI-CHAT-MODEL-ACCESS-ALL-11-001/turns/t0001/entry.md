
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: `docs/team/MODEL-ACCESS.md`, 공식 11개 chat manifest의 authority link, `.codex/mission-relay/model-plan.json`과 SHA sidecar
- 충족해야 할 요구사항·불변식: 11개 채팅 모두 Fable·Opus 호출 허용, maker/editor와 독립 reviewer 분리, Fable 우선·Opus 구조화 승계 유지, 00 상황실 read-only, 운영 사람 게이트 유지
- 이번에 바꾼 내용: 단일 모델 접근 계약을 작성하고 11개 manifest가 이를 참조하게 했으며, Stage 13 계획에 Opus fallback 검수 책임을 추가한 뒤 계획을 재봉인했다.
- 집중 검토 질문: 이 계약이 static manifest를 자동 라우터로 과장하는가, Opus 편집 허용이 같은 artifact 독립검수를 허용하는가, 00/운영 게이트가 권한 상승하는가, plan과 manifest의 허용 범위가 모순되는가?
- 실행한 테스트·현재 증거: `node scripts/docs-graph-check.mjs --activation` PASS (40 files, 19 contexts); Project Orchestrator validate/budget/seal/verify PASS; 11개 manifest의 common authority link 존재 확인.
- 사람 결정이 필요한 항목: 없음. 사용자는 Fable·Opus를 11개 채팅에서 허용했고, 이전 예산 위임에 따라 이 단일 read-only 회차의 USD 2.00 soft cap을 사용한다.
- next_review_request: `FABLE_REVIEW`
