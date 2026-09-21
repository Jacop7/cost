# PROTOTYPE-TERMINOLOGY-003 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `6497666e655609a4f4bfe10bfaea6070dad01286`

## 요약

PROTOTYPE-TERMINOLOGY-003 초기 검수(FABLE-ARCH, r001 단일 패스). 결론: 사용자 노출 명칭을 '메뉴'로 통일하는 SOLAR 제안의 방향은 타당하다. 현재 계약에서 한 항목은 판매가·판매 상태·세금·매출·손익을 함께 갖는 단일 판매 단위이고 별도 레시피 엔터티가 없으므로, '메뉴' 통일이 조리 구성과 판매 단위를 잘못 동일시하지 않는다 — 조리 구성은 기준 인분·사용 식재료·사용량·부자재 보조 라벨이 이미 분리 담당한다(요구 4 방향 충족). 문맥 분리를 유지할 실익은 확인되지 않았다. 실제 화면이 이미 한 흐름 안에서 두 이름을 섞는다: 레시피 리스트는 제목 '레시피' 아래 FAB '메뉴 추가'와 빈 상태 '해당 조건의 메뉴가 없어요'를 쓰고, '레시피 추가' 화면의 필수 필드는 '메뉴명'이며, 매출 홈은 '레시피 탭에서 메뉴를 먼저 등록해 주세요'라고 한 문장에서 같은 대상을 두 이름으로 부른다. 그러나 산출물인 프로토타입 용어 사전은 반대 결정('레시피=만들기·수정·원가 구성 / 메뉴=판매·매출 집계' context 분리)을 표준으로 기록하고 있어 요구 1을 충족하지 못한다(TERM-MENU-RECIPE-SPLIT-001, Major). 현지화 분리선은 '내부 recipe 식별자 = 불변 / 사용자 라벨 = 현지화 키'가 맞고, 현지화 키는 '단일 판매 항목' 의미의 semantic key(예: menuItem)로 두어야 하며 영어 'Menu' 단독 금지는 타당하다. 다만 SOLAR 가설의 일본어 'メニュー' 단독은 영어 'Menu'와 같은 '메뉴판 전체' 중의성을 그대로 가지며, 현 국제출시 계약이 앱 언어를 ko/en으로 한정하므로 ja/zh 문자열은 확정이 아닌 예약 결정으로만 기록해야 한다. 사전에는 이 현지화 키 항목 자체가 없다(TERM-I18N-MENUITEM-KEY-001, Major). 탭 라벨까지 '메뉴'로 바꾸는 범위는 AGENTS.md의 고정 하단 탭 '레시피' 및 features/README와 충돌하고, 프로토타입 사전만 바꾸면 경쟁 공식 기준이 생긴다 — AGENTS.md·README 갱신은 이 검수의 proposed_edits로 대신할 수 없으므로 별도 공식 태스크 연결이 필요하다(TERM-AGENTS-TAB-CANON-001, Major). 내부 recipe 식별자·RCP 화면 ID·라우트 불변(요구 3)은 제안과 사전 모두 준수함을 확인했다. 보조 라벨(요구 4)은 방향이 맞으나 '사용 식재료' merge 대 화면의 '재료/재료비 소계', '판매 중(지)' 띄어쓰기 대 화면 '판매중(지)' 등 사전-화면 불일치가 남는다(TERM-AUX-LABEL-DRIFT-001, Minor). 판정: CHANGES_REQUIRED. 사전 항목 개정 3건과 현지화 키 항목 신설 1건을 proposed_edits로 첨부했다. 모든 Finding은 OPEN이며 게이트는 열려 있다.

## Findings

### TERM-MENU-RECIPE-SPLIT-001 — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 같은 판매 단위가 화면·문장마다 '레시피'와 '메뉴'로 갈려 읽혀 재료 구성·판매가·판매 상태·세금·매출·손익이 서로 다른 대상처럼 보인다. 별도 레시피 엔터티가 없는 현재 데이터 계약에서 문맥 분리는 실익 없이 혼용 문장을 제도화하며, 산출물 사전이 이 혼용을 표준으로 고정하고 있어 요구 1을 충족하지 못한다.
- 근거: docs/prototypes/full-page-flow-prototype.html:184, docs/prototypes/full-page-flow-prototype.html:250, docs/prototypes/full-page-flow-prototype.html:130, apps/mobile/src/features/recipes/screens/RecipesListScreen.tsx:154, apps/mobile/src/features/recipes/screens/RecipeAddScreen.tsx:200, apps/mobile/src/features/sales/screens/SalesHomeScreen.tsx:415
- 완료 조건: 사전의 '레시피'(context) 항목을 판매 단위 canonical '메뉴' 기준으로 개정하고, '레시피'는 내부 recipe 식별자·데이터 계약 설명 전용으로 한정한다. / '메뉴명'·'레시피 카테고리'·'판매가 시뮬레이션' 등 파생 항목의 status/rule/scope를 같은 결정과 모순 없이 갱신한다. / 프로토타입 화면 문자열(screens.recipe_* title/label, FAB '레시피 추가', domains.recipe.label)을 사전과 일치시키거나, 전환 전 임시 상태임을 사전에 명시한다. / '레시피 탭에서 메뉴를 먼저 등록해 주세요' 같은 동일 대상 이중 명칭 문장을 금지 예시로 사전에 기록한다.
- 필요한 테스트: 프로토타입 렌더 결과의 recipe 도메인 사용자 노출 문자열과 용어 사전 canonical의 diff 대조 스크립트 / 앱 반영 단계에서 RCP·SALES 화면 vitest 문자열 검사(같은 화면 내 '레시피'/'메뉴' 혼용 부재)

