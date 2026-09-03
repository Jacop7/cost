# AI-ORCH-STAGE10-VERIFY-GRAPH-036 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `36a83f89811cdf0b40c594f5eb80ee6dc3085311`

## 요약

AI-ORCH-STAGE10-VERIFY-GRAPH-036 초기 검수(FABLE-ARCH, 봉인 스냅샷 단일 패스) 결과 PASS. (1) 문서 그래프 activation 검사(`scripts/docs-graph-check.mjs --activation`)와 회귀시험 실행(`node --test scripts/docs-graph-check.test.mjs`)이 기존 ③단계 콜백 내부(verify.mjs 117–118행)에 삽입되어 있고, 두 호출 모두 순수 node 실행이라 `--no-db`/`--no-bundle` 여부와 무관하게 항상 실행된다. (2) 각 검사는 조기 `return false`로 즉시 ③단계를 실패시키며, 문서 그래프 실패 시 이후의 Git Bash `admin-acl.test.sh`(119–120행)는 아예 실행되지 않으므로 후속 보안 검사 성공으로 실패가 은폐될 경로가 없다. 스크립트 파일이 없어도 node가 비-0으로 종료하여 fail-closed다. (3) 여섯 단계 분모는 유지된다: `--no-db`는 ④⑤를 skipped 항목으로 push(123–125행), `--no-bundle`은 ⑥을 skip(180–181행)하며, 최종 요약은 건너뜀이 있으면 `선택 범위 검증 통과 (n/6단계) — 전체 통과가 아니다`를 출력(217–226행)한다. `--no-db --no-bundle`이면 ①②③ 실행으로 3/6이 되어 required_evidence 문구와 일치한다. ③단계 라벨과 파일 머리주석(10행, 109행)도 AGENTS.md 106행의 「③ CLI 고정 계약·ACL 셸 보안·문서 그래프」 서술과 정합한다. 남는 사항은 Improvement 2건뿐이다: (a) 수정된 행(10, 109, 116–119행)이 LF로 끝나 나머지 CRLF 파일과 줄끝이 혼재함, (b) 「13개 회귀시험」 개수와 `corepack pnpm verify --no-db --no-bundle` 3/6 통과는 시험 파일이 봉인 입력 밖이라 본 스냅샷에서 확인 불가하며 CODEX-FUNCTION-QA 실행 증거로 확인해야 함. 두 건 모두 비차단이므로 remaining_required_finding_ids는 비어 있고 PASS를 반환한다. PASS·VERIFIED는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 유지된다.

## Findings

### VERIFY-GRAPH-036-EOL-MIXED — Improvement / OPEN

- 범주: CODE
- 영향: 기능 영향 없음. 향후 커밋에서 줄끝 정규화가 끼어들며 diff가 부풀고 해시 봉인 비교가 번거로워질 수 있는 유지보수성 문제다.
- 근거: scripts/verify.mjs:109
- 완료 조건: scripts/verify.mjs의 모든 행이 단일 줄끝 규약(CRLF)으로 통일된다. / 정규화 후 corepack pnpm verify --no-db --no-bundle이 동일하게 3/6 통과한다.
- 필요한 테스트: 줄끝 정규화 후 node scripts/verify.mjs --no-db --no-bundle 재실행으로 동작 불변 확인

### VERIFY-GRAPH-036-QA-EVIDENCE-PENDING — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 구조는 fail-closed이나, 13개 회귀시험의 실존·개수와 실제 3/6 통과는 실행 증거로만 닫힌다. 증거 없이 게이트를 진행하면 시험 파일 누락·개수 불일치가 뒤늦게 발견될 수 있다.
- 근거: scripts/verify.mjs:117, COLLABORATION_LOG:0
- 완료 조건: CODEX-FUNCTION-QA가 corepack pnpm verify --no-db --no-bundle 실행 로그로 ③단계에 문서 그래프 검사 포함과 선택 범위 3/6 통과를 증거로 제출한다. / node --test scripts/docs-graph-check.test.mjs 출력에서 통과 시험 수 13개가 확인된다.
- 필요한 테스트: corepack pnpm verify --no-db --no-bundle (③ 포함 3/6 통과 로그) / node --test scripts/docs-graph-check.test.mjs (13개 시험 통과 카운트 확인)

## 공동 편집 제안

### EDIT-VERIFY-GRAPH-036-EOL — COMMENT

- 대상: `scripts/verify.mjs`
- 위치:   if (!run('node', ['scripts/docs-graph-check.mjs', '--activation'])) return false;
- 연결 Finding: VERIFY-GRAPH-036-EOL-MIXED
- 이유: 한 파일 안 줄끝 혼재는 이후 자동 정규화로 인한 diff 잡음과 해시 봉인 비교 부담을 만든다. 실행 의미 변화 없는 정리 제안이다.

    이번 diff에서 추가·수정된 행(10, 109, 116–119행)만 LF 줄끝이라 파일의 기존 CRLF 규약과 혼재합니다. 통합 시 해당 행들의 줄끝을 CRLF로 정규화해 파일 전체를 단일 규약으로 맞춰 주시기 바랍니다. 코드 내용 변경은 없습니다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
