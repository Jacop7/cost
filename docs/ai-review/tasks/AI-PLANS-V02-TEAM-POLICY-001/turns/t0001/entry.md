
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-AI-DEPUTY`
- reply_to_turn_id: `null`
- target_commit_sha: `96e1963899862789717f2003e29ced2f1a393c64`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`
- 충족해야 할 요구사항·불변식: R0~R3 모든 완료 검수에 Fable 참여, 위험은 깊이만 조절, Codex/Fable 비대체, Opus 임시 비게이트
- 집중 검토 질문: 조건부 검수 우회, Codex-only 종결, Opus 결과의 Fable 위장 또는 팀·오케스트레이션 권위 충돌이 남아 있는가? Critical·Major 또는 명세상 필수 Finding만 최대 3개로 합친다.
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 70/70; `corepack pnpm verify --no-db` 4/6. 다른 문서 계약은 compact evidence에 target commit·tree·blob·시험 hash로 결속했다.
- 사람 결정이 필요한 항목: 다섯 문서 유효 Fable 검수와 최종 네트워크 결속 전에는 DRAFT 활성화·디렉터리 materialization을 하지 않는다.
- next_review_request: `FABLE_REVIEW`
