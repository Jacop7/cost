
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `a8fe3157f742bbfb6c65b15230157d1ad7e7d7b6`
- artifact_hashes: `[{"path":"docs/ai-review/tasks/APP-215-SURFACE-AUDIT-20260920/plan.md","sha256":"e3ff5f24e2d2cd2a9e42daf1b62fd61c0fee78250287f8fca2a27ee88299c434","change_type":"ADDED"},{"path":"scripts/app-surface-functional-audit.mjs","sha256":"a770e42aa35c73039f4ddd697ff73a4686c9a3dc305978d5ac7553af77c3ffe2","change_type":"ADDED"}]`
- changed_artifact_paths: `docs/ai-review/tasks/APP-215-SURFACE-AUDIT-20260920/plan.md`, `scripts/app-surface-functional-audit.mjs`
- 충족해야 할 요구사항·불변식: AppMap 215개 표면과 74개 화면 ID를 빠짐없이 추적하고, 재료·메뉴·발주·매출의 확정 계산과 원장은 DB RPC를 권위로 유지한다.
- 이번에 바꾼 내용: 구조 누락을 자동 검사하는 기준선 생성기와 8단계 전수조사·수정 계획을 만들었다. 215개 표면의 Expo 경로 매핑 누락은 0건이며, 이 결과를 기능 완료와 구분했다.
- 집중 검토 질문: 완료 판정 10개가 껍데기와 실제 구현을 충분히 구분하는지, 위험 순서와 핵심 흐름 반례가 빠지지 않았는지, 1~5개 판매 채널 최신 결정과 과거 3개 고정 문서의 충돌 처리 순서가 안전한지 검토해 달라.
- 실행한 테스트·현재 증거: `node scripts/app-surface-functional-audit.mjs` 종료 0. 총 215·활성 200·숨김 15·화면 75·팝업/상태 140·구조 누락 0. `inventory.json` SHA-256 `323d77443e6aee535ee3004d2de05c6ca6c002166810a090031b8344022ec489`.
- 사람 결정이 필요한 항목: 현재 없음. 최신 사용자 결정은 가변 판매 채널과 Fable 필수 검수다.
- next_review_request: `FABLE_REVIEW`
