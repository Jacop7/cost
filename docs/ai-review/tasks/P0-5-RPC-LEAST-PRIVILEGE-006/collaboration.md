# P0-5-RPC-LEAST-PRIVILEGE-006 공동 작업 장부

- protocol: `1.2`
- route: `SECURITY`
- target: `9559b3bd7b7205663b067edfc5367bbfd5623d21`
- predecessor: `P0-5-RPC-LEAST-PRIVILEGE-005/r001`

스테이징에서 실측한 Supabase CLI 역할 복원 실패와 0135의 보정을 predecessor Finding ID 그대로 재검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `9559b3bd7b7205663b067edfc5367bbfd5623d21`
- changed_artifact_paths: `20260826000135_purge_and_anon_grants.sql`, `P0-5 evidence`
- 충족해야 할 요구사항·불변식: predecessor 6개 Finding의 같은 ID 승계, 0135 역할 복원 보정의 정확성, 이미 스테이징에 적용된 0001~0134 불변, 스테이징 재적용·원격 audit 전 호스티드 Finding 보류
- 이번에 바꾼 내용: anon 실행 거부 확인 뒤 `reset role`로 로그인 역할에 돌아가던 코드를 migration 시작 역할을 보존·명시 복원하도록 바꾸고 복원 사후조건을 추가했다. 실패한 스테이징 적용과 40개 잔여, 로컬 NOINHERIT 재현을 기존 증거 문서에 기록했다.
- 집중 검토 질문: `set local role` 중첩 뒤 시작 역할 명시 복원이 호스티드 CLI와 일반 postgres 실행에서 모두 안전한가? 보정이 0135의 익명 거부·함수 권한 사후 확인을 약화하지 않는가? 아직 원격 재적용하지 않은 상태를 증거가 과장하지 않는가?
- 실행한 테스트·현재 증거: 옛 코드의 42501과 보정 코드 통과를 NOINHERIT 로그인 역할로 재현했다. 보정 상태에서 로컬 DB reset·seed 및 `corepack pnpm verify` 6/6(DB 34/34, ACL 21, 업그레이드 9/9, 웹 번들), 임시 DB 0개를 확인했다.
- 사람 결정이 필요한 항목: 스테이징의 남은 40개 적용과 원격 audit 전에는 P05-SEC-HOSTED-ADMIN-OPTION-NOTE와 P0-5-6을 통과로 표현하지 않는다.
- next_review_request: `FABLE_RECHECK`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[P05-SEC-EVIDENCE-HASH-MISMATCH, P05-SEC-EXECUTOR-BLANKET-EXECUTE, P05-SEC-FACADE-CROSS-STORE-TEST-GAP, P05-SEC-HOSTED-ADMIN-OPTION-NOTE, P05-SEC-0175-OUTSIDE-PACKET, P05-SEC-PURGE-42501-NONDISCRIMINATING]`
- decision_id: `P0-5-FABLE-HOSTED-ROLE-CAP-20260829`
- task_budget_usd_approved: `8.00`
- 결정: 스테이징에서 실측한 0135 역할 복원 실패의 보정 상태를 predecessor Finding ID로 재검수한다.
- 허용 범위·기한: P0-5-RPC-LEAST-PRIVILEGE-006 읽기 전용 검수, 2026-08-29 현재 작업 완료까지.
- 근거: 사용자가 Fable 문제 제기를 계속 반영하고 기획안 단계가 끝날 때까지 자동 진행하도록 승인했다.
- 승인자·시각: `USER · 2026-08-29T16:30:00+09:00`
- next_review_request: `FABLE_RECHECK`
