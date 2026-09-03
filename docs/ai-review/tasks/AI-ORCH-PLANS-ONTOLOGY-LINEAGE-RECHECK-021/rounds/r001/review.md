# AI-ORCH-PLANS-ONTOLOGY-LINEAGE-RECHECK-021 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `ad966959b6228d837907b0c2b9e92dcccc6a9944`

## 요약

수정 commit ad966959b6228d837907b0c2b9e92dcccc6a9944에서 predecessor Finding registry(sha256 ea1efb09b76f2c744abdb2c458a33687b7dda8a7d0b286ea62392f0c87df881c)의 유일한 OPEN Finding인 FAB-ARCH-019-HANDOFF-LOCATION-001을 같은 ID로 재검수했다. 수용 기준 4개를 모두 충족함을 확인했다. (1) §3 표의 HANDOFF 행(96행)이 일반 Task 봉인 원본의 물질화 뒤 단일 위치를 docs/team/handoffs/<TASK-ID>/*.md로 선언하고 docs/작업큐.md를 최신 판본 pointer 보유자로만 기술해 본문(118~122행)과 일치한다. (2) 신설 문단(124~127행)이 물질화 전 일반 Task HANDOFF 봉인 원본의 단일 임시 보존 위치를 §14 미결 구현 결정(555행)으로 등록하고, 사람 Decision 확정 전 일반 Task HANDOFF 파일 발행 금지와 작업큐 본문의 봉인 원본 사용 금지를 명시한다. (3) 문서 전체 재검색 결과 docs/작업큐.md는 HANDOFF 관련해 최신 handoff_id·handoff_version·원본 경로·content hash pointer 소유자로만 남았고, 103행의 작업큐 언급은 snapshot 생성 시 읽는 데이터 원천 설명일 뿐 봉인 원본 소유 선언이 아니다. (4) 검수 successor HANDOFF의 collaboration.md 전용 append 계약은 표(96행)와 본문(104~105·121~122·126~127행)에서 변경 없이 유지된다. 이에 따라 AGENTS:single-canonical-artifact와 AI-ONTOLOGY:handoff-lineage 위반 원인이 제거되어 해당 Finding을 VERIFIED로 전이하고 remaining_required_finding_ids에서 제외한다. VERIFIED는 국지 해소이며 보호 원격 게이트 전까지 CLOSED를 사용하지 않으므로 gate_state는 OPEN으로 유지된다. required_tests의 docs-graph-check 사보타주 fixture 검증은 후속 구현 Task 의무로 남는다. 미해결 필수 Finding이 없어 판정은 PASS다.

## Findings

### FAB-ARCH-019-HANDOFF-LOCATION-001 — Major / VERIFIED

- 범주: ARCHITECTURE
- 검증 엔진: FABLE
- 영향: predecessor commit에서는 일반 Task HANDOFF 봉인 원본 소유 위치가 §3 표(docs/작업큐.md)와 본문(docs/team/handoffs/)으로 갈려 successor 복원과 §11의 14·15항 계보 검증이 검사 대상을 잃었으나, 수정 commit에서 표·본문 단일 위치 일치, 물질화 전 위치의 §14 등록과 결정 전 발행 금지, 작업큐 pointer-only 기술, 검수 successor append 계약 유지가 모두 확인되어 AGENTS:single-canonical-artifact와 AI-ONTOLOGY:handoff-lineage 훼손 원인이 제거됐다.
- 근거: docs/AI-지식-온톨로지-기획안.md:96, docs/AI-지식-온톨로지-기획안.md:118, docs/AI-지식-온톨로지-기획안.md:124, docs/AI-지식-온톨로지-기획안.md:555, docs/AI-지식-온톨로지-기획안.md:103, AGENTS.md:20
- 완료 조건: §3 표의 HANDOFF 행과 §3 본문이 일반 Task HANDOFF 봉인 원본의 단일 위치로 같은 경로(docs/team/handoffs/<TASK-ID>/*.md)를 선언한다. / 물질화 전 일반 Task HANDOFF의 append-only 원본 위치가 본문에 지정되거나, §14 미결 구현 결정 목록에 명시적 항목으로 등록된다. / docs/작업큐.md는 문서 전체에서 일반 HANDOFF 원본 소유자가 아니라 최신 handoff_id·handoff_version·원본 경로·content hash pointer 소유자로만 기술된다. / 검수 successor HANDOFF의 collaboration.md 전용 append 계약은 표·본문 모두에서 변경 없이 유지된다.
- 필요한 테스트: 후속 수정 commit에 대한 FABLE-ARCH successor RECHECK에서 §3 표·본문 위치 일치와 물질화 전 위치 지정(또는 §14 등록)을 같은 ID로 재검증한다. — 본 RECHECK에서 수행 완료. / 후속 docs-graph-check 구현 Task에서 HANDOFF 노드의 권위 위치가 단일 경로인지와 append-only 계보 검사 대상 경로가 존재하는지를 사보타주 fixture로 확인한다. — 후속 구현 Task 의무로 유지.

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
