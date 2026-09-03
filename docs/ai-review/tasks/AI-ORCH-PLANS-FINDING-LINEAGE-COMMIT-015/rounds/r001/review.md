# AI-ORCH-PLANS-FINDING-LINEAGE-COMMIT-015 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `6e99bd93b737bf291f14a8d3a6465a1d5110fa6c`

## 요약

고정 commit 6e99bd93b737bf291f14a8d3a6465a1d5110fa6c에서 두 기존 Finding의 원인 재현 여부를 감사했다.

[재현됨] FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002: docs/팀구성_상세기획안.md §4.4의 "R0·R1 자동 종결 조건" 목록(1028행 시작)에서 1039행(anchor commit·decision commit 고정 조건)과 1040행(보호 원격 필수 체크·protected-gate 봉인 조건)이 원문에서 둘 다 "10."으로 번호가 중복돼 있고 문자 그대로의 "11." 항목이 없어 1~11 단일 오름차순 번호가 성립하지 않는다. 마크다운 렌더러는 자동 재번호로 10·11처럼 표시하므로 원문 결함이 은폐되고, "조건 10" 인용이 서로 다른 두 게이트 조건 사이에서 모호해진다. Task 지시대로 같은 ID·OPEN·previous_finding_id null로 등록했고, 1040행을 "11."로 재번호하는 단일 행 수정안을 proposed_edits로 제출했다.

[재현 안 됨] FAB-ARCH-006-MASTER-DEPUTY-BOUNDARY-001: 두 판정 기준을 모두 확인했으나 target commit에서는 원인이 존재하지 않는다. (1) "AI 마스터" 역할 미등록 — 두 문서 어디에도 AI 마스터 역할이 참조되지 않으며 "마스터"는 채팅 그룹·채팅 이름(MarginCook · 마스터 작업, 00 마스터 오케스트레이션)으로만 쓰이고, 해당 채팅은 "목표·우선순위·최종 사람 결정"으로 사람 소유로 명시된다(오케스트레이션안 89~90행, 팀구성안 160~162행). 오케스트레이션안이 사용하는 모든 역할 컨텍스트 ID(SOLAR-*, CODEX-*, FABLE-*, OPUS-FALLBACK, CONTEXT-STEWARD; 348~356행 등)는 팀구성안 §5.1(1062~1082행)에 등록돼 있다. (2) 요청 정규화·Task 라우팅·팀 배정 소유권 불일치 — 오케스트레이션안 §2(69~75행)는 요청 해석자·작업 그래프·실행 라우터의 소유자를 AI 부 오케스트레이터로 지정하고 채팅 01(91~92행)이 요청 정규화·Task 라우팅을 수행하며, 팀구성안도 §3.2(255~256행)에서 같은 책임을 솔라 AI 부 오케스트레이터에 부여하고 RACI(924행)에서 사람 A · AI 부 O R로 일치한다. 정식 이름·소속의 단일 소유는 팀구성안 §1.4로 명시적으로 위임돼 있다(오케스트레이션안 86행). 따라서 Task 요구사항의 조건부 지시("재현되면 등록")에 따라 이 ID는 등록하지 않았다.

판정: OPEN Major 1건(R0R1 번호 중복)으로 CHANGES_REQUIRED. 이 회차는 COMMIT 기반 predecessor→successor 계보의 최초 고정점이며, 후속 수정 commit에 대한 successor RECHECK에서 같은 ID로 재검수할 준비가 됐다. gate_state는 OPEN으로 유지된다.

## Findings

### FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002 — Major / OPEN

- 범주: POLICY
- 영향: R0·R1 자동 종결의 권위 체크리스트에서 "조건 10"이 서로 다른 두 규범 조건(anchor/decision commit 고정 vs 보호 원격 게이트 성공 봉인)을 동시에 가리켜 인용·감사·게이트 판정 시 모호하다. 마크다운 렌더링은 자동 재번호로 10·11처럼 표시해 원문 결함을 은폐하므로, 원문 기반 도구·diff·인용과 렌더링 기반 인용이 서로 다른 조건을 지칭할 수 있고 둘 중 한 조건이 병합·누락 조건으로 오독될 위험이 있다.
- 근거: docs/팀구성_상세기획안.md:1028, docs/팀구성_상세기획안.md:1026
- 완료 조건: docs/팀구성_상세기획안.md의 R0·R1 자동 종결 조건 목록이 원문 기준 1~11의 엄격한 오름차순 단일 번호를 가진다. / 기존 두 "10." 항목의 조건 내용(anchor/decision commit 고정, 보호 원격 필수 체크·run ID 봉인)이 모두 내용 변경 없이 보존된다. / 수정 후 문서 내·타 문서에서 해당 조건을 번호로 인용하는 곳이 없거나, 있다면 새 번호와 일치한다.
- 필요한 테스트: 수정 commit에서 해당 목록 원문을 읽어 목록 항목 번호가 1~11 오름차순으로 중복 없이 이어지는지 확인 / docs/ 전체에서 "조건 10"·"조건 11" 등 번호 인용을 grep해 잔여 모호 인용이 없는지 확인

## 공동 편집 제안

### EDIT-R0R1-COND-RENUMBER-001 — REPLACE

- 대상: `docs/팀구성_상세기획안.md`
- 위치: 10. decision commit의 정확한 SHA에서 보호 원격 필수 체크가 성공하고 보호 ref에 반영됐다. 외부 서명/attestation을 쓰더라도 같은 SHA의 `full-db-required`와 `protected-gate` 구성 job 성공 run ID·결론을 함께 봉인한다.
- 연결 Finding: FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002
- 이유: R0·R1 자동 종결 조건 목록에서 두 번째 "10." 항목을 "11."로 재번호해 원문이 1~11 단일 오름차순 번호를 갖게 하고 조건 내용은 그대로 보존한다.

    11. decision commit의 정확한 SHA에서 보호 원격 필수 체크가 성공하고 보호 ref에 반영됐다. 외부 서명/attestation을 쓰더라도 같은 SHA의 `full-db-required`와 `protected-gate` 구성 job 성공 run ID·결론을 함께 봉인한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
