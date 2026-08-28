# SETUP-V11-FINAL-002 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 모드: `SMOKE`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`

## 요약

SMOKE 검수 결과 PASS. 단일 공식 산출물 `docs/ai-review/fixtures/shared-coauthoring-smoke.md`(sha256 64c0b747…, 28줄)를 `AGENTS.md`와 `docs/ai-review/README.md`와 대조했다. (1) FINAL-SMOKE-2 / single-canonical-artifact: 산출물 5행 "역할별 사본을 만들지 않고 이 파일 하나를 반복 개선"은 README 3–5행, 20행, 48–49행의 단일 공식본 규칙과 일치한다. (2) FINAL-SMOKE-1 / closed-loop-recheck: 산출물 9–13행과 26행의 "솔라 반영 → Finding별 응답 → CODEX_EVIDENCE → 최초 검수 역할이 같은 finding_id로 재검수 후에만 CLOSED"는 README 29–36행, 135–141행, 176–177행, 286행, 309행과 일치한다. (3) FINAL-SMOKE-3 / pass-is-not-gate-closure: 산출물 15–19행, 27–28행의 "PASS는 필수 Finding 0건 판정일 뿐, gate_state는 OPEN 유지, 공식 종결은 decision commit 동일 SHA의 보호 원격 필수 체크 성공+보호 ref 반영 또는 사전 승인 외부 attestation"은 README 289–304행과 일치한다. 필수 증거 3번(최신 실행기의 runner/schema source archive, 전체 WORKING input-snapshot, prepared collaboration-entry와 run hash 보존)은 README 64–73행, 80–88행, 111–113행, 180–193행, 312–313행에서 확인했으나 산출물 통과 조건(23행)은 페이블 검수 원본 보존만 언급한다. 이를 보완하고 P0-2 이전에는 VERIFIED까지만 가능하다는 README 303–304행의 현재 제한을 산출물에도 반영하는 Improvement 1건을 남기며, PASS를 막지 않는다. 이 PASS는 필수 Finding이 없다는 검수 판정이며 task/gate의 종결이 아니다.

## Findings

### FINAL-SMOKE-002-IMP-001 — Improvement / OPEN

- 범주: ARCHITECTURE
- 영향: 규칙 위반은 아니지만 스모크 fixture만 읽는 독자는 재검수 폐쇄 루프가 어떤 보존 기록(runner/schema 원본, input-snapshot, prepared entry, run hash)에 근거해 재현되는지와 현재 P0-2 이전에는 VERIFIED가 상한이라는 점을 알 수 없어, PASS→종결 분리 규칙이 실제 운영 제한과 어긋나게 해석될 여지가 있다.
- 근거: docs/ai-review/fixtures/shared-coauthoring-smoke.md:23, docs/ai-review/README.md:64, docs/ai-review/README.md:180, docs/ai-review/README.md:176, docs/ai-review/README.md:301
- 완료 조건: 통과 조건에 회차별 runner/schema 원본·WORKING input-snapshot·prepared collaboration-entry·run hash 보존을 한 항목으로 추가한다. / Codex 증거 항목에 명령·종료 결과·검증 SHA·증거 경로를 명시한다. / P0-2 보호 원격 필수 체크 구축 전에는 VERIFIED까지만 가능하고 공식 gate CLOSED를 선언하지 않는다는 문장을 종결 규칙에 추가한다.
- 필요한 테스트: 다음 회차 WORKING 검수에서 수정 판본 SHA-256이 collaboration.md·manifest.json·input-snapshot.json에 동일하게 기록되는지 확인

## 공동 편집 제안

### FINAL-SMOKE-002-EDIT-001 — REPLACE

- 대상: `docs/ai-review/fixtures/shared-coauthoring-smoke.md`
- 위치: - Codex는 수정 판본의 hash와 검증 결과를 공동 장부에 남긴다.
- 연결 Finding: FINAL-SMOKE-002-IMP-001
- 이유: README §2·§3·§5가 요구하는 Codex 증거 항목과 회차별 보존 기록을 스모크 통과 조건에도 반영해 필수 증거 3번과 문서를 일치시킨다.

    - Codex는 수정 판본의 hash와 함께 실행한 명령·종료 결과·검증한 SHA·증거 경로를 공동 장부에 남긴다.
    - 실행기는 회차마다 당시 runner/schema 원본, WORKING 전체 입력 원문 snapshot, prepared
      `collaboration-entry.md`와 `run.json` hash-chain을 보존해 재검수 판본을 재현할 수 있게 한다.

### FINAL-SMOKE-002-EDIT-002 — ADD

- 대상: `docs/ai-review/fixtures/shared-coauthoring-smoke.md`
- 위치: 보호 ref 반영 기록 또는 사전 승인된 외부 서명/attestation으로만 증명한다.
- 연결 Finding: FINAL-SMOKE-002-IMP-001
- 이유: README 303–304행의 현재 운영 제한을 fixture에도 명시해 PASS와 외부 종결 분리 규칙이 실제 상한과 어긋나게 읽히지 않도록 한다.

    `P0-2`의 GitHub ruleset과 필수 체크가 구축되기 전에는 Finding·task 상태를 `VERIFIED`까지만 올릴 수
    있으며 공식 gate `CLOSED`를 선언하지 않는다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
