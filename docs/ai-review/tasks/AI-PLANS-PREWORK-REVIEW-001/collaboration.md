# AI-PLANS-PREWORK-REVIEW-001 공동 작업 장부

> 12단계 착수 전 선작업 증거의 완결성과 권한 경계를 검수하는 장부다.
> 비-Fable 턴은 전용 append 명령으로만 추가한다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `CODEX-QA`
- reply_to_turn_id: `null`
- target_commit_sha: `aa3c55441592552410ae41434a3f97cf871c9e26`
- changed_artifact_paths: `docs/작업큐.md`, `docs/ai-review/evidence/AI-PLANS-PREWORK-BASELINE.md`, `docs/ai-review/evidence/AI-PLANS-PREWORK-PATCH-MAP.md`, `docs/ai-review/evidence/AI-PLANS-PREWORK-DECISIONS.md`, `docs/ai-review/evidence/AI-PLANS-PREWORK-VERIFICATION-V2.md`, `docs/ai-review/evidence/AI-PLANS-PREWORK-OPUS-R1.md`, `docs/ai-review/evidence/AI-PLANS-PREWORK-USER-STATE.json`, `scripts/ai-plan-prework-status-check.mjs`
- 충족해야 할 요구사항·불변식: 새 브랜치 금지, 사용자 변경 불침범, Task별 lease 격리, 실패 원본 불변, 단일 공식 문서, Fable 필수 완료 검수
- 이번에 바꾼 내용: Opus r1 F-01~04를 Git blob 해시, 사용자 57경로 manifest, 미분류·중복 즉시 실패 검사기, 실행 SHA와 영수증 봉인 SHA의 2단계 결속으로 보완했다.
- 집중 검토 질문: 선작업 1~11 각각이 재현 가능한 증거로 충족됐는가? 각 번호에 PASS 또는 CHANGES_REQUIRED를 명시하고 하나라도 미통과면 전체 PASS를 반환하지 않는다.
- 실행한 테스트·현재 증거: execution commit 43c7ca4에서 상태 검사 PASS(user 57, 미분류 0, 중복 0, manifest 일치), ai:plans:simulate 70/70, verify --no-db 4/6, fable:check exit 0, git diff --check exit 0; 영수증 seal commit 54eb078, seal binding commit aa3c554
- 사람 결정이 필요한 항목: 기존 SIM-1 lease 인계와 ONTOLOGY successor 발행은 본작업 전 별도 Decision/HANDOFF가 필요하다.
- 검수 규칙: Opus r1 CHANGES_REQUIRED와 첫 영수증은 불변 이력으로 보존하고 새 회차로만 판정한다. 사용자 소유·별도 교차 스터디 미추적 파일은 입력에서 제외한다.
- next_review_request: `FABLE_REVIEW`
