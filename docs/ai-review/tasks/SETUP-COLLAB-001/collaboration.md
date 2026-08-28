# SETUP-COLLAB-001 공동 작업 장부

> 이 작업은 공동 초안 스냅샷과 대화 합류가 실제로 작동하는지 확인한다. 이전 턴은 수정하거나
> 삭제하지 않는다.

## SOLAR-ORCH · r001 요청

- 공동 산출물은 `docs/ai-review/README.md`다.
- 역할별 완성 문서 사본이 아니라 하나의 공식 산출물을 공동 편집한다고 명시했는지 확인한다.
- 페이블의 원본 검수 파일을 회차별로 버리지 않고 보존한다고 명시했는지 확인한다.
- 두 조건이 충족되면 `PASS`한다. 문구가 모순되면 실제 줄을 근거로 finding과 대체 문구를 제안한다.

<!-- fable-review:r001 sha256=08c0e3cf930f915d68523d578cd134acb9171cb3e385e172fdbe0aacbb514e0d -->
## FABLE-ARCH · r001 · PASS

SMOKE r001 판정: PASS. 허용 경로 2개(AGENTS.md, docs/ai-review/README.md)만 읽었고 쓰기·셸·네트워크는 사용하지 않았다.

COLLAB-1(단일 공동 산출물): README.md 3-6행이 "같은 공식 산출물을 차례로 개선"과 tasks/ 디렉터리가 복제 장소가 아님을, 10-11행이 역할별 사본 금지와 allowed_paths 파일이 유일한 공동 산출물임을, 24-25행과 55행이 최종 문서 하나·순차 편집을 명시한다. 충족.

COLLAB-2(회차별 원본 보존): 16-17행이 review.json·review.md 영구 보존과 원본 미편집·다음 회차 정정을, 42-44행이 rounds/rNNN 내 원본 불변을, 59행이 직접 편집·삭제 금지를, 143-146행이 append-only와 틀린 검수도 삭제하지 않음을 명시한다. 충족.

COLLAB-3(대화 장부 합류): 14-15행이 collaboration.md 시간순 추가·과거 턴 수정 금지를, 18-20행이 proposed_edits의 자동 합류와 솔라/부오케스트레이터의 반영 책임을, 68행·78-79행·147행이 원본 보존과 장부 자동 합류·직전 review.json 자동 전달을 명시한다. 충족.

두 조건을 뒤집거나 서로 모순되는 문구는 없다. 비차단 Improvement 2건만 남긴다: (1) README.md 144행의 `REOPENED`가 133행 review_state 열거와 실행기 응답 규약(reopened_finding_ids 목록)에 없어 용어가 어긋남 — 대체 문구를 proposed_edits로 제안. (2) AGENTS.md 9-15행 문서 책임 목록에 검수 규격 문서 항목이 없어 148행의 "AGENTS.md 우선" 규칙이 양방향으로 연결되지 않음 — AGENTS.md는 기준 commit 고정이므로 별도 사람 승인 변경으로 처리할 것을 권고.

- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 미해결 Finding: 없음
- 공동 편집 제안: COLLAB-001-E1-REOPENED-WORDING, COLLAB-001-E2-AGENTS-INDEX-NOTE

### COLLAB-001-E1-REOPENED-WORDING · REPLACE · `docs/ai-review/README.md`

위치: ## 7. 보존·정정 규칙 — '틀린 검수도 삭제하지 않는다.' 항목(144-145행)

> - 틀린 검수도 삭제하지 않는다. 다음 회차가 같은 finding ID를 `CLOSED` 또는 `DISPUTED`로 정정하거나,
>   `reopened_finding_ids`에 올려 `OPEN`으로 되돌린다.

근거: 6절 review_state 열거(133행)에 없는 REOPENED 대신 기존 상태값과 실행기 응답 규약의 reopened_finding_ids 목록으로 표현해 상태 어휘를 일치시킨다.

### COLLAB-001-E2-AGENTS-INDEX-NOTE · COMMENT · `AGENTS.md`

위치: ## 프로젝트와 권위 — 문서 책임 목록(11-15행)

> AGENTS.md는 기준 commit 고정 파일이므로 이번 회차에서 편집하지 않는다. 별도 사람 승인 변경 시 다음 한 줄을 목록 끝에 추가할 것을 제안한다:
> - AI 공동 작성·독립 검수 규격: `docs/ai-review/README.md`

