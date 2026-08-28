
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `e799f42676aa607b9f7a6ce1f3739bed99fe9b5e`
- changed_artifact_paths: `scripts/fable-review.mjs`, `docs/team/TEAM_LEARNING.md`, `docs/team/ROLE_CONTEXTS.md`, `docs/ai-review/README.md`, `docs/ai-review/templates/task-v12-primary.example.json`, `docs/ai-review/templates/task-v12-fallback.example.json`, `docs/팀구성_상세기획안.md`, `docs/작업큐.md`
- 충족해야 할 요구사항·불변식: TEAM-LEARNING-1 1~7, protocol 1.1·기존 1.2 감사 원본 호환, append-only 장부, 독립 감사 클린룸
- 이번에 바꾼 내용: 증거 기반 TEAM_LEARNING 기계 장부와 역할별 컨텍스트 규칙을 만들고 protocol 1.2 Task·manifest·result에 applied/excluded learning ID를 봉인했다. 정상 검수에는 검증된 최소 체크리스트만, 보안 후속에는 ID만 전달하며 최초 보안과 독립 종합 감사는 빈 클린룸으로 고정했다.
- 집중 검토 질문: 장부 JSON이나 Task 필드를 조작해 CANDIDATE·RETIRED·만료·충돌 학습을 주입할 수 있는가? FINAL_INDEPENDENT 또는 최초 SECURITY가 학습 표식을 받을 수 있는가? 기존 protocol 1.1·1.2 기록이 깨지는가? result·manifest의 ID echo를 변조할 수 있는가?
- 실행한 테스트·현재 증거: `fable:self-test` 46개 묶음, protocol 1.2 계약 20/20, `corepack pnpm verify` 6/6. DB 32/32·core 177·mobile 189·업그레이드 8/8·웹 번들을 포함한다.
- 적용 학습: `LRN-ORCH-CI-001`의 exact-SHA CI 대기와 main fast-forward 순서를 이후 배포 단계에 적용한다.
- 사람 결정이 필요한 항목: 없음. 사용자가 남은 기획안 작업의 자동 진행을 승인했다.
- next_review_request: `FABLE_REVIEW`
