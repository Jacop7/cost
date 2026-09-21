
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-h001`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- verified_input_files_sha256: `WORKING_TREE_HASHED task snapshot에서 runner가 계산·봉인`
- artifact_hashes: `활성화 구현 증거 001의 exact SHA 표와 activation-receipt.json에 결속`
- finding_ids: `[]`
- 실행 명령: `python -m unittest discover` Team Router; `corepack pnpm fable:review -- --self-test`; Team Router `validate-policy`; `validate-manifests`; Windows `Get-Acl`
- 종료 코드·결과: Router 34/34 PASS, wrapper 52 bundles PASS, ACTIVE_DISPATCH policy valid with humanRelay false, 11 chats·21 edges valid, ACL protected, 11 endpoints generation 1 bound.
- 미실행 항목과 이유: 첫 실제 비운영 dispatch는 이 Fable 회차에 필수 OPEN Finding이 없음을 확인하기 전이라 의도적으로 미실행했다.
- next_review_request: `FABLE_REVIEW`
