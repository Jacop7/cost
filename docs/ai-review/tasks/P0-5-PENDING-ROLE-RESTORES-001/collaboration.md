# P0-5-PENDING-ROLE-RESTORES-001 공동 작업 장부

- protocol: `1.2`
- route: `SECURITY`
- target: `1bb11fe6aff1446a486dd05fd7caef770fb26db6`
- predecessor: `null`

스테이징에서 두 번째로 드러난 migration 역할 복원 문제와 Windows clean checkout에서 드러난
줄끝 의존 migration 치환을 함께 보안·배포 관점에서 검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `1bb11fe6aff1446a486dd05fd7caef770fb26db6`
- changed_artifact_paths: `0137`, `0138`, `0139`, `0144`, `0145`, `0150`, `0151`, `0158`, `0163`, `0165`, `P0-5 evidence`
- 충족해야 할 요구사항·불변식: migration 시작 역할 명시 복원, 역할 전환과 대상 행동 거부 분리, 정확한 거부 원천 확인, Windows CRLF/LF 동일 적용, 0001~0136 불변, 제품 계약 불변, 원격 게이트 미완료의 정직한 표시
- 이번에 바꾼 내용: 아직 스테이징에 미적용인 역할 검사 네 파일에서 `reset role`을 제거하고 시작 역할을 보존·명시 복원했다. clean Windows checkout에서 실패한 함수 정의 조각 비교 일곱 파일은 정의와 anchor를 LF로 정규화했다. 실패·재현·집중 시험·전체 verify를 기존 증거 문서에 추가했다.
- 집중 검토 질문: 역할 전환 실패나 무관한 42501을 행동 거부로 오인할 길이 남았는가? 명시 복원이 트랜잭션의 원래 실행 권한을 정확히 되돌리는가? 줄끝 정규화가 실제 SQL 코드 의미나 치환 범위를 넓히지 않는가? 0139 재적용 표식이 주석·부분 문자열에 공허하게 통과할 수 있는가? 증거가 아직 미완료인 스테이징 재적용·원격 audit을 과장하는가?
- 실행한 테스트·현재 증거: NOINHERIT 역할 체인 집중 시험 통과, CRLF clean checkout에서 각 파일 첫 적용 통과, 지원 파일 재적용 통과, 전체 migration·seed 성공, 최종 target의 `corepack pnpm verify` 6/6과 업그레이드 9/9, `fresh_%` 0개.
- 사람 결정이 필요한 항목: 없음. 운영은 범위 밖이며 스테이징 적용과 원격 audit은 이 검수·보호 CI 뒤 별도 게이트다.
- next_review_request: `FABLE_REVIEW`
