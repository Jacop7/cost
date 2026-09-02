
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-AI-DEPUTY`
- reply_to_turn_id: `null`
- target_commit_sha: `96e1963899862789717f2003e29ced2f1a393c64`
- changed_artifact_paths: `docs/AI-품질-학습-자율성-평가기획안.md`
- 충족해야 할 요구사항·불변식: 평가 사건 완전성·Learning 독립성·hold-out 오염 방지·route 한정 자율성·중대 사고 강등·모든 검수 Fable 필수
- 집중 검토 질문: 지표 조작, 자기 Learning 검증, 자율성 월권, 축소 검수의 closure 오인 또는 fallback 종결이 가능한가? Critical·Major 또는 명세상 필수 Finding만 최대 3개로 합친다.
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 70/70; `corepack pnpm verify --no-db` 4/6. 다른 문서 계약은 compact evidence에 target commit·tree·blob·시험 hash로 결속했다.
- 사람 결정이 필요한 항목: 다섯 문서 유효 Fable 검수와 최종 네트워크 결속 전에는 DRAFT 활성화·디렉터리 materialization을 하지 않는다.
- next_review_request: `FABLE_REVIEW`
