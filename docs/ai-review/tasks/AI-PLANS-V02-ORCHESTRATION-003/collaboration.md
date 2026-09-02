# AI-PLANS-V02-ORCHESTRATION-003 공동 작업 장부

> 최신 오케스트레이션 원문 하나와 기계 생성 교차계약 투영을 Fable이 집중 검수하는 장부다.
> 비-Fable 턴은 전용 append 명령으로만 추가한다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `96e1963899862789717f2003e29ced2f1a393c64`
- changed_artifact_paths: `docs/AI-오케스트레이션-상세기획안.md`
- 충족해야 할 요구사항·불변식: 요청 정규화·다중 채팅·HANDOFF·lease·Fable 필수·문서별 축소와 최종 네트워크 결속 분리
- 집중 검토 질문: 권위 중복, 신호만으로 권한 획득, 조건부 Fable, fallback 종결 또는 문서별 검수를 네트워크 closure로 오인할 길이 남아 있는가? Critical·Major 또는 명세상 필수 Finding만 최대 3개로 합친다.
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 70/70; `corepack pnpm verify --no-db` 4/6. 다른 문서 계약은 compact evidence에 target commit·tree·blob·시험 hash로 결속했다.
- 사람 결정이 필요한 항목: 다섯 문서 유효 Fable 검수와 최종 네트워크 결속 전에는 DRAFT 활성화·디렉터리 materialization을 하지 않는다.
- next_review_request: `FABLE_REVIEW`
