# AI-ORCH-PLANS-ONTOLOGY-LINEAGE-COMMIT-020 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `40c37c76f2b3af75a5fbca53b6d374178c63b25d`

## 요약

고정 commit 40c37c76f2b3af75a5fbca53b6d374178c63b25d의 온톨로지 문서에서 FAB-ARCH-019-HANDOFF-LOCATION-001의 원인이 재현됨을 확인했다. (1) §3 표의 HANDOFF 행(96행)은 일반 Task HANDOFF의 권위 위치를 "docs/작업큐.md의 Task snapshot"으로 선언하지만, 본문(118~122행)은 물질화 뒤 봉인 원본의 단일 위치를 docs/team/handoffs/<TASK-ID>/*.md로 지정하고 docs/작업큐.md에는 최신 handoff_id·handoff_version·원본 경로·content hash pointer만 두라고 규정해 표와 본문이 충돌한다. 이는 AGENTS:single-canonical-artifact 불변식(단일 권위 원본)과 어긋난다. (2) 118행은 물질화 전에도 append-only 원본 보존을 요구하지만 그 원본의 위치를 지정하지 않으며, §14 미결 구현 결정(540~548행)에도 해당 위치 결정이 등록되어 있지 않다(546행은 장기 보존 기간·아카이브 매체만 다룬다). 위치 없는 보존 의무는 §11의 14·15항 계보 검증이 검사할 대상을 잃게 한다. (3) 검수 successor HANDOFF의 collaboration.md 전용 append 계약은 표(96행)와 본문(104~105, 121~122행)에서 일관되게 유지되어 요구 5는 충족된다. 지시에 따라 같은 ID를 OPEN·previous_finding_id null로 등록하고, §3 표 행 교체와 물질화 전 봉인 위치 지정을 위한 proposed_edits 2건을 첨부한다. Major 미해결 Finding이 있으므로 판정은 CHANGES_REQUIRED이며, 후속 수정 commit에 대한 successor RECHECK에서 같은 ID로 승계 검증해야 한다.

## Findings

### FAB-ARCH-019-HANDOFF-LOCATION-001 — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 일반 Task HANDOFF 봉인 원본의 소유 위치가 §3 표(docs/작업큐.md)와 본문(docs/team/handoffs/)으로 갈려 successor가 §6.4 복원 시 어느 위치를 권위 원본으로 읽어야 하는지 결정할 수 없고, 물질화 전 발행분은 보존 위치 자체가 없어 §11의 14·15항이 요구하는 handoff_version 단조성·content hash·append-only 계보 검증이 검사 대상을 잃는다. 결과적으로 AI-ONTOLOGY:handoff-lineage 계보 무결성과 AGENTS:single-canonical-artifact 단일 권위 불변식이 동시에 훼손된다.
- 근거: docs/AI-지식-온톨로지-기획안.md:96, docs/AI-지식-온톨로지-기획안.md:118, docs/AI-지식-온톨로지-기획안.md:540, AGENTS.md:20
- 완료 조건: §3 표의 HANDOFF 행과 §3 본문이 일반 Task HANDOFF 봉인 원본의 단일 위치로 같은 경로(docs/team/handoffs/<TASK-ID>/*.md)를 선언한다. / 물질화 전 일반 Task HANDOFF의 append-only 원본 위치가 본문에 지정되거나, §14 미결 구현 결정 목록에 명시적 항목으로 등록된다. / docs/작업큐.md는 문서 전체에서 일반 HANDOFF 원본 소유자가 아니라 최신 handoff_id·handoff_version·원본 경로·content hash pointer 소유자로만 기술된다. / 검수 successor HANDOFF의 collaboration.md 전용 append 계약은 표·본문 모두에서 변경 없이 유지된다.
- 필요한 테스트: 후속 수정 commit에 대한 FABLE-ARCH successor RECHECK에서 §3 표·본문 위치 일치와 물질화 전 위치 지정(또는 §14 등록)을 같은 ID로 재검증한다. / 후속 docs-graph-check 구현 Task에서 HANDOFF 노드의 권위 위치가 단일 경로인지와 append-only 계보 검사 대상 경로가 존재하는지를 사보타주 fixture로 확인한다.

## 공동 편집 제안

### EDIT-020-HANDOFF-TABLE-ROW — REPLACE

- 대상: `docs/AI-지식-온톨로지-기획안.md`
- 위치: | `HANDOFF` | `docs/작업큐.md`의 Task snapshot 또는 검수 `collaboration.md`의 전용 인계 턴 | 새 채팅·역할·검수 successor가 같은 Task를 복원하도록 기존 권위 상태를 봉인한 비권위 snapshot |
- 연결 Finding: FAB-ARCH-019-HANDOFF-LOCATION-001
- 이유: §3 표가 일반 Task HANDOFF 봉인 원본의 권위 위치를 docs/작업큐.md로 선언해 본문(118~122행)의 docs/team/handoffs/ 단일 위치·작업큐 pointer-only 규정과 충돌하므로, 표를 본문과 같은 단일 위치 선언으로 교체해 AGENTS:single-canonical-artifact 불변식을 회복한다.

    | `HANDOFF` | 일반 Task는 `docs/team/handoffs/<TASK-ID>/*.md` 봉인 원본, 검수 successor는 검수 `collaboration.md`의 전용 인계 턴. `docs/작업큐.md`는 최신 pointer만 소유 | 새 채팅·역할·검수 successor가 같은 Task를 복원하도록 기존 권위 상태를 봉인한 비권위 snapshot |

### EDIT-020-PREMATERIALIZATION-LOCATION — ADD

- 대상: `docs/AI-지식-온톨로지-기획안.md`
- 위치: `collaboration.md`의 전용 append 명령을 사용한다.
- 연결 Finding: FAB-ARCH-019-HANDOFF-LOCATION-001
- 이유: 118행이 물질화 전 append-only 보존을 요구하면서 원본 위치를 지정하지 않아 §11의 14·15항 계보 검증이 검사 대상을 잃으므로, 발행 시점에 동일 봉인 위치를 생성하는 기본값을 지정하고 예외 선택만 §14 미결 결정으로 위임한다.

    물질화 전에 발행되는 일반 Task HANDOFF 원본도 발행 시점에 `docs/team/handoffs/<TASK-ID>/` 디렉터리를
    생성해 같은 위치에 append-only로 봉인하며, 별도 임시 매체를 쓰는 선택이 필요하면 그 결정은 §14의
    미결 구현 결정으로만 남긴다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: FAB-ARCH-019-HANDOFF-LOCATION-001

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
