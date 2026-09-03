
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
