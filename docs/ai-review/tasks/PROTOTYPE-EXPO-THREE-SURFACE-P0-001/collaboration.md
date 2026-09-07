# PROTOTYPE-EXPO-THREE-SURFACE-P0-001 공동 작업 장부

> 이 장부는 3표면 동기화 P0 기준선과 감사 계약을 검수하는 append-only 기록이다.
> 이 최초 요청 이후 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `55ff02ec5db9c2f034c0ec002fcc4a7d1e3bb7f6`
- changed_artifact_paths: `docs/prototypes/three-surface-baseline.json` · `docs/prototypes/three-surface-byte-artifacts.json` · `docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001/advisory-ledger.{json,md}` · `scripts/three-surface-*-check*`
- 충족해야 할 요구사항·불변식: `THREE-SURFACE:P0-declaration-disposition` · `THREE-SURFACE:opus-advisory-is-not-fable` · `THREE-SURFACE:byte-manifest-closed-world`
- 이번에 바꾼 내용: 이전 exact 감사 4종을 다시 실행해 768개 실패선을 보존하고, 선언별 disposition과 478개 regression backlog를 만들었다. Opus R1~R9 장부는 JSON 권위와 생성 Markdown으로 전환했고 미래 생성 산출물의 닫힌 byte manifest를 시작했다.
- 집중 검토 질문: 478개 regression과 290개 supersede 구분이 실제 회귀를 숨기지 않는가? 실패선 전수·backlog 양방향 대조가 허용 목록 확대를 막는가? planned artifact를 닫힌 manifest에 미리 등록한 방식이 단계적 구현과 byte 계약을 함께 만족하는가?
- 실행한 테스트·현재 증거: P0 checker PASS(화면 ID 60·route 53·prototype 185·실패선 768), advisory checker PASS(R1~R9·83건), byte manifest PASS(present 4·planned 6), 모바일 typecheck PASS, Vitest 2.1.9 233/233, git diff --check PASS.
- 사람 결정이 필요한 항목: 없음. regression은 P0에서 제품 코드로 고치지 않고 P2/P3 복구 backlog로만 유지한다.
- applied_learning_ids: 없음
- excluded_learning_ids: `LRN-ORCH-CI-001`(원격 통합 범위 아님), `LRN-CODEX-TIME-001`(DB 시간 범위 아님), `LRN-OPS-BACKUP-001`(DB 백업 범위 아님)
- next_review_request: `FABLE_REVIEW`