### TERM-I18N-MENUITEM-KEY-001 — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 판매 단위 현지화 키의 의미가 산출물에 없어 '메뉴' 직역 위험이 남는다. 특히 SOLAR 가설의 일본어 'メニュー' 단독은 영어 'Menu' 단독과 동일한 '메뉴판 전체' 중의성을 가져 요구 2를 충족하지 못하며, ko/en만 지원하는 현 계약에서 ja/zh 문자열을 확정으로 기록하면 범위 밖 약속이 된다.
- 근거: COLLABORATION_LOG:0, docs/prototypes/full-page-flow-prototype.html:183, docs/국가-통화-세금-국제출시-기획안.md:37, docs/국가-통화-세금-국제출시-기획안.md:63
- 완료 조건: 사전에 판매 단위 현지화 항목을 추가한다: 현지화 키는 '단일 판매 항목' 의미의 semantic key(예: menuItem)로 정의하고 내부 recipe 식별자와의 분리를 명시한다. / 영어 'Menu' 단독 금지와 'Menu item'(음식 문맥은 'Dish') 권장을 기록한다. / 일본어 'メニュー' 단독의 메뉴판 중의성 검토 필요와 '商品' 등 대안 후보, 중국어 '菜品' 후보를 확정이 아닌 예약 결정으로 기록하고 ja/zh UI가 현재 출시 범위 밖임을 명시한다. / '메뉴 매출'·'메뉴 손익' 등 합성 라벨의 키 의미(menuItemSales 등)도 같은 규칙을 따르도록 명시한다.
- 필요한 테스트: 향후 i18n 리소스 도입 시 locale parity 시험에 판매 단위 semantic key 존재 검사와 영어 'Menu' 단독 문자열 금지 규칙 추가

### TERM-AGENTS-TAB-CANON-001 — Major / OPEN

- 범주: POLICY
- 영향: 통일 결정이 탭 라벨까지 포함하면 권위 정책(AGENTS.md 고정 탭 '레시피')과 충돌한다. 이 검수는 reference 문서를 편집할 수 없으므로 프로토타입 사전만 갱신하면 단일 공식 산출물 원칙을 위반하는 경쟁 기준이 남는다. 반면 recipe 식별자·RCP 화면 ID·라우트 불변(요구 3)은 제안·사전 모두 준수함을 확인했다.
- 근거: AGENTS.md:77, apps/mobile/src/features/README.md:12, COLLABORATION_LOG:0, AGENTS.md:24
- 완료 조건: 결정 채택 시 AGENTS.md 탭 명칭과 features/README 라벨을 같은 결정 SHA에 결속해 갱신하는 별도 공식 태스크를 발행한다(이 검수의 proposed_edits로 대신하지 않는다). / 그 전까지 사전은 탭 라벨을 '레시피 유지(AGENTS 갱신 태스크와 동시 전환 예정)'로 명시하거나 탭을 통일 범위에서 잠정 제외한다. / RCP- 화면 ID·라우트·DB/RPC recipe 식별자는 어떤 경우에도 변경하지 않음을 사전에 재확인 기록한다.
- 필요한 테스트: 후속 태스크에서 verify ③ 문서 그래프 검사로 AGENTS.md·features/README·용어 사전의 탭 명칭 일치 확인

### TERM-AUX-LABEL-DRIFT-001 — Minor / OPEN

- 범주: UX
- 영향: 보조 라벨 축 자체는 판매 대상 명칭과 혼동되지 않아 요구 4의 방향은 충족하지만, 사전 canonical과 실제 화면 문자열의 불일치('사용 식재료' 대 '재료', '판매 중(지)' 대 '판매중(지)')가 남아 사전의 규범력이 약해지고 후속 적용 시 혼선이 생긴다.
- 근거: docs/prototypes/full-page-flow-prototype.html:255, apps/mobile/src/features/recipes/screens/RecipesListScreen.tsx:36, apps/mobile/src/features/recipes/screens/RecipeAddScreen.tsx:260
- 완료 조건: '사용 식재료' 항목의 rule/scope를 실제 화면 용례('재료' 섹션 제목·'재료비')와 모순 없이 재기술하거나 화면 문자열 갱신 계획을 사전에 명시한다. / '판매 중'/'판매 중지' 표기를 프로토타입·앱 화면 문자열과 일치시킨다.
- 필요한 테스트: 사전-화면 문자열 diff 스크립트에 보조 라벨('재료'/'사용 식재료', '판매 중(지)') 포함

