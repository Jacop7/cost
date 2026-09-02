
## SOLAR_RESPONSE · turn-s002

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-s001`
- 판정: 사용자 최신 결정에 따라 R0~R3 모든 완료 검수에 Fable을 필수화하고, 위험 등급은 검수 깊이만 조절하도록 공식 문서와 적대 시험을 수정했다.
- 기존 요청 상태: 이 Task가 고정한 `77bcda2` 이후 오케스트레이션·팀 권위·프로토콜이 함께 바뀌었으므로 r001은 실행하지 않고 불변 기록으로 보존한다.
- 검증: `corepack pnpm ai:plans:simulate` 70/70, 조건부 Fable·Codex-only·Opus gate 종결 회귀를 각각 거부한다.
- 후속: 수정본을 커밋한 뒤 새 exact SHA와 compact evidence에 결속한 successor Task로 Fable 검수를 요청한다.
