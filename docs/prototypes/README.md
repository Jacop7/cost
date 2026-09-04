# docs/prototypes — 파일 안내

이 폴더에는 30개 파일이 있지만 **지금 작업하는 것은 아래 6개뿐**입니다. 나머지는 전부 백업·아카이브입니다.

---

## 1. 정본 — 이것만 수정한다

| 파일 | 역할 |
|---|---|
| **`0_full-page-flow-prototype-ui-applied.html`** | **프로토타입 최신본.** 화면 수정은 전부 여기서 한다 |

브라우저로 열 때: `?screen=<화면키>` · `?screen=<화면키>&popup=<팝업ID>` · `?terms=1`(용어 사전)

## 2. 정본을 설명하는 문서 5종 — 함께 갱신한다

| 파일 | 역할 |
|---|---|
| `full-page-flow-prototype-current-spec.md` | **디자인 확정안** — 화면별 문구·배치·업무 흐름 |
| `full-page-flow-prototype-ui-guide.md` | **UI 가이드** — 토큰·컴포넌트·레이어·접근성 계약 |
| `full-page-flow-prototype-changelog.md` | **변경 이력** — PRT-001~178, 결정의 근거 |
| `0_full-page-flow-prototype-ui-applied-review.md` | **검수 장부** — 화면·팝업별 7항목 판정 |
| `full-page-flow-prototype-design-context.md` | **맥락 장부** — 마지막 작업 지점과 다음 시작점 |

작업 절차는 `full-page-flow-prototype-design-work-plan.md`(실행서, 공통 규칙 잠금 C-01~C-21)에 있습니다.

## 3. 게이트

| 파일 | 역할 |
|---|---|
| `full-page-flow-prototype-design-sync-check.ps1` | 문서 동기화 자동 검사 |
| `full-page-flow-prototype-design-sync-state.json` | 마지막 완료 ID와 봉인 해시 |

`-Finalize`로 실행해 `PASS`가 나와야 작업 완료로 본다.

---

## 4. 백업 — 수정하지 않는다

| 파일 | 성격 |
|---|---|
| `full-page-flow-prototype.html` | **보존 원본.** 적용본이 갈라져 나온 기준점. 용어 사전 216개를 갖고 있지만 그 뒤의 화면 작업은 반영돼 있지 않다 |
| `full-page-flow-prototype-ui-components.css` / `.js` | 공통 UI 레이어 시도분. **현재 적용본에 연결돼 있지 않다.** CSS 변수 28개는 토큰 매핑의 근거로만 참조 |
| `full-page-flow-prototype-design-work-plan.html` | 실행서 뷰어. 마크다운 파서가 체크박스·표 정렬을 잃고 `file://`에서는 열리지 않는다 |

## 5. 아카이브 — 통합 이전의 설계 근거 15개

`all-detail-history-screens` · `business-hours-negative-stock-flow` · `business-hours-redesign` · `ingredient-discard-history` · `ingredient-history-common-ui` · `ingredient-price-inbound-history` · `ingredient-purchase-history-detail` · `ingredient-purchase-option-flow` · `ingredient-recipe-change-history` · `ingredient-recipe-update-status` · `ingredient-stock-add` · `negative-stock-sales-flow` · `recipe-profit-history` · `unified-change-history-all-cases` · `international-tax-settings`

지우지 않는다. 통합본에 없는 업무 규칙이 여기에만 남아 있다 — 영업 중 장부 스냅샷 고정, 영업시간 4종 검증, 기준 단가 추적, 5개국 세금 계산 엔진.

## 6. 스터디 보고서 2건

`full-page-flow-prototype-opus-study-20260904.md` · `prototype-terminology-opus-study-20260904.md`
Claude Opus 독립 전수 스터디 결과. 미해결 항목과 결정 대기 목록이 여기 있다.

---

## 알아둘 것

**적용본과 보존 원본은 갈라져 있다.** 용어 사전 216개는 양쪽에 같지만, 기준 인분 동적화(`recipeServingCount` / `recipeServingLabel`)는 **적용본에만** 있다. 보존 원본은 백업이므로 맞추지 않아도 되지만, 원본을 기준으로 무언가를 판단하면 안 된다.

**페이블 검수(`PROTOTYPE-TERMINOLOGY-003`)는 보존 원본을 대상으로 돌았다.** `artifact_paths`가 `full-page-flow-prototype.html`이다. 즉 최신 적용본은 아직 독립 검수를 받은 적이 없다.

**임시 작업 폴더가 따로 있었다.** `%LOCALAPPDATA%\Temp\codex-prototype-persistence-b10765a\docs\prototypes\` — 여기 있던 최신본을 2026-09-04에 이 폴더로 모았다. 임시 폴더는 백업으로 남아 있을 뿐 더 이상 작업 대상이 아니다.

**파일이 사라지면** — 이 폴더의 파일은 과거에 세 번 소실된 적이 있다. 복구는 한 줄이다.

```
git checkout codex/prototype-persistence -- docs/prototypes/
```
