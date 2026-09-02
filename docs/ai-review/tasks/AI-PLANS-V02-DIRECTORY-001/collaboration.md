# AI-PLANS-V02-DIRECTORY-001 공동 작업 장부

> 디렉터리·문서 신경망 원문 하나와 기계 생성 교차계약 투영을 Fable이 집중 검수하는 장부다.
> 비-Fable 턴은 전용 append 명령으로만 추가한다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `77bcda26057f3b5ec037826bc338899ef621ab4c`
- changed_artifact_paths: `docs/디렉터리-문서신경망-재설계-기획안.md`
- 충족해야 할 요구사항·불변식: 중앙 권위·가까운 README·생성 색인·append-only HANDOFF·안전한 이동·Fable 필수·ACTIVE 전 materialization 금지
- 집중 검토 질문: 경쟁 권위, 사용자 파일 흡수, 불변 감사 원본 수정, stale 경로, fallback으로 Fable 대체가 가능한 Critical/Major 반례가 있는가? 최대 3개로 합친다.
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 70/70; `corepack pnpm verify --no-db` 4/6. 다른 문서 계약은 compact evidence에 target commit·blob·시험 hash로 결속했다.
- 사람 결정이 필요한 항목: 이 문서 PASS 뒤에도 온톨로지 closure·오케스트레이션·평가·최종 네트워크 Fable 검수가 남는다.
- next_review_request: `FABLE_REVIEW`

## SOLAR_RESPONSE · turn-s002

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-s001`
- 판정: 사용자 최신 결정에 따라 Fable 필수·fallback 비게이트 계약이 팀 권위·오케스트레이션·프로토콜에서 강화되었다.
- 기존 요청 상태: 이 Task가 고정한 `77bcda2` 이후 참조 AGENTS와 compact evidence가 바뀌므로 r001은 실행하지 않고 불변 기록으로 보존한다.
- 검증: `corepack pnpm ai:plans:simulate` 70/70.
- 후속: 새 exact SHA와 갱신된 compact evidence에 결속한 successor Task로 Fable 검수를 요청한다.
