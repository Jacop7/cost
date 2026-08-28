# TASK-ID 공동 작업 장부

> 이 파일은 솔라·페이블·Codex가 `task.json`의 `artifact_paths`에 지정된 같은 공식 산출물을
> 개선하는 append-only 상호작용 장부다. 새 턴은 맨 아래에 추가하고 과거 턴은 고치거나 지우지
> 않는다. `reference_paths`와 `evidence_paths`는 읽기 전용이다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR`
- reply_to_turn_id: `null`
- target_commit_sha:
- input_files_sha256:
- artifact_hashes: `[{ path, sha256, change_type }]`
- changed_artifact_paths:
- 충족해야 할 요구사항·불변식:
- 이번에 바꾼 내용:
- 집중 검토 질문:
- 실행한 테스트·현재 증거:
- 사람 결정이 필요한 항목:
- next_review_request: `FABLE_REVIEW`

<!-- FABLE_REVIEW/FABLE_RECHECK 턴은 실행기가 review 원본 링크와 hash를 아래에 자동 추가한다. -->

<!--
## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256:
- target_commit_sha:
- changed_artifact_paths:
- resulting_input_files_sha256:
- artifact_hashes: `[{ path, sha256, change_type }]`

### FINDING-ID

- disposition: `APPLIED | PARTIAL | REJECTED | NEEDS_HUMAN_DECISION`
- 적용 위치:
- 적용 내용:
- 반박 또는 부분 적용 근거:
- 실행한 테스트:
- 필요한 재검수:

- next_review_request: `CODEX_EVIDENCE | FABLE_RECHECK | HUMAN_DECISION`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX`
- reply_to_turn_id: `turn-s002`
- target_commit_sha:
- verified_input_files_sha256:
- artifact_hashes: `[{ path, sha256, change_type }]`
- finding_ids:
- 실행 명령:
- 종료 코드·결과:
- 증거 파일·로그 위치:
- 미실행 항목과 이유:
- next_review_request: `FABLE_RECHECK`

## HUMAN_DECISION · turn-h001

- role: `HUMAN`
- reply_to_turn_id:
- finding_ids:
- decision_id:
- 결정:
- 허용 범위·기한:
- 근거:
- 승인자·시각:
- next_review_request:

## BACKLOG_DISPOSITION · turn-o001

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id:
- optional_finding_ids:
- backlog_id:
- owner:
- 재검토 조건·시점:
- 공식 산출물 반영 여부:
- review_state_effect: `NON_BLOCKING`

## AI_DEPUTY_GATE_DECISION · turn-o002

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id:
- verified_review_sha256:
- verified_run_sha256:
- verified_input_files_sha256:
- artifact_hashes: `[{ path, sha256, change_type }]`
- gate_anchor_commit_sha:
- required_external_gate: `protected ref + required check on exact decision commit SHA | preapproved external signature/attestation`
- open_required_finding_ids: `[]`
- optional_finding_backlog_ids:
- Codex 실행 증거:
- requested_outcome: `CLOSE | AWAIT_HUMAN`
- 종결 요청 또는 사람 이관 근거:

> 이 턴은 로컬 `status.json`을 닫지 않는다. 이 턴을 포함한 decision commit의 보호 원격 필수 체크와
> 보호 ref 반영 기록, 또는 사전 승인된 외부 서명/attestation이 공식 gate 종결 증거다. 자기 자신을
> commit 안에 기록하지 않는다. 정확한 decision commit SHA는 저장소 밖 check-run·보호 ref 이벤트·
> attestation이 해당 실행의 `GITHUB_SHA` 또는 동등한 불변 식별자로 기록한다.
-->
