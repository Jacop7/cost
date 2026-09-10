# RECIPE-WRITE-RELIABILITY-20260910 공동 작업 장부

> 모든 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다. Fable 턴은 검수 실행기만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `99bd930a8b1460dd6097ad0c841930736489f517`
- changed_artifact_paths: recipe write-reliability artifact 8개
- 충족해야 할 요구사항·불변식: 불확실 저장 결과의 중복 생성 금지, 정상 UUID·revision 계약, 서버 계산 권위와 도메인 훅 경계 유지
- 이번에 바꾼 내용: 저장 intent 보존·복구, 응답 UUID 검증, stale callback 차단, native 저장소 경계와 회귀 시험을 추가했다.
- 집중 검토 질문: 네트워크 불확실성과 revision conflict에서 의도치 않은 재저장·유실·다른 레시피 갱신이 가능한 경로가 남아 있는가?
- 실행한 테스트·현재 증거: recipe 관련 vitest 103개 통과(7 skipped), mobile typecheck 통과. 전체 verify --no-db는 기능 시험·type·web bundle은 통과했고 기존 P0 화면 변경 금지 게이트만 실패했다.
- 사람 결정이 필요한 항목: 없음. 이 요청은 읽기 전용 독립 검수이며 main 병합·운영 배포 승인과 무관하다.
- next_review_request: `FABLE_REVIEW`
