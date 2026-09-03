
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
