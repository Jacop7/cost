
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `150bb69c6a2f9632e425728c55b42c7d804e08ce`
- 요청: provider 호출 없이 실패한 Task039/r001을 보존한 뒤, 동일 v0.5 산출물에 대해 유효한 WORKING_TREE_HASHED 단일 패스 Fable compact 재검수를 요청한다.
- 축소 범위: 작업큐·파일럿·과거 검수 원본은 전송하지 않고 v0.5 공식 키트, 검사 코드, package 계약과 AGENTS.md만 대상으로 한다.
- 집중 검토 질문: 템플릿이 사람 승인·운영 권한을 만들지 않고, core와 project adapter를 명확히 분리하며, v1.0 이식 검증 상태를 과장하지 않는가?
- 실행한 테스트·현재 증거: `corepack pnpm ai:starter-kit:check` 2/2 통과; `corepack pnpm ai:plans:simulate` 71/71 통과.
- 사람 결정이 필요한 항목: 없음. r001 soft-cap 위험 수용은 이어지는 HUMAN_DECISION에 별도 고정한다.
- next_review_request: `HUMAN_DECISION`
