# DESIGN-TOKEN-S4A-ANDROID-W1-001 공동 작업 장부

> 이 장부는 Android S4a exact 증거와 W1 재배정 후보를 검수하는 append-only 기록이다.
> 이 최초 패킷 이후 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `00454d6fcea7fc394bcb72ddedb50146a5dcec12`
- changed_artifact_paths: `apps/mobile S4a 소비처 10개` · `scripts/native-touch-runtime-*` · `scripts/touch-target-*` · `docs/prototypes/full-page-flow-prototype-app-*` · `docs/디자인-토큰-3계층-값-매핑-기획서.md`
- 충족해야 할 요구사항·불변식: `USER-DECISION:12-4-role-specific-touch-contract` · `S4A:native-effective-touch-44dp` · `W1:five-bin-zero-unmatched` · `AI-REVIEW:pass-is-not-gate-closure`
- 이번에 바꾼 내용: 직접 부모·실제 clipping 조상 기반 Android 1×/2× 유효 터치 감사와 exact 증거를 보존하고, 같은 제품판에서 W1 선언 전수를 다시 배정했다. 원시 증거는 입력 상한을 넘으므로 전체 재계산 결과를 결속한 작은 영수증을 추가했다.
- 집중 검토 질문: scroll/root 부분 노출 제외가 비-scroll clipping을 숨기지 않는가? RN 화면 wrapper 좌표계 예외가 과도하지 않은가? receipt가 원시 증거의 값 변조를 충분히 막는가? W1 2,353건의 통 이동과 미분류 0 주장이 검사기·문서에서 일치하는가? iOS MISSING을 부분 PASS와 전체 종결 사이에서 올바르게 분리했는가?
- 실행한 테스트·현재 증거: Android 1×/2× target 19·소스 계보 20·미달 0·중첩 0. W1 `PROPOSAL_COMPLETE`, `2,063/239/3/48/0`, 미분류 0. DS-20260906-011 PASS. 관련 음성 시험 105/105. iOS `--require=all`은 MISSING 2건으로 exit 1.
- 사람 결정이 필요한 항목: 없음. iOS는 Apple Developer Program 팀 활성화 뒤 같은 계약으로 측정해야 하며 그 전 전체 종결은 금지된다.
- applied_learning_ids: 없음
- excluded_learning_ids: `LRN-ORCH-CI-001`(원격 통합 범위 아님), `LRN-CODEX-TIME-001`(DB 시간 범위 아님), `LRN-OPS-BACKUP-001`(DB 백업 범위 아님)
- next_review_request: `FABLE_REVIEW`
