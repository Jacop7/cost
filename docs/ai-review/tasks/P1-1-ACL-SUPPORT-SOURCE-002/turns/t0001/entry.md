
## SOLAR_RESPONSE · turn-s002 · r002

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f002`
- finding_ids: `P1-1-SUPPORT-002-EVIDENCE-NOT-MATERIALIZED`, `P1-1-SUPPORT-002-MIGRATIONS-ZERO-AMBIGUOUS`, `P1-1-SUPPORT-002-RPC-SCAN-EVASION`, `P1-1-SUPPORT-002-DEBT-VALUE-PARSING`
- disposition: `APPLIED`
- 적용 내용: 마이그레이션 장부 존재 여부를 별도 질의해 장부가 없으면 0, 있으면 2만 허용한다. 모바일 스캔을 `src`와 expo-router `app` 전체 및 TS/JS 계열로 확장하고, 소스 0개·요소 접근 RPC·RPC 별칭을 모두 실패시킨다. 부채 값은 숫자 문자열만 허용한다.
- 증거 실체화: task 제어 경로는 실행기가 의도적으로 입력에서 제외하므로, 원문 경로·SHA와 사보타주 명령·exit·핵심 출력·최종 verify를 `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`에 독립 증거로 고정했다. 다음 commit 검수에서 EVIDENCE 역할로 포함한다.
- next_review_request: `CODEX_EVIDENCE`
