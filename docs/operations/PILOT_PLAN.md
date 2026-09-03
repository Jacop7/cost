# 실제 업무 파일럿 진입점

11단계의 실제 업무 파일럿은 이 문서를 실행 진입점으로 사용한다. 구체 Task·대상 SHA·담당·상태는
[작업큐](../작업큐.md)가 소유하며, 이 파일은 아직 파일럿 완료를 주장하지 않는다.

- 하나의 실제 R0·R1 업무와 하나의 edit lease를 선택한다.
- 요청→정규화→Task→구현→Codex 검증→Fable 독립검수→사람 Decision→HANDOFF의 pointer를 남긴다.
- 역할/팀 manifest와 A0 상한, 사용자 소유 파일 제외, exact-SHA 게이트를 검증한다.
- 결과로 발견한 구조 결함은 12단계 스타터 키트에 역반영할 후보로 분리한다.

제품·DB·스테이징·운영 범위가 필요하면 별도 승인 Task로 분리한다.

## 파일럿 001 — 문서 그래프 verify 게이트 연결

이 파일럿은 실제 R1 저장소 변경 `AI-ORCH-STAGE10-VERIFY-GRAPH-036`을 사용한다. 제품·DB·스테이징·운영
권한을 요구하지 않으며, 기존 `pnpm verify`의 ③단계 안에 문서 그래프 activation 검사와 회귀시험을
fail-closed로 연결한다.

| 흐름 | 결속 원본 |
| --- | --- |
| 요청·정규화 | `docs/작업큐.md`의 `AI-ORCH-PLANS-SIM-1`과 사용자 자동 진행 Decision |
| Task·사람 결정 | `docs/ai-review/tasks/AI-ORCH-STAGE10-VERIFY-GRAPH-036/collaboration.md` |
| 구현 | commit `36a83f89811cdf0b40c594f5eb80ee6dc3085311` · `scripts/verify.mjs`, `AGENTS.md` |
| Codex 검증 | `corepack pnpm verify --no-db --no-bundle` 선택 범위 3/6 통과; ③단계 graph activation 29/19·13개 회귀시험 포함 — 실행 기록은 `docs/작업큐.md`의 `AI-ORCH-PLANS-SIM-1` Stage 10 항목에 결속 |
| 독립검수 | Task036/r001 Fable PASS, 필수 OPEN Finding 0건 |
| 결과·후속 | `docs/작업큐.md`에 10단계 완료 기록. 11단계 파일럿의 HANDOFF pointer는 이 문서와 Task036 원본으로 한정한다. |

파일럿에서 확인한 구조적 교훈은 아직 Learning으로 승격하지 않는다. 다음 12단계에서 재사용 가능성·두 번째
재현·독립 검증 조건을 별도 판정하고, 이 파일 자체를 정책 권위나 운영 승인 근거로 사용하지 않는다.
