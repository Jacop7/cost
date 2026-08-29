
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `87be0b81735bf15a475bdc229f08ad4f5633e992`
- changed_artifact_paths: `0174 integrated executor narrowing`, `test 34 discriminating maintenance calls`, `packages/db/README.md`, `P0-5 evidence`, `predecessor response evidence`
- 충족해야 할 요구사항·불변식: predecessor 6개 Finding의 같은 ID 승계, 필수 3개 OPEN의 소스·행동·증거 재검수, 기존 VERIFIED 2개 유지, 스테이징 확인 1개 정직한 보류
- 이번에 바꾼 내용: 검수 범위 밖 0175를 제거하고 유지보수 definer·미래 기본 EXECUTE 회수와 사후조건을 0174에 통합했다. purge_archived_store의 자체 42501에 기대던 시험을 close_due_business_days·purge_entity_changes의 실제 권한 거부로 교체했다.
- 집중 검토 질문: 통합 0174가 기존 facade 호출 그래프를 보존하면서 유지보수·미래 함수만 닫는가? 행동 단언이 권한 재개방을 몸통 예외와 구별해 잡는가? 증거 문서의 새 commit·blob hash가 봉인 입력과 일치하는가?
- 실행한 테스트·현재 증거: 구현 commit 84c7c60에서 `corepack pnpm verify` 6/6, 개발·새 DB 34/34, ACL metric 21, 경합, locale parity, 업그레이드 9/9, 웹 번들. close_due_business_days 재개방 사보타주가 첫 행동 단언에서 실패하고 원복 뒤 통과했다.
- 사람 결정이 필요한 항목: 스테이징 원격 audit 전에는 P05-SEC-HOSTED-ADMIN-OPTION-NOTE와 P0-5-6을 통과로 표현하지 않는다.
- next_review_request: `FABLE_RECHECK`
