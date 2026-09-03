# AI-ORCH-PLANS-ONTOLOGY-LINEAGE-COMMIT-020 공동 작업 장부

> 온톨로지 HANDOFF 위치 결함을 고정 commit에서 재현해 정식 predecessor→successor 재검수 계보를 만든다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `40c37c76f2b3af75a5fbca53b6d374178c63b25d`
- changed_artifact_paths: `docs/AI-지식-온톨로지-기획안.md`
- finding_ids: `FAB-ARCH-019-HANDOFF-LOCATION-001`
- 집중 검토 질문: HANDOFF 원본 위치의 표·본문 불일치와 물질화 전 위치 미정 원인이 target commit에 존재하는가? 존재하면 같은 ID·OPEN·previous_finding_id null로 반환하라.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `FAB-ARCH-019-HANDOFF-LOCATION-001`
- decision_id: `DEC-AI-FABLE-ONTOLOGY-LINEAGE-PREDECESSOR-BUDGET-021`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 사용자의 상시 예산 재량 위임에 따라 AI 부 오케스트레이터가 온톨로지 고정 commit predecessor 검수의 soft cap을 USD 4.00으로 선택한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 4.00을 넘을 수 있다.
- 허용 범위: target commit의 온톨로지 문서에 대한 읽기 전용 Finding 재현 감사 1회.
- 금지: 동일 회차 중복 호출과 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=d68e4995a2bbbe9de91441975302758de2a6c09cc05c143de27cacdd86958367 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `d68e4995a2bbbe9de91441975302758de2a6c09cc05c143de27cacdd86958367`
- target_commit_sha: `40c37c76f2b3af75a5fbca53b6d374178c63b25d`
- input_files_sha256: `8ea448bd8d1e17fe9b7f5d7712dcc2bcac3d6c06e6c93c911793d3818ea3d213`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: FAB-ARCH-019-HANDOFF-LOCATION-001
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

고정 commit 40c37c76f2b3af75a5fbca53b6d374178c63b25d의 온톨로지 문서에서 FAB-ARCH-019-HANDOFF-LOCATION-001의 원인이 재현됨을 확인했다. (1) §3 표의 HANDOFF 행(96행)은 일반 Task HANDOFF의 권위 위치를 "docs/작업큐.md의 Task snapshot"으로 선언하지만, 본문(118~122행)은 물질화 뒤 봉인 원본의 단일 위치를 docs/team/handoffs/<TASK-ID>/*.md로 지정하고 docs/작업큐.md에는 최신 handoff_id·handoff_version·원본 경로·content hash pointer만 두라고 규정해 표와 본문이 충돌한다. 이는 AGENTS:single-canonical-artifact 불변식(단일 권위 원본)과 어긋난다. (2) 118행은 물질화 전에도 append-only 원본 보존을 요구하지만 그 원본의 위치를 지정하지 않으며, §14 미결 구현 결정(540~548행)에도 해당 위치 결정이 등록되어 있지 않다(546행은 장기 보존 기간·아카이브 매체만 다룬다). 위치 없는 보존 의무는 §11의 14·15항 계보 검증이 검사할 대상을 잃게 한다. (3) 검수 successor HANDOFF의 collaboration.md 전용 append 계약은 표(96행)와 본문(104~105, 121~122행)에서 일관되게 유지되어 요구 5는 충족된다. 지시에 따라 같은 ID를 OPEN·previous_finding_id null로 등록하고, §3 표 행 교체와 물질화 전 봉인 위치 지정을 위한 proposed_edits 2건을 첨부한다. Major 미해결 Finding이 있으므로 판정은 CHANGES_REQUIRED이며, 후속 수정 commit에 대한 successor RECHECK에서 같은 ID로 승계 검증해야 한다.

### 공동 편집 제안 색인

- EDIT-020-HANDOFF-TABLE-ROW: REPLACE `docs/AI-지식-온톨로지-기획안.md` · | `HANDOFF` | `docs/작업큐.md`의 Task snapshot 또는 검수 `collaboration.md`의 전용 인계 턴 | 새 채팅·역할·검수 successor가 같은 Task를 복원하도록 기존 권위 상태를 봉인한 비권위 snapshot | · 원문은 review.md 참조
- EDIT-020-PREMATERIALIZATION-LOCATION: ADD `docs/AI-지식-온톨로지-기획안.md` · `collaboration.md`의 전용 append 명령을 사용한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `AI-ORCH-PLANS-ONTOLOGY-LINEAGE-COMMIT-020`
- predecessor_round: `r001`
- predecessor_task_sha256: `c4eb150291a69a05d6b5988bb0038c894a1eedbb50c1d6bf8b6908a94e2a68ed`
- predecessor_manifest_sha256: `fb4e1128a8e2b6bf0298e04fe745195ebe4f820ec27e94d75e162259fe5e1fca`
- predecessor_review_sha256: `d68e4995a2bbbe9de91441975302758de2a6c09cc05c143de27cacdd86958367`
- predecessor_run_sha256: `2a5e1d1d6547f4d96005a7749a85ef5e760154d3b1b21c396447a592baff1ed3`
- finding_registry_sha256: `ea1efb09b76f2c744abdb2c458a33687b7dda8a7d0b286ea62392f0c87df881c`
- successor_task_id: `AI-ORCH-PLANS-ONTOLOGY-LINEAGE-RECHECK-021`
- successor_target_commit_sha: `ad966959b6228d837907b0c2b9e92dcccc6a9944`
- next_review_request: `FABLE_RECHECK`
