# P0-5-0135-ANON-SWITCH-002 공동 작업 장부

- protocol: `1.2`
- route: `SECURITY`
- target: `325c3a477c6d529e928cd25996f7b3c5d8b3f362`
- predecessor: `P0-5-0135-ANON-SWITCH-001/r001`

이전 검수의 필수 Finding과 선택 개선 Finding을 같은 ID로 재검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `325c3a477c6d529e928cd25996f7b3c5d8b3f362`
- changed_artifact_paths: `20260826000135_purge_and_anon_grants.sql`, `P0-5 evidence`
- 충족해야 할 요구사항·불변식: 역할 전환과 함수 거부 분리, 다른 42501 오인 방지, 시작 역할 복원, 판본·실행 증거 결속, 0001~0134 불변
- Finding별 답변: `P05-0135-EVIDENCE-SHA-BINDING-001`은 최종 구현 SHA·blob·SHA-256·비교 SHA·관측 4단계·SQLSTATE·검증 시각으로 결속했다. `P05-0135-DENIAL-SOURCE-PIN-001`은 오류 메시지가 purge 함수명을 포함할 때만 성공으로 세고 스키마 USAGE 사보타주가 자체 오류로 중단됨을 확인했다. `P05-0135-HOSTED-ROLE-CHAIN-PRECHECK-001`은 스테이징 적용 직전 읽기 전용 관측 항목으로 유지한다.
- 실행한 테스트·현재 증거: 최종 구현 commit에서 전체 `pnpm verify` 6/6, 정상 login→postgres→anon→postgres 관측, 전환 실패 42501, 다른 42501 사보타주 적중, baseline 이후 migration 변경 0135 하나, 임시 DB 0개.
- 사람 결정이 필요한 항목: 없음. 운영 DB는 범위 밖이며 스테이징 사전 관측·적용은 재검수 뒤 별도 게이트다.
- next_review_request: `FABLE_RECHECK`