## 공동 편집 제안

### EDIT-TERM-MENU-CANON-01 — REPLACE

- 대상: `docs/prototypes/full-page-flow-prototype.html`
- 위치: term('공통·탐색','레시피',['메뉴'],'context','만들기·수정·원가 구성은 ‘레시피’, 판매·매출 집계 대상은 ‘메뉴’로 구분합니다.','레시피 · 매출관리'),
- 연결 Finding: TERM-MENU-RECIPE-SPLIT-001, TERM-AGENTS-TAB-CANON-001
- 이유: 별도 레시피 엔터티가 없는 단일 판매 단위 계약에서 문맥 분리는 혼용 문장을 제도화한다. 사용자 노출 canonical을 '메뉴'로 확정하고 '레시피'를 내부 식별자 설명으로 한정한다.

    term('공통·탐색','메뉴',['레시피'],'merge','판매가·판매 상태·세금·매출·손익을 갖는 단일 판매 항목의 사용자 노출 명칭은 문맥과 무관하게 ‘메뉴’로 통일합니다. ‘레시피’는 내부 recipe 식별자·데이터 계약 설명에만 남기고, 탭 라벨 전환은 AGENTS.md 갱신 태스크와 동시에 적용합니다.','레시피 탭 · 매출관리 · 전 화면'),

### EDIT-TERM-MENUNAME-02 — REPLACE

- 대상: `docs/prototypes/full-page-flow-prototype.html`
- 위치: term('레시피·메뉴','메뉴명',['레시피명'],'context','판매 대상 이름 입력은 ‘메뉴명’, 레시피 마스터를 설명할 때만 ‘레시피’를 사용합니다.','RCP-03'),
- 연결 Finding: TERM-MENU-RECIPE-SPLIT-001
- 이유: 같은 폼에서 제목 '레시피 추가'와 필드 '메뉴명'이 갈리는 현행 혼용을 없애고 화면 단위로 명칭을 일치시킨다.

    term('레시피·메뉴','메뉴명',['레시피명'],'merge','판매 항목의 이름 필드는 항상 ‘메뉴명’이며, 같은 화면의 제목·CTA도 ‘메뉴 추가/수정’으로 맞춥니다. 내부 recipe 식별자는 그대로 둡니다.','RCP-03'),

### EDIT-TERM-MENU-CATEGORY-03 — REPLACE

- 대상: `docs/prototypes/full-page-flow-prototype.html`
- 위치: term('레시피·메뉴','레시피 카테고리',['메뉴 카테고리'],'merge','레시피 분류의 사용자 노출 명칭은 ‘레시피 카테고리’입니다.','레시피 · MY'),
- 연결 Finding: TERM-MENU-RECIPE-SPLIT-001
- 이유: 카테고리 문맥도 판매 단위 canonical '메뉴'를 따르게 하되 식별자 불변(요구 3)을 명문화한다.

    term('레시피·메뉴','메뉴 카테고리',['레시피 카테고리'],'merge','판매 항목 분류의 사용자 노출 명칭은 ‘메뉴 카테고리’입니다. RCP 화면 ID·라우트·DB 식별자는 유지합니다.','레시피 탭 · MY'),

### EDIT-TERM-I18N-MENUITEM-04 — ADD

- 대상: `docs/prototypes/full-page-flow-prototype.html`
- 위치: term('레시피·메뉴','판매가',['메뉴 가격','판매 가격'],'merge','고객에게 받는 메뉴 단가는 ‘판매가’로 통일합니다.','레시피 · 매출관리'),
- 연결 Finding: TERM-I18N-MENUITEM-KEY-001
- 이유: 요구 2(직역 금지·semantic key)를 산출물에 기록한다. SOLAR 가설 중 일본어 'メニュー' 단독의 중의성 위험을 명시하고 ja/zh를 범위 밖 예약 결정으로 한정한다.

    term('레시피·메뉴','메뉴(현지화 키 menuItem)',['Menu 단독','メニュー 단독','recipe 직역'],'context','현지화 키는 ‘단일 판매 항목’ 의미의 menuItem으로 정의하고 언어별 직역을 금지합니다. 영어는 ‘Menu item’(음식 문맥은 ‘Dish’)을 쓰고 ‘Menu’ 단독은 메뉴판 전체로 읽혀 금지합니다. 일본어 ‘メニュー’ 단독도 같은 중의성이 있어 ‘商品’ 등과 함께 원어민 검토 후 확정하며, 중국어는 ‘菜品’을 후보로 둡니다. ja·zh UI는 현재 출시 범위(ko/en) 밖의 예약 결정입니다.','i18n 리소스 · MY-08'),

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: TERM-MENU-RECIPE-SPLIT-001, TERM-I18N-MENUITEM-KEY-001, TERM-AGENTS-TAB-CANON-001, TERM-AUX-LABEL-DRIFT-001

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
