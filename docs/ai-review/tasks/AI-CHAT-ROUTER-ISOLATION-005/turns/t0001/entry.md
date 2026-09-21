
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: activation receipt, 활성화 구현 증거 001, 실행 설계 v0.5
- 충족해야 할 요구사항·불변식: ISO004 required Finding 3건 해소와 previous review evidence 물질화
- 이번에 바꾼 내용: ACK 전 수신 scope lock, child prepare BLOCKED_POLICY event, 설계 v0.5, before/after SHA·판본·test 증거를 추가했다.
- 집중 검토 질문: ISO004 필수 3건이 모두 닫혔으며 재파일럿을 실행해도 되는가?
- 실행한 테스트·현재 증거: 신규 `test_active_no_child_scope_blocks_unrelated_allowed_route_until_ack`; Router 36/36; policy VALID; plugin validate/reinstall.
- 사람 결정이 필요한 항목: 없음.
- next_review_request: `FABLE_REVIEW`
