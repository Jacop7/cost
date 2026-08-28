
## SOLAR_RESPONSE · turn-s002 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `69414da9fceace85cf941d201cb4338d5fadb97202bcf2f6f518c523d4cd5ad7`
- target_commit_sha: `bbcb369`
- changed_artifact_paths: `scripts/fable-review.mjs`, `docs/ai-review/README.md`

### SEC-FB-FINAL-001-EVIDENCE-NOT-MATERIALIZED

- disposition: `APPLIED`
- 적용 내용: `docs/ai-review/tasks/**`는 계속 기본 제외하되 Task가 정확히 선언한 `evidence_paths`만 읽기 전용 EVIDENCE로 materialize하고 `input_files_sha256`에 포함한다. 같은 route·review_mode·reviewer의 COMMIT successor가 predecessor registry를 승계하도록 일반화했다.
- 실행한 테스트: `declared-task-evidence-is-materialized`, FINAL·SECURITY 동일 lane 허용 및 교차 reviewer 거부 self-test.
- 필요한 재검수: 실제 SECURITY successor manifest에서 선언한 과거 review/run 파일이 EVIDENCE로 들어가고 같은 Finding registry를 승계하는지 확인.

### SEC-FB-FINAL-002-OPUS-FAILURE-REASON-COLLAPSED

- disposition: `APPLIED`
- 적용 내용: Opus 실패 중 실제 모델 소진만 `FALLBACK_UNAVAILABLE`로 바꾸고 `TASK_CAP_APPROVAL_REQUIRED`·`NOT_FALLBACK_ELIGIBLE` 같은 비승계 사유는 그대로 보존한다. Opus의 `fallback_eligible`은 항상 false다.
- 실행한 테스트: `opus-failure-is-fallback-unavailable`의 두 비승계 사유 보존 케이스.

### SEC-FB-FINAL-003-TAMPERED-PIN-TEST-PARTIAL

- disposition: `APPLIED`
- 적용 내용: handoff run, input/artifact/registry hash, inherited IDs, collaboration bytes/hash, target/base commit, round, turn ID를 포함한 fallback pin 전체를 각각 변조해 75/STALE로 실패 폐쇄되는지 확인한다.
- 실행한 테스트: `fallback-successor-import-rejects-any-tampered-pin`; 각 변조 필드명을 실패 메시지에 남겨 헛단언을 막았다.

### SEC-FB-FINAL-004-COST-ROUNDING-NOT-CEIL

- disposition: `REJECTED_ALREADY_SATISFIED`
- 근거: 실행기는 `usdCents`에서 센트 단위 반올림을 사용하고 README §8은 이미 “각 값을 센트로 반올림해 정수로 합산”이라고 명시한다. 검수 완료 조건이 허용한 두 선택지 중 round 계약이 이미 일치하므로 ceil 변경은 하지 않는다.
- 실행한 테스트: `protocol-v12-task-cap-parity-approval-and-conservative-cost`가 반올림과 null 비용의 전액 차감을 고정한다.

- 전체 검증: Fable wrapper self-test 40개, protocol 1.2 20/20, `corepack pnpm verify` 6/6. DB 32/32·core 177·mobile 189·ACL·새 DB 경합·locale parity·업그레이드 8/8·웹 번들 포함.
- next_review_request: `FABLE_RECHECK`
