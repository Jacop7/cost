
## CODEX_EVIDENCE · turn-c002 · r002

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- verified_input_files_sha256: `09896e24fbf7c318dcda8a2134bd0029b8f310d426c1afffc9829e6200ca0aba`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: ce90ad6580caa352584a90aa6413f4c412d461dad6b164aea6478524aa5de9ff, change_type: ADDED }]`
- finding_ids: `FINAL-SMOKE-002-IMP-001`
- 실행 명령: `corepack pnpm fable:review -- --task SETUP-V11-FINAL-002 --round 2`
- 종료 코드·결과: 76; 산출물이나 입력 STALE이 아니라 기존 Finding의 `previous_finding_id`가 같은 `FINAL-SMOKE-002-IMP-001`을 유지하지 않은 출력 계약 오류로 `RUN_FAILED` 보존
- 증거 파일·로그 위치: `docs/ai-review/tasks/SETUP-V11-FINAL-002/rounds/r002/run.json`; 저장소 밖 redacted CLI 로그
- 미실행 항목과 이유: r002 결과는 검증되지 않아 review·장부에 합류하지 않았고 Finding 상태도 변경하지 않았다. 다음 RECHECK는 같은 finding_id와 같은 previous_finding_id를 유지해야 한다.
- next_review_request: `FABLE_RECHECK`
