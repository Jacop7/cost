# SETUP-SMOKE-001 Fable 검수 — r002

- 판정: **PASS**
- 역할: `FABLE-SEC`
- 모드: `SMOKE`
- 스냅샷: `COMMIT`
- 대상 SHA: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`

## 요약

SETUP-SMOKE-001 읽기 전용 연결 확인 결과 PASS. commit 77c9148의 AGENTS.md를 Read 도구로만 읽었다. SMOKE-1/AGENTS:project-title: 1행 제목 "# AGENTS.md — 식자재 관리 앱 작업 지침"에 `식자재 관리 앱`이 포함되어 있다. AGENTS:required-local-gate: 93행 "필수 로컬 게이트:" 아래 95~97행 코드 블록에 `corepack pnpm verify`가 명시되어 있다. 두 조건이 모두 충족되어 finding과 proposed edit 없이 PASS한다. SMOKE-2: 전달받은 commit/tree/blob/SHA-256 값과 snapshot_mode(COMMIT)를 그대로 되돌렸다. 허용 경로 외 파일은 읽지 않았고 쓰기·셸·네트워크 접근은 하지 않았다.

## Findings

없음

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
