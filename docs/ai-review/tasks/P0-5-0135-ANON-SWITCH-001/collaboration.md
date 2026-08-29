# P0-5-0135-ANON-SWITCH-001 공동 작업 장부

- protocol: `1.2`
- route: `SECURITY`
- target: `03cd3634f18e1d2314c204fcfd7a33bb0c385ccc`
- predecessor: `none`

계약 거부 후보 검수에서 찾은 0135 anon 전환 판별력 문제를 별도 공동 산출물 범위로 검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `03cd3634f18e1d2314c204fcfd7a33bb0c385ccc`
- changed_artifact_paths: `20260826000135_purge_and_anon_grants.sql`, `P0-5 evidence`
- 충족해야 할 요구사항·불변식: anon 전환 실패와 함수 실행 거부 분리, 시작 역할 복원 유지, 0001~0134 불변, 전체 로컬 게이트 유지
- 이번에 바꾼 내용: `set local role anon`을 함수 호출 예외 블록 밖으로 옮기고 `current_user='anon'`을 확인한 뒤, 함수 실행에서 발생한 insufficient_privilege만 성공 조건으로 센다. 정상·사보타주 역할 체인과 전체 0135 실행 증거를 공식 증거 문서에 추가했다.
- 집중 검토 질문: 전환을 예외 블록 밖으로 옮긴 구조가 공허한 42501 통과를 제거하는가? 정상 호스티드형 NOINHERIT 체인에서 시작 역할 복원이 가능한가? 기존 익명·PUBLIC 회수 및 authenticated 실행 계약을 약화하지 않는가?
- 실행한 테스트·현재 증거: 정상 `login→postgres→anon→postgres` 전환, 전환 권한 제거 시 즉시 42501, 0134 DB에서 수정 0135 전체 통과, `corepack pnpm verify` 6/6, 임시 DB 0개.
- 사람 결정이 필요한 항목: 없음. 스테이징 재적용과 P0-5-6 원격 audit는 이 코드 검수 뒤의 별도 운영 게이트다.
- next_review_request: `FABLE_REVIEW`
