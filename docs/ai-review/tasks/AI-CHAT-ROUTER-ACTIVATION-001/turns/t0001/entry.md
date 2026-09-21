
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: `.codex/team-router/activation-decision.json`, `.codex/team-router/activation-receipt.json`, `.codex/team-router/policy.json`, `docs/team/DECISIONS.md`, `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md`, `scripts/fable-review.mjs`, `docs/ai-review/README.md`
- 충족해야 할 요구사항·불변식: exact human approval·policy·design·model plan·artifact·review SHA 결속, 11개 exact edge, source endpoint generation 검증, SENT_UNCONFIRMED와 DELIVERED 분리, runtime ACL, non-production-only 경계
- 이번에 바꾼 내용: active dispatch를 별도 Decision과 receipt에 봉인하고, 초기 endpoint binding·prepare-dispatch·delivery receipt CLI 및 sabotage test를 추가했다. Claude Code 2.1.259의 기존 격리 인자 호환을 확인하고 runner allowlist와 문서를 갱신했다.
- 집중 검토 질문: 활성화 receipt가 현재 bytes 변조를 충분히 차단하는가, 원시 endpoint가 공식 산출물에 새는가, 앱 도구 acceptance를 delivery로 과장하는가, 이 Decision이 DB·Supabase·git·staging·production 권한을 잘못 여는가?
- 실행한 테스트·현재 증거: Team Router 34/34 PASS; Fable wrapper self-test 52 bundles PASS; active policy VALID; 11 chats·21 edges VALID; runtime ACL inheritance protected and only current user/SYSTEM FullControl; 11 initial endpoints generation 1 bound.
- 사람 결정이 필요한 항목: 없음. 정확한 활성화 승인문과 USD 4.00 단일-pass soft cap 위험 수용이 이미 기록됐다.
- next_review_request: `FABLE_REVIEW`
