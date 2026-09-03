# AI-ORCH-PLANS-STAGE-7-DIRECTORY-QUALITY-FABLE-018 공동 작업 장부

> 단계 7의 디렉터리 신경망·품질/학습/자율성 두 문서 현재 bytes를 감사한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `4e1d23cf31b34483f5f66ee3d7dfeaea5d315019`
- changed_artifact_paths: 디렉터리 신경망·품질/학습/자율성 두 공식 기획안
- 검토 범위: 물리 경로·권위 DAG·탐색/승인/증거 링크·Finding/Learning·자율성 승격/강등·DRAFT/물질화 경계
- 집중 검토 질문: 단계 8 사람 승인 패킷으로 넘어가기 전에 두 문서 묶음에 남은 필수 구조 결함이 있는가?
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-FABLE-STAGE-7-DIRECTORY-QUALITY-BUDGET-017`
- task_budget_usd_approved: `5.00`
- soft_budget_overrun_risk_accepted: `r001@5.00`
- 결정: 사용자의 상시 예산 재량 위임에 따라 AI 부 오케스트레이터가 두 문서 구조 감사의 soft cap을 USD 5.00으로 선택한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 5.00을 넘을 수 있다.
- 허용 범위: 두 공식 기획안과 두 검증 증거의 읽기 전용 구조 감사 1회.
- 금지: 동일 회차 중복 호출과 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=f5227ab86d12bfcc394fc323e8793617f64461c46da00cac4209af89a84e7fed -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `f5227ab86d12bfcc394fc323e8793617f64461c46da00cac4209af89a84e7fed`
- target_commit_sha: `4e1d23cf31b34483f5f66ee3d7dfeaea5d315019`
- input_files_sha256: `360018eb1f343cf6c0983d6ae389a1cd0303b4e7a7d3e0319374cef43334f0e1`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: FAB-ARCH-018-TEAM-DECISIONS-PATH-001, FAB-ARCH-018-PRE-ACTIVE-ORDER-002
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

단계 7 구조 종합 감사(INITIAL, 현재 bytes)를 완료했다. 확인된 정합: (1) 권위 DAG(team→ontology→orchestration→directory→quality)는 기계 판독 블록에서 비순환·단일 소유이고 두 문서 frontmatter depends_on과 정확히 일치한다. (2) §6 관계 표는 정방향만 허용하고 탐색 링크가 DAG에 의존성을 더하지 않으며 DELEGATED_PENDING→AUTHORITY_REF 전환 계약이 방향 의미를 보존한다. (3) Finding·Learning·자율성 승격/강등은 사람 Decision·지정 독립 검증자·독립검수 게이트를 우회하지 않고, Opus advisory가 Fable 게이트를 대체하지 못하며 실패 폐쇄가 유지된다(AGENTS:fable-required-review, AI-QUALITY:human-autonomy-gate 충족). (4) 네 DRAFT 문서의 ACTIVE 승격은 사람 승인 뒤 단일 activation commit으로 제한되고 부분 ACTIVE는 거부된다. (5) 단계 6 누적 상호참조 증거(71/71 PASS)와 현재 bytes 사이에 구조 모순은 없다. 다만 두 문서 결합부에서 Minor 필수 결함 2건이 남았다. 첫째, 평가 기획안 §8이 `docs/team/DECISIONS.md`를 자율성 승격·강등 승인 이력의 단독 소유자로 지정하지만, 디렉터리 기획안의 §4.2 목표 트리, §5.1 중앙 권위 표, 단계 2 materialization preflight 생성 집합 어디에도 이 경로가 등재되지 않아 물리 경로·단일 소유권 매핑이 결손된다(ROLE_CONTEXTS.md도 §5.1 표에 권위 행이 없다). 둘째, 평가 기획안은 ACTIVE 전 기존 route 전수 등록(§8)과 TEAM_LEARNING schema 이관(§6.1)을 요구하는데, 디렉터리 기획안 단계 2는 사람 activation decision 전 docs/team/ 권위 장부 생성을 금지하므로 두 의무의 실행 창이 미정의다. 문자 그대로 실행하면 단계 8 승인 전 물질화(AI-DIRECTORY:materialization-after-approval 위반) 또는 'ACTIVE 전' 전제조건 불충족이 발생한다. 두 결함 모두 문장 단위 수정으로 해소 가능하며 proposed_edits 4건을 제안한다. verdict=CHANGES_REQUIRED이고, 본 검수는 로컬 판정일 뿐 gate_state=OPEN은 유지된다.

### 공동 편집 제안 색인

- EDIT-018-DIR-TREE-DECISIONS-001: ADD `docs/디렉터리-문서신경망-재설계-기획안.md` · │  ├─ ROLE_CONTEXTS.md                활성 역할 컨텍스트 판본·hash 장부 · 원문은 review.md 참조
- EDIT-018-DIR-AUTHORITY-TABLE-002: ADD `docs/디렉터리-문서신경망-재설계-기획안.md` · | Learning 인스턴스 단일 장부 | `docs/team/TEAM_LEARNING.md` | · 원문은 review.md 참조
- EDIT-018-DIR-PREFLIGHT-WINDOW-003: ADD `docs/디렉터리-문서신경망-재설계-기획안.md` ·   않는다. 누적 외부 교차검수와 사람 activation decision 뒤 materialization preflight가 한 번에 만든다. · 원문은 review.md 참조
- EDIT-018-QUALITY-PREACTIVE-WINDOW-004: ADD `docs/AI-품질-학습-자율성-평가기획안.md` · 자동화는 A0으로 강등한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `f5227ab86d12bfcc394fc323e8793617f64461c46da00cac4209af89a84e7fed`
- target_commit_sha: `4e1d23cf31b34483f5f66ee3d7dfeaea5d315019`
- changed_artifact_paths: `docs/디렉터리-문서신경망-재설계-기획안.md`, `docs/AI-품질-학습-자율성-평가기획안.md`
- resulting_input_files_sha256: `PENDING_NEXT_REVIEW_MANIFEST`
- artifact_hashes: `[{"path":"docs/디렉터리-문서신경망-재설계-기획안.md","sha256":"d7d7a4d94de4f3f8ef1a1b0bc05a216e6ab3d152c23c25fcd92eef83891e4108","change_type":"MODIFIED"},{"path":"docs/AI-품질-학습-자율성-평가기획안.md","sha256":"66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a","change_type":"MODIFIED"}]`

### FAB-ARCH-018-TEAM-DECISIONS-PATH-001

- disposition: `APPLIED`
- 적용 위치: 디렉터리 기획안 §4.2·§5.1·단계 2
- 적용 내용: 목표 트리에 `DECISIONS.md`를 추가하고, 중앙 권위 표에 `ROLE_CONTEXTS.md`와 `DECISIONS.md`의 단일 소유 행을 등록했다. materialization preflight 생성 집합에도 두 장부가 포함됨을 명시했다.
- 반박 또는 부분 적용 근거: 없음
- 필요한 재검수: 현재 두 문서 bytes의 Fable recheck

### FAB-ARCH-018-PRE-ACTIVE-ORDER-002

- disposition: `APPLIED`
- 적용 위치: 디렉터리 기획안 단계 2, 평가 기획안 §6.1·§8
- 적용 내용: route 전수 등록과 TEAM_LEARNING schema 이관의 유일한 실행 창을 사람 activation decision 이후·네 문서 activation commit 이전 materialization preflight로 고정했다. 단계 8 승인 전 장부 생성 금지를 유지했다.
- 반박 또는 부분 적용 근거: 없음
- 필요한 재검수: 현재 두 문서 bytes의 Fable recheck

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- finding_ids: `FAB-ARCH-018-TEAM-DECISIONS-PATH-001`, `FAB-ARCH-018-PRE-ACTIVE-ORDER-002`
- verified_artifact_hashes: `docs/디렉터리-문서신경망-재설계-기획안.md=d7d7a4d94de4f3f8ef1a1b0bc05a216e6ab3d152c23c25fcd92eef83891e4108`, `docs/AI-품질-학습-자율성-평가기획안.md=66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a`
- command: `node --test --test-name-pattern="다섯 문서는 강연결" scripts/ai-plan-network-simulation.test.mjs`
- result: `1/1 PASS`
- command: `rg -n "DECISIONS\\.md|자율성 현재 단계 장부|activation decision 이후|materialization preflight" <두 문서>`
- result: 목표 트리·중앙 권위 표·두 문서의 동일 preflight 창 확인
- full_suite_note: 전체 71개 시뮬레이션의 작업큐·모델계획 manifest 동기화는 구조 재검수 뒤 별도 수행한다.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h002 · r002

- role: `HUMAN`
- reply_to_turn_id: `turn-c001`
- finding_ids: `FAB-ARCH-018-TEAM-DECISIONS-PATH-001`, `FAB-ARCH-018-PRE-ACTIVE-ORDER-002`
- decision_id: `DEC-AI-FABLE-STAGE-7-DIRECTORY-QUALITY-RECHECK-BUDGET-019`
- soft_budget_overrun_risk_accepted: `r002@1.70`
- 결정: 사용자의 상시 예산 재량 위임에 따라 AI 부 오케스트레이터가 같은 Task의 남은 상한 안에서 도구 기반 축소 재검수 soft cap을 USD 1.70으로 선택한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 1.70을 넘을 수 있다.
- 허용 범위: 두 Finding과 변경된 두 문서 bytes의 읽기 전용 재검수 1회.
- 금지: 동일 회차 중복 호출과 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r002 sha256=5e983cff57c56209ff2ce56f36bbf9072bdf9b0983745445c5853f364c95f96b -->
## FABLE_RECHECK · turn-f002 · r002

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `5e983cff57c56209ff2ce56f36bbf9072bdf9b0983745445c5853f364c95f96b`
- target_commit_sha: `4e1d23cf31b34483f5f66ee3d7dfeaea5d315019`
- input_files_sha256: `438aa3d4764ac09c83e61189fc650b247ab5ff683e72f2215e05b851a2287d20`
- 원본 검수: [r002/review.md](./rounds/r002/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

단계 7 RECHECK(현재 bytes, hash 봉인 스냅샷)를 완료했다. 두 필수 Finding의 수정이 모두 적용·검증되었다. (1) FAB-ARCH-018-TEAM-DECISIONS-PATH-001: 디렉터리 기획안 §4.2 목표 트리에 `docs/team/DECISIONS.md`가 등재되고(130행), §5.1 중앙 권위 표에 자율성 현재 단계 장부(`docs/team/ROLE_CONTEXTS.md`)와 자율성 승격·강등 승인 이력(`docs/team/DECISIONS.md`) 단일 소유 행이 추가되어(166–167행) 평가 기획안 §8의 권위 주장(413–415행: ROLE_CONTEXTS=현재 단계 단일 권위, DECISIONS=승인 이력만 소유)과 정확히 일치한다. 단계 2 materialization preflight 생성 집합에 두 장부 초기 생성이 명시되었다(413행). (2) FAB-ARCH-018-PRE-ACTIVE-ORDER-002: 두 문서가 route 전수 등록과 §6.1 TEAM_LEARNING schema 이관의 유일한 실행 창을 '사람 activation decision 이후·네 문서 activation commit 이전' materialization preflight로 동일하게 고정했다(디렉터리 411–414행, 평가 420–423행·341–344행). 사람의 단계 8 승인 전 docs/team/ 장부 신규 생성 금지는 양쪽에서 모순 없이 유지되고, 기존 TEAM_LEARNING.md의 schema 이관은 같은 창의 봉인된 별도 Task로 명시되었다. Codex 증거는 두 산출물 hash가 스냅샷 manifest(d7d7a4d9…, 66883bb4…)와 일치함을 확인했고 대상 시뮬레이션 1/1 PASS·rg 감사로 동일 preflight 창을 검증했다. 수정이 권위 DAG·단계 6 누적 상호참조 증거와 새로운 모순을 만들지 않음을 확인했다. 두 Finding 모두 VERIFIED이며 remaining_required_finding_ids는 비었다. verdict=PASS이나 이는 로컬 판정이며 VERIFIED·PASS는 외부 게이트를 닫지 않고 gate_state=OPEN이 유지된다. 전체 71개 시뮬레이션 manifest 동기화는 Codex 기록대로 별도 후속 수행 대상이다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r002 -->
