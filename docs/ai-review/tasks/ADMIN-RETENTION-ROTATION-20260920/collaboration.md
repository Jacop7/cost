# ADMIN-RETENTION-ROTATION-20260920 공동 작업 장부

> 이 파일은 솔라·페이블·Codex·사람·AI 부 오케스트레이터가 `task.json`의 `artifact_paths`에 지정된
> 같은 공식 산출물을 개선하는 append-only 상호작용 장부다. Fable 턴은 검수 실행기만 추가하고,
> 그 밖의 모든 턴은 `corepack pnpm fable:append -- --task ADMIN-RETENTION-ROTATION-20260920`로만 맨
> 아래에 추가한다. 이 파일을 직접 편집하거나 과거 턴을 고치거나 지우지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR`
- reply_to_turn_id: `null`
- target_commit_sha: `3132560e07a1c035344a101df533ac84f2da59ab`
- changed_artifact_paths: `docs/어드민-사용자조회-푸시-CS복구-상세기획안.md`
- 충족해야 할 요구사항·불변식: 활성 매장 원장 전체 보존, 원장과 backup 역할 분리, 서버 business_date,
  append-only 정정, 탈퇴 데이터 삭제표 재적용
- 이번에 바꾼 내용: 최근 7일 PITR, 8~35일 일별 checkpoint, 선택적 월말 기준점과 8월 31일 예시를 추가했다.
- 집중 검토 질문: 월말 기준점과 다음 달 변경분만으로 지정 시점 복구가 가능한가, 최근 달 전체본을 어떤
  형식으로 보존해야 중복·비용·개인정보 위험을 줄이는가, 구형 영업 종료 계약에 잘못 결속되었는가.
- 실행한 테스트·현재 증거: Markdown Prettier와 `git diff --check` 통과. 구현·복구 시험은 아직 없음.
- 사람 결정이 필요한 항목: 장기 월말 기준점의 필요 여부·기간·비용 한도
- next_review_request: `FABLE_REVIEW`
