
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: `.codex/team-router/activation-decision.json`, `.codex/team-router/activation-receipt.json`, `.codex/team-router/policy.json`, `docs/team/DECISIONS.md`, `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md`, `scripts/fable-review.mjs`, `docs/ai-review/README.md`
- 충족해야 할 요구사항·불변식: exact approval·policy·design·model plan·artifact·review SHA 결속, exact edge, source generation, SENT_UNCONFIRMED/DELIVERED 분리, runtime ACL, non-production-only
- 이번에 바꾼 내용: active Decision/receipt, initial endpoint binding, prepare-dispatch, delivery receipt, sabotage tests, Claude Code 2.1.259 검증 allowlist를 추가했다.
- 집중 검토 질문: 변조를 충분히 차단하는가, raw endpoint가 새는가, app acceptance를 delivery로 과장하는가, DB·Supabase·git·staging·production 권한이 열리는가?
- 실행한 테스트·현재 증거: Router 34/34, Fable wrapper 52 bundles, active policy VALID, 11 chats·21 edges VALID, protected ACL, endpoint 11개 generation 1.
- 사람 결정이 필요한 항목: 없음. exact activation과 USD 4.00 soft cap 위험 수용 완료.
- next_review_request: `FABLE_REVIEW`
