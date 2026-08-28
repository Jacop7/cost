# SETUP-COLLAB-001 Fable 검수 — r002

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 모드: `RECHECK`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`

## 요약

RECHECK r002 판정: PASS. 허용 경로 2개(AGENTS.md, docs/ai-review/README.md)만 읽었고 쓰기·셸·네트워크는 사용하지 않았다. AGENTS.md sha256은 r001과 동일(539d410c…)하며 README.md만 바뀌었다(0ab039c1…).

COLLAB-001-REOPENED-STATE-TERM → CLOSED. README.md 144-145행이 r001 제안 E1 그대로 "다음 회차가 같은 finding ID를 `CLOSED` 또는 `DISPUTED`로 정정하거나, `reopened_finding_ids`에 올려 `OPEN`으로 되돌린다"로 바뀌었다. 133행 review_state 열거에 없던 `REOPENED`가 사라졌고, 재개는 실행기 응답 규약의 reopened_finding_ids 목록으로 표현되어 상태 어휘가 일치한다. 수락 기준 1 충족. 최초 발견 역할(FABLE-ARCH)이 직접 닫는다.

COLLAB-001-AGENTS-DOC-INDEX → OPEN 유지(Improvement, 비차단). AGENTS.md 9-15행 문서 책임 목록은 여전히 5개 항목뿐이고 검수 규격 역참조가 없다. README 89행 규칙대로 이 모드에서 AGENTS.md는 기준 commit과 같아야 하므로 이번 회차에서 고칠 수 없는 것이 정상이며, 장부에 "실제 작업 폴더에는 추가했으나 기준 commit 미포함, 최종 COMMIT 게이트에서 확인"이라는 이월 결정이 기록돼 있다. 필수 finding이 아니므로 remaining_required_finding_ids에는 넣지 않는다.

요구사항 재확인: COLLAB-1(단일 공동 산출물) 3-6·10-11·24-25·55행, COLLAB-2(회차별 원본 보존) 16-17·42-44·59·143-146행, COLLAB-3(장부 합류) 14-15·18-20·68·78-79·147행이 r001과 같은 줄에 그대로 남아 있다. 이번 수정으로 새로 생긴 모순이나 두 원칙을 뒤집는 문구는 없다. 새 proposed_edits는 없다.

## Findings

### COLLAB-001-REOPENED-STATE-TERM — Improvement / CLOSED

- 범주: OTHER
- 영향: 7절 정정 규칙의 어휘가 6절 열거와 실행기 응답 규약(reopened_finding_ids)에 맞춰져 status.json 갱신·회차 간 finding 추적에서 해석이 갈릴 여지가 사라졌다. 보존·정정 규칙의 의미는 유지된다.
- 근거: docs/ai-review/README.md:144, docs/ai-review/README.md:133, COLLABORATION_LOG:0
- 완료 조건: 7절 정정 규칙의 상태 어휘가 6절 review_state 열거 또는 응답 규약의 reopened_finding_ids 중 하나로 일관되게 표현된다. (충족)
- 필요한 테스트: 없음

### COLLAB-001-AGENTS-DOC-INDEX — Improvement / OPEN

- 범주: ARCHITECTURE
- 영향: 권위 문서가 검수 규격 문서를 가리키지 않는 상태가 기준 commit에서는 그대로다. 정책 충돌이 아니고 단일 산출물 원칙도 훼손하지 않으므로 PASS를 막지 않는다. 최종 COMMIT 게이트에서 AGENTS.md 변경이 포함된 새 기준 commit으로 확인할 사항이다.
- 근거: AGENTS.md:9, docs/ai-review/README.md:89, docs/ai-review/README.md:148, COLLABORATION_LOG:0
- 완료 조건: 기준 commit의 AGENTS.md 문서 책임 목록에 'AI 공동 작성·독립 검수 규격: docs/ai-review/README.md' 한 줄이 사람 승인 변경으로 포함되어 COMMIT 모드 회차에서 확인되거나, 추가하지 않기로 한 결정이 collaboration.md에 기록된다.
- 필요한 테스트: 없음

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: COLLAB-001-REOPENED-STATE-TERM
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
