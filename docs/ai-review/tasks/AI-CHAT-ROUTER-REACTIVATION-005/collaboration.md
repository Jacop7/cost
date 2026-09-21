# AI-CHAT-ROUTER-REACTIVATION-005 공동 작업 장부

> 이 장부의 비-Fable 턴은 `pnpm fable:append`로만 추가한다. Fable은 최소 봉인 snapshot을 읽기 전용으로 검수하며 정책·제품 파일을 직접 수정하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: policy·activation Decision·receipt·reactivation Decision evidence
- 충족해야 할 요구사항·불변식: current SHA 결속, exact non-production scope, endpoint rebind 이전 dispatch 금지, ACK 의미 보존
- 이번에 바꾼 내용: 현재 권위 설계 SHA와 인간 재활성화 결정을 activation 계약에 반영했다. 이전 evidence bytes가 변경돼 새 독립검수가 필요하다.
- 집중 검토 질문: 이 재봉인이 이전 승인보다 범위를 넓히거나, 새 endpoint binding·수신 ACK 없이 실제 전달을 가능하게 하는가?
- 실행한 테스트·현재 증거: sealed model plan verified; 현재 policy validation은 기존 evidence hash mismatch에서 fail-closed다.
- 사람 결정이 필요한 항목: 없음. 사용자가 비운영 자동 라우팅 재활성화를 승인했다.
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001`
- task_budget_usd_approved: `1.00`
- soft_budget_overrun_risk_accepted: `r001@1.00`
- 결정: 현재 권위 문서 기준의 비운영 채팅 자동 라우팅 재활성화를 승인한다.
- 허용 범위·기한: 현재 설계 기준 11개 allowlist 비운영 메시지 재활성화의 독립검수 1회.
- 금지: human relay, 자동 새 작업, 제품·DB·Supabase·git·staging·production·비밀·배포 mutation.
- 승인자·시각: `HUMAN-CHIEF · 2026-09-04T13:28:56+09:00`
- next_review_request: `FABLE_REVIEW`
