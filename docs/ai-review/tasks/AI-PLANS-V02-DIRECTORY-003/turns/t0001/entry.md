
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `96e1963899862789717f2003e29ced2f1a393c64`
- changed_artifact_paths: `docs/디렉터리-문서신경망-재설계-기획안.md`
- 충족해야 할 요구사항·불변식: 중앙 권위·가까운 README·생성 색인·append-only HANDOFF·안전한 이동·Fable 필수·ACTIVE 전 materialization 금지
- 집중 검토 질문: 경쟁 권위, 사용자 파일 흡수, 불변 감사 원본 수정, stale 경로 또는 fallback으로 완료할 길이 남아 있는가? Critical·Major 또는 명세상 필수 Finding만 최대 3개로 합친다.
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 70/70; `corepack pnpm verify --no-db` 4/6. 다른 문서 계약은 compact evidence에 target commit·tree·blob·시험 hash로 결속했다.
- 사람 결정이 필요한 항목: 다섯 문서 유효 Fable 검수와 최종 네트워크 결속 전에는 DRAFT 활성화·디렉터리 materialization을 하지 않는다.
- next_review_request: `FABLE_REVIEW`
