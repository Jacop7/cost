# P0-5-RPC-LEAST-PRIVILEGE-001 공동 작업 장부

> P1-1에서 실측한 원장 직접 쓰기 32개와 미승인 authenticated RPC 87개를 정확한 facade와
> RLS 적용 실행 역할로 줄이는 R3 보안 변경의 append-only 장부다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `bebf4488306d0d6e4b3fe49169cde0298717e459`
- changed_artifact_paths: `0174 migration`, `admin-acl audit`, `seed`, `DB prelude·tests 07~34`, `packages/db/README.md`
- 충족해야 할 요구사항·불변식: authenticated 정확한 facade 64개, 내부 RPC 42501, 원장 쓰기 경로 0, auth.uid·RLS 매장 격리, 기존 원장·판본·경합 불변
- 이번에 바꾼 내용: 로그인·RLS 우회가 없는 `sikjae_rpc_executor`를 만들고 approved invoker facade만 이 역할의 SECURITY DEFINER로 전환했다. authenticated의 모든 함수 EXECUTE를 회수한 뒤 정확한 64개 facade만 다시 열었다. RLS 정책의 `my_store_ids()` 호출을 같은 매장 조건으로 인라인하고 원장 10개 표의 앱 쓰기 GRANT·정책을 전용 역할로 옮겼다. 백색상자 시험과 실제 앱 롤 공격면 시험을 분리했다.
- 집중 검토 질문: 실행 역할의 멤버십 방향과 RLS 보존이 안전한가? SECURITY DEFINER owner·search_path와 default privilege가 새 우회로를 만들지 않는가? facade·원장 허용 목록이 과소·과대 권한 없이 완결적인가? 기존 postgres definer와 service_role·cron 경로가 유지되는가?
- 실행한 테스트·현재 증거: `corepack pnpm verify` 6/6, 개발·새 DB 34/34, ACL metric 20개, 경합, locale parity, 업그레이드 9/9, 웹 번들. 내부 RPC·원장 UPDATE·역방향 멤버십 사보타주 3종이 잡혔고 원복 뒤 기준 시험 통과. `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md`에 SHA와 결과를 봉인했다.
- 사람 결정이 필요한 항목: 사용자는 R3 변경과 FABLE-SEC 검수를 승인했다. 스테이징·운영 적용은 이 검수와 동일 SHA 보호 CI 전에는 하지 않는다.
- next_review_request: `FABLE_REVIEW`
