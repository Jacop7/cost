# AI-TEAM-STARTER-KIT-V05-COMPACT-WORKING-040 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `150bb69c6a2f9632e425728c55b42c7d804e08ce`

## 요약

v0.5 스타터 키트 compact WORKING_TREE_HASHED 단일 패스 검수 결과 PASS. (1) Task·HANDOFF·역할·팀 템플릿과 core/adapter 이식 경계가 모두 존재한다: templates/TASK-PACKET.md·HANDOFF.md·ROLE-CONTEXT.md·TEAM-MANIFEST.md, CORE-CONTRACT.md의 "이식 경계" 절, adapters/README.md의 adapter/profile 분리 규칙. (2) 공통 core에 제품·DB·운영 credential·사람 승인 권한·MarginCook 고유값이 복제·생성되지 않았다. 키트 9개 문서 전문을 확인했고 MarginCook/supabase_admin 등 프로젝트 식별자가 없으며, TEAM-MANIFEST는 chat_is_approval_authority: false를, CORE-CONTRACT는 사람 승인·운영 실행 권한 분리, 독립검수 병렬 호출 금지, 자동 배수 증액 금지를 명시한다. (3) README.md 6–7행이 "빈 저장소 fixture와 프로젝트 adapter를 통한 전체 이식 검증은 v1.0 범위다"라고 한정해 v1.0 이식 검증을 완료로 과장하지 않는다. (4) package.json에 ai:starter-kit:check·ai:plans:simulate 스크립트가 존재하고 제출된 증거(2/2, 71/71)와 정합한다. 필수 OPEN Finding은 없고 Improvement 1건만 기록: 검사기의 프로젝트 고유값 금지 스캔이 9개 키트 파일 중 4개만 대상으로 하고 첫 테스트의 필수 파일 목록에 templates/README.md가 빠져 있어, 전체 파일로 확장하는 proposed_edits 2건을 첨부했다. 부수 관찰로 package.json 26–27행이 LF, 나머지가 CRLF로 혼재하나 기능 영향이 없다. PASS는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 유지된다.

## Findings

### STARTER-KIT-040-TEST-COVERAGE-01 — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 검사기 커버리지 부분 누락으로, 향후 편집에서 스캔 제외 5개 템플릿 파일에 프로젝트 고유값·credential 문구가 유입되거나 templates/README.md가 비워져도 ai:starter-kit:check가 통과할 수 있다. 현재 스냅샷의 실제 내용은 요구사항을 준수하므로 PASS를 막지 않는다.
- 근거: scripts/ai-team-starter-kit.test.mjs:26, scripts/ai-team-starter-kit.test.mjs:11
- 완료 조건: 두 번째 테스트의 sources 목록이 docs/ai-team-starter-kit 하위 공식 산출물 9개 파일 전체를 포함한다. / 첫 번째 테스트의 required 목록에 templates/README.md가 포함된다. / 확장 후 corepack pnpm ai:starter-kit:check가 통과한다.
- 필요한 테스트: corepack pnpm ai:starter-kit:check

## 공동 편집 제안

### EDIT-040-SCAN-ALL-KIT-FILES — ADD

- 대상: `scripts/ai-team-starter-kit.test.mjs`
- 위치:   const sources = [
- 연결 Finding: STARTER-KIT-040-TEST-COVERAGE-01
- 이유: 프로젝트 고유값 금지 스캔을 4개 파일에서 키트 공식 산출물 9개 전체로 확장해, 스캔 제외 템플릿에 프로젝트 식별자·credential 문구가 유입되는 회귀를 결정적 검사로 차단한다.

        `${kit}/START-HERE.md`,
        `${kit}/templates/README.md`,
        `${kit}/templates/TASK-PACKET.md`,
        `${kit}/templates/HANDOFF.md`,
        `${kit}/templates/ROLE-CONTEXT.md`,

### EDIT-040-REQUIRED-TEMPLATES-README — ADD

- 대상: `scripts/ai-team-starter-kit.test.mjs`
- 위치:   const required = [
- 연결 Finding: STARTER-KIT-040-TEST-COVERAGE-01
- 이유: 공식 artifact_paths에 포함된 templates/README.md의 존재·비어있음 검사를 필수 파일 목록에 추가해 커버리지 누락을 제거한다.

        `${kit}/templates/README.md`,

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
