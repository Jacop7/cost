# AI-ORCH-STAGE10-VERIFY-GRAPH-036 공동 작업 장부

> 기존 6단계 verify 안에 문서 그래프 검사를 연결한 최소 변경의 읽기 전용 감사다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `36a83f89811cdf0b40c594f5eb80ee6dc3085311`
- 요청: verify ③단계에 activation graph 검사와 13개 회귀시험을 연결한 최소 diff만 읽기 전용으로 확인한다.
- 확인: 6단계 분모 유지, --no-db/--no-bundle의 명시적 skip 유지, graph failure fail-closed, DB·제품·배포 범위 비변경.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-STAGE10-VERIFY-GRAPH-BUDGET-036`
- task_budget_usd_approved: `4.00`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 사용자의 자동 진행 지시에 따라 Fable 단일 패스 읽기 전용 감사를 실행한다.
- 위험 고지: USD 4.00은 soft cap이며 실제 결제 하드캡이 아니다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=cfa1bb76645d40709cbc3de0eb364ef562a8285b1e18f58a3dbf5b52e2326b6c -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `cfa1bb76645d40709cbc3de0eb364ef562a8285b1e18f58a3dbf5b52e2326b6c`
- target_commit_sha: `36a83f89811cdf0b40c594f5eb80ee6dc3085311`
- input_files_sha256: `797a402309e90297f3d8bac316e7d6580ee90d40b74c29d48e0ab6dd8829bde2`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: VERIFY-GRAPH-036-EOL-MIXED, VERIFY-GRAPH-036-QA-EVIDENCE-PENDING
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

AI-ORCH-STAGE10-VERIFY-GRAPH-036 초기 검수(FABLE-ARCH, 봉인 스냅샷 단일 패스) 결과 PASS. (1) 문서 그래프 activation 검사(`scripts/docs-graph-check.mjs --activation`)와 회귀시험 실행(`node --test scripts/docs-graph-check.test.mjs`)이 기존 ③단계 콜백 내부(verify.mjs 117–118행)에 삽입되어 있고, 두 호출 모두 순수 node 실행이라 `--no-db`/`--no-bundle` 여부와 무관하게 항상 실행된다. (2) 각 검사는 조기 `return false`로 즉시 ③단계를 실패시키며, 문서 그래프 실패 시 이후의 Git Bash `admin-acl.test.sh`(119–120행)는 아예 실행되지 않으므로 후속 보안 검사 성공으로 실패가 은폐될 경로가 없다. 스크립트 파일이 없어도 node가 비-0으로 종료하여 fail-closed다. (3) 여섯 단계 분모는 유지된다: `--no-db`는 ④⑤를 skipped 항목으로 push(123–125행), `--no-bundle`은 ⑥을 skip(180–181행)하며, 최종 요약은 건너뜀이 있으면 `선택 범위 검증 통과 (n/6단계) — 전체 통과가 아니다`를 출력(217–226행)한다. `--no-db --no-bundle`이면 ①②③ 실행으로 3/6이 되어 required_evidence 문구와 일치한다. ③단계 라벨과 파일 머리주석(10행, 109행)도 AGENTS.md 106행의 「③ CLI 고정 계약·ACL 셸 보안·문서 그래프」 서술과 정합한다. 남는 사항은 Improvement 2건뿐이다: (a) 수정된 행(10, 109, 116–119행)이 LF로 끝나 나머지 CRLF 파일과 줄끝이 혼재함, (b) 「13개 회귀시험」 개수와 `corepack pnpm verify --no-db --no-bundle` 3/6 통과는 시험 파일이 봉인 입력 밖이라 본 스냅샷에서 확인 불가하며 CODEX-FUNCTION-QA 실행 증거로 확인해야 함. 두 건 모두 비차단이므로 remaining_required_finding_ids는 비어 있고 PASS를 반환한다. PASS·VERIFIED는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 유지된다.

### 공동 편집 제안 색인

- EDIT-VERIFY-GRAPH-036-EOL: COMMENT `scripts/verify.mjs` ·   if (!run('node', ['scripts/docs-graph-check.mjs', '--activation'])) return false; · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
