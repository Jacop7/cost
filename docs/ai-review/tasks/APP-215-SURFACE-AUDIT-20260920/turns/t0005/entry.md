
## CODEX_EVIDENCE · turn-c004 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `a8fe3157f742bbfb6c65b15230157d1ad7e7d7b6`
- finding_ids: `[]`
- 최종 전수조사 기준선: 현재 표면 207개(활성 192, 숨김·호환 15), 직접 시험 참조 207/207, 구조 누락 0, 활성 기능 화면 ID 대표 대상 누락 0, RPC 후보 203, mutation 후보 113.
- 최종 필수 게이트: 같은 작업 트리의 `corepack pnpm verify` 종료 0. ① 타입, ② core·DB·mobile, ③ CLI 계약·ACL·문서 그래프·디자인 품질, ④ 새 DB, ⑤ 업그레이드 경로, ⑥ Metro 웹 번들 6/6 통과. 모바일 148파일·1,729통과·4제외, 새 DB SQL 119/119, 업그레이드 26/26. 네이티브 기기 증빙 4종은 정책상 비차단 `ADVISORY_FAIL`이며 전체 접근성 기기 검수 완료로 표시하지 않는다.
- 추가 회귀 수정: 매장 영구 삭제 cascade 중 삭제 중인 부모 매장을 기준 변경 트리거가 다시 잠그며 FK 오류를 내던 문제를 `20260920000139_store_purge_basis_guard.sql`로 수정했다. 부모 매장이 존재할 때만 잠금·재계산하고 purge 관련 SQL 시험 3개와 전체 게이트로 검증했다.
- 독립검수 재시도: `corepack pnpm fable:review -- --task APP-215-SURFACE-AUDIT-20260920 --round 1`은 다시 외부 호출 전에 `PROVIDER_HARD_CAP_UNAVAILABLE`로 종료 64. Fable 응답·Finding은 생성되지 않았고 독립검수 완료로 표시하지 않는다.
- next_review_request: `FABLE_REVIEW`
