
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-h001`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- verified_input_files_sha256: `Fable 실행기 preflight 전 중단으로 manifest 미생성`
- artifact_hashes: `MODEL-ACCESS.md 및 11개 manifest, model-plan은 WORKING_TREE_HASHED Task 입력으로 지정됨`
- finding_ids: `[]`
- 실행 명령: `node scripts/docs-graph-check.mjs --activation`; Project Orchestrator validate/budget/seal/verify; `corepack pnpm fable:review -- --task AI-CHAT-MODEL-ACCESS-ALL-11-001 --round 1 --max-budget-usd 2.00 --allow-soft-budget --single-pass`
- 종료 코드·결과: 문서 그래프 PASS (40 files, 19 contexts), model plan SHA `60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e` VERIFIED. Fable 호출은 exit 69로 모델 호출 전 차단: 설치된 Claude Code `2.1.259`은 실행기 허용 regex `2.1.248|250`에 없음.
- 미실행 항목과 이유: Fable 구조화 verdict 없음. 이는 provider budget/rate/capacity가 아닌 로컬 runner version gate이므로 Opus fallback 조건이 아니며 대체 호출하지 않았다.
- next_review_request: `HUMAN_DECISION`
