
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: policy·activation Decision·receipt·reactivation Decision evidence
- 충족해야 할 요구사항·불변식: current SHA 결속, exact non-production scope, endpoint rebind 이전 dispatch 금지, ACK 의미 보존
- 이번에 바꾼 내용: 현재 권위 설계 SHA와 인간 재활성화 결정을 activation 계약에 반영했다.
- 집중 검토 질문: 재봉인이 scope를 넓히거나 endpoint binding·ACK 없이 전달을 허용하는가?
- 실행한 테스트·현재 증거: sealed model plan verified; 기존 evidence bytes가 달라 새 검수가 필요하다.
- 사람 결정이 필요한 항목: 없음.
- next_review_request: `FABLE_REVIEW`
