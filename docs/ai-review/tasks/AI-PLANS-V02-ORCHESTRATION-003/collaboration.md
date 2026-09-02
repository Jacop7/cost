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

## SOLAR_RESPONSE · turn-s002

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-s001`
- 사용자 요청: 2026-09-01 화요일 22:07의 디렉터리 재설계·팀 구성 요청부터 현재까지를 Markdown 학습 패킷으로 저장하고 새 채팅에서 전체 작업을 스터디한다.
- 산출물: `docs/ai-review/evidence/AI-TEAM-CONTEXT-ROLLOVER-20260902.md`
- 범위: 시작 목표, 다섯 공식 문서망, 팀·채팅 모델, 토큰/HANDOFF 계약, 검수 이력, 커밋, 사용자 소유 파일, 새 채팅 학습·후속 순서.
- 권위 제한: 학습 패킷은 비권위 증거이며 공식 기획안·작업큐·코드·시험을 대체하지 않는다.
- 인계 제한: 새 채팅은 먼저 읽기 전용 스터디만 수행하므로 edit lease를 자동 인수하지 않는다.

## SOLAR_RESPONSE · turn-s003

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-s002`
- 사용자 요청: 2026-09-01 화요일 22:07 무렵부터 현재까지 이 채팅에서 발전한 팀 구성·디렉터리·토큰·다중 채팅 논의를 새 채팅의 참고 학습 자료로 넘긴다.
- 산출물: `docs/ai-review/evidence/AI-TEAM-DISCUSSION-DECISION-TIMELINE-20260901-02.md`
- 정리 방식: 원시 대화 덤프가 아니라 `CURRENT`·`REFINED`·`SUPERSEDED`·`HISTORICAL` 상태가 붙은 결정 타임라인으로 정제했다.
- 포함 범위: 다섯 기획안 네트워크, 사람 요청 정규화, 팀 그룹·마스터 채팅, Context & Token Steward, HANDOFF·Learning, 스타터 키트, 검수 시행착오와 현재 실행점.
- 권위 제한: 타임라인은 L4 비권위 참고 자료이며 공식 기획안·작업큐·코드·시험과 충돌하면 최신 공식 원문과 명시적 사람 Decision을 우선한다.
- 실행한 테스트: Markdown 상대 링크 검사 통과; `corepack pnpm ai:plans:simulate` 70/70.
- 인계 제한: 새 채팅은 먼저 읽기 전용 스터디와 근거 대조만 수행하며 edit lease·정책 승인·외부 검수·커밋·푸시 권한을 자동 인수하지 않는다.
- next_review_request: `FABLE_REVIEW`

## SOLAR_RESPONSE · turn-s004

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-s003`
- 독립 스터디 대조 결과: L4 타임라인의 과거 표현 두 곳이 현재 공식 명칭과 달랐고, Fable 실패 원인을 저장소 증거보다 강하게 단정한 문구가 있었다.
- 적용 내용: 팀명을 `Server · Supabase · Operations`, 마스터 채팅명을 `개발·스테이징 배포 검증`으로 공식 원문과 맞췄다.
- 증거 제한: 당시 작업 기록의 rate limit 진단과 원시 `run.json`의 구조화된 원인 필드 부재를 함께 적어, 저장소 증거만으로 실패 원인을 확정하지 않도록 고쳤다.
- 실행한 테스트: 공식 팀·오케스트레이션 문서 대조; Markdown 상대 링크 검사; `corepack pnpm ai:plans:simulate` 재실행 예정.
- 권위 제한: 이 수정도 L4 참고 자료의 정확성 보정이며 공식 정책 변경이 아니다.
- next_review_request: `FABLE_REVIEW`
