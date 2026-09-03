# AI-ORCH-STAGE9-SINGLE-PASS-RECOVERY-034 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `d4ed81dc2092fff8692186d987268935e282e528`

## 요약

단일 패스 축소 감사(target d4ed81d, WORKING_TREE_HASHED) 결과 CHANGES_REQUIRED(필수 Minor 1건). 범위 준수: 제공된 봉인 입력 bytes만 사용했고 단계 9 전체 재독해·단계 10·제품·DB·배포·운영 판단은 하지 않았으며, Task032/r002와 Task033/r001의 실패 run은 계보 확인에만 사용하고 PASS나 Finding 판정 근거로 재사용하지 않았다. (1) ARCH-032-DIR-ACTIVE-SELF-DRAFT 해소 확인: 디렉터리 기획안 §0 두 번째 문단이 '이 문서는 ACTIVE다. DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027에 따라…' 현재형으로 갱신됐고, 문서 전체에서 현재 상태를 부정하는 잔여 DRAFT 자기선언은 0건이다(§6·§8.2·단계 2의 DRAFT 언급은 규칙·타 문서 서술로 자기선언이 아님). 품질 기획안 §0도 동일하게 ACTIVE 현재형이다. 선택 acceptance였던 checker 보강도 구현됐다: scripts/docs-graph-check.mjs가 activation 모드에서 status ACTIVE 문서 본문의 '이 문서는 `?DRAFT`?다.' 패턴을 ACTIVE_SELF_DRAFT로 실패 폐쇄하고, test 파일에 frontmatter ACTIVE+본문 DRAFT 공존 fixture의 부정 시험이 추가됐다. (2) ARCH-032-EVIDENCE-COST-LINEAGE-STALE 해소 확인: 증거 문서 §5가 Task027 6.338000, Task028 2.677106, Task030 7.502960, Task031 비용 기록 전 중단 staging, Task032 r001 3.568507·r002 3.494104, Task033 2.314057을 전부 기록하고 누적 USD 25.894734는 합산과 정확히 일치한다. Task032/r002 run.json(budget_exhausted·review_sha256 null·3.494104)과 Task033/r001 run.json(CLAUDE_EXECUTION_FAILED·terminal_reason null·review null·2.314057)의 원본 수치와도 정합한다. (3) 유일한 새 필수 Finding(Minor): 증거 문서 §2가 'node --test scripts/docs-graph-check.test.mjs: 12/12 PASS'를 유지하는데, 현재 test 파일은 새 ACTIVE_SELF_DRAFT 부정 시험을 포함해 test() 13개라 12/12는 현재 bytes에서 재현 불가능한 낡은 계보이고, task 패킷 required_evidence의 'graph test 13/13 기존 실행 증거'도 제공 입력에 존재하지 않는다. 실제 재실행으로 13/13을 확인한 뒤 §2를 갱신해야 한다(제안 편집 첨부). activation PASS 29개 검사 파일 주장은 코드 산술(기획안 5+중앙 6+역할 5+팀 6+운영 7=29)과 정합하고 ROLE_CONTEXT 19개·simulation 71/71은 기존 기록 정합만 확인했으며 실행 재현은 CODEX-FUNCTION-QA 담당이다. 본 결과는 외부 게이트를 닫지 않으며 gate_state는 OPEN을 유지한다.

## Findings

### ARCH-034-EVIDENCE-GRAPH-TEST-COUNT-STALE — Minor / OPEN

- 범주: DATA_INTEGRITY
- 영향: 단계 9 공식 증거 문서의 graph test 계보(12/12)가 현재 test 파일(13개)과 task 패킷 required_evidence(13/13) 모두와 불일치한다. 이 문서가 결속될 마지막 exact-SHA 감사와 후속 감사자가 증거 수치를 현재 bytes로 재현할 수 없어, ARCH-032-EVIDENCE-COST-LINEAGE-STALE와 같은 유형의 증거 문서 단독 복원 불가 문제가 남는다. PASS/FAIL 자체를 위조하지는 않으므로 Minor다.
- 근거: docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-EVIDENCE.md:42, scripts/docs-graph-check.test.mjs:127, scripts/docs-graph-check.mjs:296, COLLABORATION_LOG:0
- 완료 조건: 현재 tree에서 node --test scripts/docs-graph-check.test.mjs를 실제 재실행해 13/13 PASS를 확인한다 / 증거 문서 §2의 시험 수를 13/13으로 갱신하고 사보타주 목록에 ACTIVE 기획안 본문 DRAFT 자기선언 실패 폐쇄를 추가한다 / 갱신 후 증거 문서의 모든 실행 수치(29/19·13/13·71/71)가 현재 bytes와 정합함을 확인한다
- 필요한 테스트: node --test scripts/docs-graph-check.test.mjs 재실행 결과 13/13 PASS의 실행 증거

## 공동 편집 제안

### EDIT-034-GRAPH-TEST-COUNT-UPDATE — REPLACE

- 대상: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-EVIDENCE.md`
- 위치: - `node --test scripts/docs-graph-check.test.mjs`: 12/12 PASS
- 연결 Finding: ARCH-034-EVIDENCE-GRAPH-TEST-COUNT-STALE
- 이유: 현재 test 파일은 ACTIVE_SELF_DRAFT 부정 시험 포함 13개다. 반드시 같은 tree에서 실제 재실행으로 13/13을 확인한 뒤에만 이 갱신을 반영해, 증거 문서 단독으로 graph test 계보를 현재 bytes와 required_evidence에 정합하게 복원할 수 있게 한다.

    - `node --test scripts/docs-graph-check.test.mjs`: 13/13 PASS
      - ACTIVE 기획안 본문의 DRAFT 자기선언(`ACTIVE_SELF_DRAFT`) 실패 폐쇄

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: ARCH-034-EVIDENCE-GRAPH-TEST-COUNT-STALE

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
