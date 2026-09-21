
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: activation Decision·receipt·policy, DECISIONS 장부, 활성화 구현 증거 001
- 충족해야 할 요구사항·불변식: exact SHA 결속, exact edge/source generation, delivery 증명, runtime ACL, non-production-only
- 이번에 바꾼 내용: 비운영 active dispatch 봉인과 초기 endpoint/prepare/receipt 실행 경계를 구현했다.
- 집중 검토 질문: 변조·endpoint 노출·가짜 delivery·권한 상승이 남아 있는가?
- 실행한 테스트·현재 증거: Router 34/34, wrapper 52, policy/manifests valid, ACL protected, 11 endpoints bound.
- 사람 결정이 필요한 항목: 없음.
- next_review_request: `FABLE_REVIEW`
