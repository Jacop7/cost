
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-o001`
- target_commit_sha: `e7a7fd0811257cb34dd3b55f3453542d97e73df5`
- predecessor_task_id: `INTL-LAUNCH-CORE-DOCS-004`
- predecessor_round: `r001`
- predecessor_review_sha256: `0aaed6c3a50929fa115a23004070544b1732c17cb943a3b3ac92472ecbf31b9f`
- changed_artifact_paths: `docs/국가-통화-세금-국제출시-기획안.md`, `docs/브랜치-DB-운영-기획안.md`, `docs/서버-확장-아키텍처-기획안.md`
- 충족해야 할 요구사항·불변식: predecessor Finding 5건의 동일 ID 재확인, DB RPC 계산 권위, 시점 스냅샷, 전진 migration, 현재 구현과 계획 상태 분리
- 이번에 바꾼 내용: 스테이징 SQL 실측·원격 셸 대기·production 미적용 상태를 증거 링크로 통일했다. 과세 상태별 `r0_effective`·`A(treatment)`·`bi`·`M`과 추가세 적용 과세 상태를 정의했다. `codex/`를 허용 브랜치 접두어로 등록하고, 현재 세금 공식의 ÷100과 `price_basis` 시장 프로필 단일 소유를 명시했다.
- 집중 검토 질문: `ARCH-INTL004-*` Finding 5건의 완료 조건이 모두 충족됐는가? 새 공식이나 운영 상태 서술이 다른 불변식을 깨뜨렸는가?
- 실행한 테스트·현재 증거: `git diff --check`, 상대 링크·배포 증거 존재 검사, 운영 상태·브랜치명·공식·price_basis 문자열 대조, 과세 상태별 Node 숫자 검산 모두 통과. 제품 전체 verify는 문서 전용 변경이라 실행하지 않았다.
- next_review_request: `HUMAN_DECISION`
