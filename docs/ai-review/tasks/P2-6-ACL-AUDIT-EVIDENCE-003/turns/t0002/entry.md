
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `beefc06025126f210a61b56ece492a3e55c8f1b5`
- verified_input_files_sha256: `7ff41214d5aed5660bc04173a9b330c0745352ae14011233cca38d5edb550d4a`
- artifact_hashes: `target manifest와 증거 문서의 네 Git blob OID·blob SHA-256을 대조해 일치`
- finding_ids: `P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION`, `P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE`, `P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING`, `P2-6-SEC-004-EVIDENCE-COMMIT-REF-AND-VERBATIM-BLOCK`
- 실행 명령: `node packages/db/scripts/admin-acl-source-scan.test.mjs`; `node packages/db/scripts/admin-acl-audit.test.mjs postgres`; `corepack pnpm verify`; Git blob OID·SHA-256 대조.
- 종료 코드·결과: source scan 13/13, 실제 DB audit metric 21·모바일 RPC 62·비-mobile 2, 전체 verify 6/6 exit 0, DB 34/34, 업그레이드 10/10, 웹 번들 통과.
- 증거 파일·로그 위치: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`; Fable r001 review/run SHA `8cbc06cbeac3b7c8bd00452a559e00059d886770e36e187a94caf2b4f632bdf9` / `8279333079d19d7cf611e533a4824c3b491d20e8f9240d444ed3fd38dfd5f543`.
- 미실행 항목과 이유: 호스티드 원격 ACL 적용·운영 배포는 Task 범위 밖. `fresh_%` 일회용 DB는 0개.
- Fable 판정: PASS, predecessor 필수 Finding 3건 모두 같은 ID로 VERIFIED, 필수 미해결 0건. 비차단 Improvement는 후속 문서 commit `7354c5a`에 반영했다.
- next_review_request: `AI_DEPUTY_GATE_REVIEW`
