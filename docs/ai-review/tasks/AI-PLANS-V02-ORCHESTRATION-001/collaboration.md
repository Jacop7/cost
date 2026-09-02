# AI-PLANS-V02-ORCHESTRATION-001 공동 작업 장부

> 오케스트레이션 원문 하나와 기계 생성 교차계약 투영을 Fable이 집중 검수하는 장부다.
> 비-Fable 턴은 전용 append 명령으로만 추가한다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `77bcda26057f3b5ec037826bc338899ef621ab4c`
- changed_artifact_paths: `docs/AI-오케스트레이션-상세기획안.md`
- 충족해야 할 요구사항·불변식: 요청 정규화·다중 채팅 연속성·HANDOFF·lease·Fable 필수·문서별 축소와 최종 네트워크 결속 분리
- 집중 검토 질문: 권위 중복, 신호만으로 권한 획득, 문서별 검수를 네트워크 closure로 오인, fallback으로 Fable을 대체하는 Critical/Major 반례가 있는가? 최대 3개로 합친다.
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 70/70; `corepack pnpm verify --no-db` 4/6. 다른 문서 계약은 compact evidence에 target commit·blob·시험 hash로 결속했다.
- 사람 결정이 필요한 항목: 이 문서 PASS 뒤에도 온톨로지 closure·디렉터리·평가·최종 네트워크 Fable 검수가 남는다.
- next_review_request: `FABLE_REVIEW`

## SOLAR_RESPONSE · turn-s002

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-s001`
- 판정: 사용자 최신 결정에 따라 R0~R3 모든 완료 검수에 Fable을 필수화하고, 위험 등급은 검수 깊이만 조절하도록 공식 문서와 적대 시험을 수정했다.
- 기존 요청 상태: 이 Task가 고정한 `77bcda2` 이후 오케스트레이션·팀 권위·프로토콜이 함께 바뀌었으므로 r001은 실행하지 않고 불변 기록으로 보존한다.
- 검증: `corepack pnpm ai:plans:simulate` 70/70, 조건부 Fable·Codex-only·Opus gate 종결 회귀를 각각 거부한다.
- 후속: 수정본을 커밋한 뒤 새 exact SHA와 compact evidence에 결속한 successor Task로 Fable 검수를 요청한다.
