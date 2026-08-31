
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `04bebf2788d8e389549a6be764004ff214e034e5`
- verified_input_files_sha256: `49c226e5036186f049b9ef4783c6ac22b344c1b7a63cab8478e5615ebc5b3d3f`
- artifact_hashes: target commit의 COMMIT manifest와 input hash로 봉인됨
- finding_ids: 없음
- 실행 명령: 권위 작업 루트에서 `corepack pnpm verify`; `corepack pnpm fable:review -- --task INTL-1A-COMMIT-001 --round 1`; GitHub Actions API로 anchor `d71ad3e00aa2381fc89b539326444ea2353e6557`의 정확한 run `33365651264` 확인.
- 종료 코드·결과: 로컬 verify 6/6(DB 37/37, core 183·3 skipped, mobile 212, 새 DB·경합·국제 parity, upgrade 14/14, 웹 번들) exit 0. Fable PASS·미해결 Finding 0. feature anchor의 Node 20.19.4, Node 24, full-db-required, protected-gate 모두 completed/success.
- 증거 파일·로그 위치: `docs/ai-review/tasks/INTL-1A-COMMIT-001/rounds/r001/review.json`, `run.json`, https://github.com/Jacop7/cost/actions/runs/33365651264
- 미실행 항목과 이유: 스테이징·production migration은 INTL-1F와 별도 사람 승인 전이므로 접근·적용하지 않았다.
- next_review_request: `AI_DEPUTY_GATE_REVIEW`
