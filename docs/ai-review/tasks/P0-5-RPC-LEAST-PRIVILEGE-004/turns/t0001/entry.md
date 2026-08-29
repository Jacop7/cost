
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `6c30ebbb2ba3063d9107bdc50f923d8b031039c1`
- changed_artifact_paths: `0175 migration`, `test 34 cross-store behavior`, `admin ACL metric 21`, `tests 16·26·33`, `packages/db/README.md`, `P0-5 evidence`
- 충족해야 할 요구사항·불변식: predecessor Finding 4건의 같은 ID 승계, 필수 3건의 구현·행동·증거 재검수, 호스티드 관리자 옵션의 정직한 보류
- 이번에 바꾼 내용: executor의 유지보수 definer와 미래 함수 기본 EXECUTE를 회수했다. authenticated 실제 facade의 교차 매장 차단과 BYPASSRLS 사보타주를 행동 단언으로 추가했다. 정확한 검증 commit에서 전체 6/6을 재실행하고 Git blob bytes의 해시로 증거 문서를 다시 고정했다.
- 집중 검토 질문: 0175의 동적 회수가 승인 facade 호출에 필요한 권한까지 과도하게 닫지 않는가? 유지보수 함수와 미래 함수가 executor에 다시 열리지 않는가? 교차 매장 행동 시험이 실제 RLS 우회를 잡는가? 증거 문서의 모든 commit·OID·SHA가 target blob과 일치하는가?
- 실행한 테스트·현재 증거: target 구현 commit `e8e22db`에서 `corepack pnpm verify` 6/6, 개발·새 DB 34/34, ACL metric 21개, 경합, locale parity, 업그레이드 9/9, 웹 번들. 유지보수 함수 재개방과 executor BYPASSRLS 사보타주가 각각 실패했다.
- 사람 결정이 필요한 항목: 스테이징 원격 audit 전에는 P05-SEC-HOSTED-ADMIN-OPTION-NOTE와 P0-5-6을 통과로 표현하지 않는다.
- next_review_request: `FABLE_RECHECK`
