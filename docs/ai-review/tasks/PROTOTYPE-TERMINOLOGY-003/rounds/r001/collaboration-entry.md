
<!-- fable-review:r001 sha256=ad066edfbb3b958362233492dea9c2573ec629d84438cd42dd94589616c0468f -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `ad066edfbb3b958362233492dea9c2573ec629d84438cd42dd94589616c0468f`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- input_files_sha256: `5a0b66e312202bc1345b4fa760b442cfdf8b775d44831726291361a1d15f6eed`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: TERM-MENU-RECIPE-SPLIT-001, TERM-I18N-MENUITEM-KEY-001, TERM-AGENTS-TAB-CANON-001, TERM-AUX-LABEL-DRIFT-001
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

PROTOTYPE-TERMINOLOGY-003 초기 검수(FABLE-ARCH, r001 단일 패스). 결론: 사용자 노출 명칭을 '메뉴'로 통일하는 SOLAR 제안의 방향은 타당하다. 현재 계약에서 한 항목은 판매가·판매 상태·세금·매출·손익을 함께 갖는 단일 판매 단위이고 별도 레시피 엔터티가 없으므로, '메뉴' 통일이 조리 구성과 판매 단위를 잘못 동일시하지 않는다 — 조리 구성은 기준 인분·사용 식재료·사용량·부자재 보조 라벨이 이미 분리 담당한다(요구 4 방향 충족). 문맥 분리를 유지할 실익은 확인되지 않았다. 실제 화면이 이미 한 흐름 안에서 두 이름을 섞는다: 레시피 리스트는 제목 '레시피' 아래 FAB '메뉴 추가'와 빈 상태 '해당 조건의 메뉴가 없어요'를 쓰고, '레시피 추가' 화면의 필수 필드는 '메뉴명'이며, 매출 홈은 '레시피 탭에서 메뉴를 먼저 등록해 주세요'라고 한 문장에서 같은 대상을 두 이름으로 부른다. 그러나 산출물인 프로토타입 용어 사전은 반대 결정('레시피=만들기·수정·원가 구성 / 메뉴=판매·매출 집계' context 분리)을 표준으로 기록하고 있어 요구 1을 충족하지 못한다(TERM-MENU-RECIPE-SPLIT-001, Major). 현지화 분리선은 '내부 recipe 식별자 = 불변 / 사용자 라벨 = 현지화 키'가 맞고, 현지화 키는 '단일 판매 항목' 의미의 semantic key(예: menuItem)로 두어야 하며 영어 'Menu' 단독 금지는 타당하다. 다만 SOLAR 가설의 일본어 'メニュー' 단독은 영어 'Menu'와 같은 '메뉴판 전체' 중의성을 그대로 가지며, 현 국제출시 계약이 앱 언어를 ko/en으로 한정하므로 ja/zh 문자열은 확정이 아닌 예약 결정으로만 기록해야 한다. 사전에는 이 현지화 키 항목 자체가 없다(TERM-I18N-MENUITEM-KEY-001, Major). 탭 라벨까지 '메뉴'로 바꾸는 범위는 AGENTS.md의 고정 하단 탭 '레시피' 및 features/README와 충돌하고, 프로토타입 사전만 바꾸면 경쟁 공식 기준이 생긴다 — AGENTS.md·README 갱신은 이 검수의 proposed_edits로 대신할 수 없으므로 별도 공식 태스크 연결이 필요하다(TERM-AGENTS-TAB-CANON-001, Major). 내부 recipe 식별자·RCP 화면 ID·라우트 불변(요구 3)은 제안과 사전 모두 준수함을 확인했다. 보조 라벨(요구 4)은 방향이 맞으나 '사용 식재료' merge 대 화면의 '재료/재료비 소계', '판매 중(지)' 띄어쓰기 대 화면 '판매중(지)' 등 사전-화면 불일치가 남는다(TERM-AUX-LABEL-DRIFT-001, Minor). 판정: CHANGES_REQUIRED. 사전 항목 개정 3건과 현지화 키 항목 신설 1건을 proposed_edits로 첨부했다. 모든 Finding은 OPEN이며 게이트는 열려 있다.

### 공동 편집 제안 색인

- EDIT-TERM-MENU-CANON-01: REPLACE `docs/prototypes/full-page-flow-prototype.html` · term('공통·탐색','레시피',['메뉴'],'context','만들기·수정·원가 구성은 ‘레시피’, 판매·매출 집계 대상은 ‘메뉴’로 구분합니다.','레시피 · 매출관리'), · 원문은 review.md 참조
- EDIT-TERM-MENUNAME-02: REPLACE `docs/prototypes/full-page-flow-prototype.html` · term('레시피·메뉴','메뉴명',['레시피명'],'context','판매 대상 이름 입력은 ‘메뉴명’, 레시피 마스터를 설명할 때만 ‘레시피’를 사용합니다.','RCP-03'), · 원문은 review.md 참조
- EDIT-TERM-MENU-CATEGORY-03: REPLACE `docs/prototypes/full-page-flow-prototype.html` · term('레시피·메뉴','레시피 카테고리',['메뉴 카테고리'],'merge','레시피 분류의 사용자 노출 명칭은 ‘레시피 카테고리’입니다.','레시피 · MY'), · 원문은 review.md 참조
- EDIT-TERM-I18N-MENUITEM-04: ADD `docs/prototypes/full-page-flow-prototype.html` · term('레시피·메뉴','판매가',['메뉴 가격','판매 가격'],'merge','고객에게 받는 메뉴 단가는 ‘판매가’로 통일합니다.','레시피 · 매출관리'), · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
