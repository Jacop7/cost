
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: `docs/prototypes/full-page-flow-prototype.html`
- 검토 범위: 현재 프로토타입 용어 사전의 ‘레시피=만들기·수정·원가 구성 / 메뉴=판매·매출 집계’ 문맥 분리안을, 사용자 화면 전체에서 ‘메뉴’로 통일하는 제안과 대조한다.
- 제안 결론: 이 앱의 한 항목은 판매가·판매 상태·세금·매출·손익을 함께 가지는 판매 단위이므로, 사용자 노출 제목·탭·추가·수정·상세·카테고리·매출 문맥은 `메뉴`를 기준으로 한다. `기준 인분`·`사용 식재료`·`사용량`·`부자재`는 그대로 사용한다. DB·RPC·라우트·RCP 화면 ID의 `recipe` 식별자는 변경하지 않는다.
- 글로벌 가설: 현지화 키는 단일 판매 항목의 의미를 갖고, 한국어는 `메뉴`, 영어는 `Menu item` 또는 문맥상 `Dish`, 일본어는 `メニュー`, 중국어는 `菜品`을 사용한다. 영어 `Menu` 단독은 전체 메뉴판으로 읽힐 위험이 있다.
- 집중 검토 질문: 사용자 노출을 메뉴로 통일하면 조리 구성과 판매 단위를 잘못 동일시하는가? 별도 레시피 엔터티가 아직 없는 현재 계약에서 문맥 분리를 유지할 실익이 있는가? 현지화 키·라벨과 내부 `recipe` 식별자를 어떤 선에서 분리해야 하는가?
- 실행한 검사: `corepack pnpm fable:check` — Claude Code 2.1.260 연결·인증 정상; `git diff --check` — 오류 없음.
- 미실행: 제품 코드·DB·라우트 변경과 전체 `pnpm verify`는 이번 용어 의사결정 검수 범위 밖이라 실행하지 않았다.
- 이전 시도: 001은 모델 호출 전 task 입력의 AGENTS 해시 불일치로 차단됐으며, verdict·Finding·비용은 발생하지 않았다.
- next_review_request: `HUMAN_DECISION`
