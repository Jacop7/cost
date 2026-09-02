
## CODEX_EVIDENCE · turn-c002 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-c001`
- target_commit_sha: `6deaf4d1beca913dde06af9721c70ada5d927577`
- finding_ids: `[]`
- 실행 명령: `corepack pnpm fable:check`; `corepack pnpm fable:self-test`
- 종료 코드·결과: Claude Code 2.1.250 로그인·연결 정상. Fable wrapper self-test 50개 묶음과 protocol 1.2 fallback 계약 22/22 통과.
- 진단: 로컬 runner·장부·schema 계약 실패는 재현되지 않았다. 외부 회차는 permission denial 0 상태에서 구조화 결과 없이 종료됐으므로 모델 실행 결과 부재로 제한해 기록한다.
- 다음 조치: 남은 승인 범위에서 재호출하지 않고 사람 결정 뒤 축소 범위 검수 또는 별도 실행기 진단 Task로 진행한다.
- next_review_request: `HUMAN_DECISION`