근거: README 148행이 AGENTS.md 우선을 선언하는데 AGENTS.md 쪽에는 역참조가 없어 권위 문서에서 검수 규격을 찾을 수 없다.

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR-ORCH · r001 수정 응답

- `COLLAB-001-REOPENED-STATE-TERM`: 제안을 수용해 `docs/ai-review/README.md`의 정정 규칙을
  `reopened_finding_ids → OPEN`으로 바꿨다. 상태 필드와 이벤트 목록을 구분했다.
- `COLLAB-001-AGENTS-DOC-INDEX`: 실제 공동 작업 폴더의 `AGENTS.md`와 `CLAUDE.md` 문서 책임
  목록에 `docs/ai-review/README.md` 링크를 이미 추가했다. 다만 이 작업의 권위 기준 commit에는
  아직 포함되지 않았으므로 이번 hash 초안 검수에서는 닫았다고 주장하지 않는다. 최종 COMMIT
  게이트에서 확인한다.
- 제품 코드·DB·RLS·운영 데이터는 변경하지 않았다.
- Codex 증거: `node --check scripts/fable-review.mjs`, JSON 파싱, `fable:check`, COMMIT 스모크와
  WORKING_TREE_HASHED 스모크가 실행됐다. 전체 제품 `pnpm verify`를 대신하지 않는다.

## SOLAR-ORCH · r002 재검수 요청

- 첫 번째 용어 finding의 수정 여부를 같은 Finding ID로 확인한다.
- 두 번째 AGENTS 역참조는 기준 commit에서 아직 보이지 않는다는 사실을 유지하되, 선택적 개선으로
  제품 PASS를 막지 않는다.
- 새로운 필수 모순이 없다면 PASS한다.

<!-- fable-review:r002 sha256=5950563c3089400ec6c72b134d9a181337e85c14919746edb55f5372b1abfc26 -->
## FABLE-ARCH · r002 · PASS

RECHECK r002 판정: PASS. 허용 경로 2개(AGENTS.md, docs/ai-review/README.md)만 읽었고 쓰기·셸·네트워크는 사용하지 않았다. AGENTS.md sha256은 r001과 동일(539d410c…)하며 README.md만 바뀌었다(0ab039c1…).

COLLAB-001-REOPENED-STATE-TERM → CLOSED. README.md 144-145행이 r001 제안 E1 그대로 "다음 회차가 같은 finding ID를 `CLOSED` 또는 `DISPUTED`로 정정하거나, `reopened_finding_ids`에 올려 `OPEN`으로 되돌린다"로 바뀌었다. 133행 review_state 열거에 없던 `REOPENED`가 사라졌고, 재개는 실행기 응답 규약의 reopened_finding_ids 목록으로 표현되어 상태 어휘가 일치한다. 수락 기준 1 충족. 최초 발견 역할(FABLE-ARCH)이 직접 닫는다.

COLLAB-001-AGENTS-DOC-INDEX → OPEN 유지(Improvement, 비차단). AGENTS.md 9-15행 문서 책임 목록은 여전히 5개 항목뿐이고 검수 규격 역참조가 없다. README 89행 규칙대로 이 모드에서 AGENTS.md는 기준 commit과 같아야 하므로 이번 회차에서 고칠 수 없는 것이 정상이며, 장부에 "실제 작업 폴더에는 추가했으나 기준 commit 미포함, 최종 COMMIT 게이트에서 확인"이라는 이월 결정이 기록돼 있다. 필수 finding이 아니므로 remaining_required_finding_ids에는 넣지 않는다.

요구사항 재확인: COLLAB-1(단일 공동 산출물) 3-6·10-11·24-25·55행, COLLAB-2(회차별 원본 보존) 16-17·42-44·59·143-146행, COLLAB-3(장부 합류) 14-15·18-20·68·78-79·147행이 r001과 같은 줄에 그대로 남아 있다. 이번 수정으로 새로 생긴 모순이나 두 원칙을 뒤집는 문구는 없다. 새 proposed_edits는 없다.

- 원본 검수: [r002/review.md](./rounds/r002/review.md)
- 미해결 Finding: 없음
- 공동 편집 제안: 없음

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r002 -->
