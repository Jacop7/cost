
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`
- verified_input_files_sha256: `09896e24fbf7c318dcda8a2134bd0029b8f310d426c1afffc9829e6200ca0aba`
- artifact_hashes: `[{ path: docs/ai-review/fixtures/shared-coauthoring-smoke.md, sha256: ce90ad6580caa352584a90aa6413f4c412d461dad6b164aea6478524aa5de9ff, change_type: ADDED }]`
- finding_ids: `FINAL-SMOKE-002-IMP-001`
- 실행 명령: `node --check scripts/fable-review.mjs`; schema JSON 파싱; `corepack pnpm fable:self-test`; SHA-256·input metadata 재계산
- 종료 코드·결과: 전부 0; wrapper self-test 18개 묶음 통과; 수정 artifact 32줄·2,296바이트·SHA-256 `ce90ad65…e9ff`; 예상 r002 input_files_sha256 `09896e24…0aba`
- 증거 파일·로그 위치: `docs/ai-review/tasks/SETUP-V11-FINAL-002/rounds/r001/{manifest.json,input-snapshot.json,review.json,run.json,runner-source.mjs,schema-source.json}`; `docs/ai-review/tasks/SETUP-V11-FINAL-002/turns/t0001/run.json`
- 미실행 항목과 이유: P0-2 보호 원격 required check·ruleset이 아직 없어 공식 gate 종결은 실행하지 않았고 `gate_state=OPEN`을 유지한다.
- next_review_request: `FABLE_RECHECK`
