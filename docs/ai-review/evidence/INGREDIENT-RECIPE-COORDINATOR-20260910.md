# 식재료·레시피 재개 체크포인트 — 2026-09-10

이 문서는 실행·검수 조정 증거다. 공식 제품 명세나 Fable 검수 원본을 대체하지 않는다.

## 기준점과 소유권

- 권위 루트: `C:\Users\jacop\프로젝트\식자재관리앱`.
- 브랜치: `codex/ingredient-completion-parallel`.
- 현재 HEAD: `c5a247274f1fa3532c23d8376fe13f37edb04ba0`.
- 이 커밋은 식재료 충돌 복구 후속 9파일만 포함하며 origin에 푸시됐다. 레시피 F1 11파일과 통합 담당의 `scripts/verify.mjs` 변경은 미커밋이다.
- 봉인 모델 계획 SHA256: `82e3edc4a15e3f97f13875de6a8ffb747220304e4773be64bc83ddd511d6666c`, 재확인 일치.
- 원본 스터디·영수증·실패 로그는 변경하지 않았다. 개발·운영 DB 및 기존 재고·원장은 변경하지 않았다.

## 식재료

Claude 지정 채팅의 9파일 읽기 전용 후속 회신을 확인했다. 이전 도달성, 접근성 고지 맥락, 최초 상세 미확보 시 메모 메뉴 무반응 3지적은 코드 수준 종결이며 새 차단급 지적은 없다. 웹 스크린리더 실효성 가설과 확인 후 메모 포커스는 비차단 후속 항목이다. 실제 작은 화면·IME·VoiceOver·TalkBack 검증은 남았다.

기준 제출물은 `.codex/ingredient-44-study/reachability-submission-20260910.json` SHA256 `702c3f627d6612f49544123702fa15fcb1d5f8d08f1b82c277662f6f899fb71c`다. 앞선 통합 담당의 6파일 85시험 PASS와 작성자의 관련 128시험 PASS는 별도 실행이며 합산하지 않는다.

44항목 원본의 33구현·7부분·4폐기는 정적 분류이고 전수 PASS가 아니다. 지정 Claude 채팅에 원본 및 `unreviewed-44-delta-20260910.md`, `test-index-status-delta-20260910.md`를 승계한 잔여 스터디 검수를 요청했다. 식재료 담당에는 U1 혼합 단위 정렬·추천, U2 ea/개/모, U4 취소 문구의 재현·최소 수정안·파일 소유 범위를 제출하도록 지시했다. 이 단계에서 제품·DB·공용 파일 변경은 하지 않도록 했다.

## 레시피 F1 직접 검증

후속 영수증 `.codex/recipe-study/f1-followup-submission-receipt-20260910.json` SHA256 `a1c8c8b95afb0dd97b1361ae0b8c1851065562584912db95a3a8381cf003a320`의 11파일, 결과, 증거 11개를 현재 bytes와 비교해 모두 일치했다. 결과 SHA256은 `5c31b77cc720f3b2df544eb9df081471e03ee79cef0ba737ea01c2ee8620c6c3`다.

통합 담당이 제품 4파일 diff, 신규 UI 시험, SQL56, 실제 DB 왕복 시험, migration guard를 직접 읽었다. 원래 수량과 표시 문자열을 분리해 무변경 확인 시 분수 수량·원총액을 보존하고, linked 비용은 서버가 계산하며 independent 비용은 행 합계로 전달한다. 혼합 2행의 참조와 값 대응을 검사하며 자식 UUID의 무변경 보존을 주장하지 않는다.

| 직접 실행 | 결과 | 범위·제한 |
|---|---|---|
| `corepack pnpm --filter @margincook/mobile exec vitest run tests/recipeEditContractUi.test.tsx tests/recipeFormParity.test.tsx tests/recipeSearchParity.test.tsx tests/recipeDbRoundTrip.test.tsx` | 09:38:21 KST, 4파일 54 PASS / DB7 SKIP, exit0 | 화면·훅·초안·계약 시험. DB7은 아래 별도 실행 |
| `node packages/db/tests/recipe-detail-migration-anchors.mjs fresh_recipe_f1_20260910_02` | 7 PASS | missing/duplicate 두 앵커, LF/CRLF, 재적용. 트랜잭션 rollback |
| `RECIPE_ROUNDTRIP_DB=fresh_recipe_f1_20260910_02`로 `vitest run tests/recipeDbRoundTrip.test.tsx` | 09:39:06 KST, 13 PASS, 28.10초, exit0 | 실제 DB7+일반 계약6. Docker/psql transport, 실제 hook/form. HTTP/PostgREST·네이티브 인증은 아님 |
| `git diff --check` | exit0 | 현재 tracked 변경의 공백 오류 검사 |

첫 로컬 vitest 실행은 패키지 캐시 접근 EPERM으로 실행되지 않았고, 승인된 확장 권한으로 위 시험을 재실행했다. 테스트 성공으로 환경 실패 기록을 숨기지 않는다.

작성자의 SQL56/56·통합 모바일829 PASS·타입 PASS는 후속 영수증의 해시 결속된 기존 로그에서 확인한 결과다. 위 직접 실행 수치와 구별한다.

Claude 지정 채팅에 F1 후속11파일과 `scripts/verify.mjs` 배선을 읽기 전용 재검수하도록 요청했고, 게시된 요청 및 검수 진행을 확인했다. 수정된 verify④ 전체 단계 실행 증거는 아직 없다. 개발 DB reset은 요청하지 않았으며 타입 재생성 검증은 격리 DB에서 수행해야 한다.

## 다음 작업과 미완료 게이트

F2 수용·소유권 설계 `.codex/recipe-study/f2-acceptance-ownership-c5a2472-20260910.md`의 원문과 SHA256 `e9819f04c23a17bb29e243bd4953abed9bc7c24f072eeaf2ee7897708f2b7f79`를 통합 담당이 확인했다. 신규 명령의 CAS 선행과 정확히 같은 커밋 영수증의 인증된 무쓰기 재사용을 분리하는 방향을 수용했다. 구현 완료나 독립검수 통과 판정은 아니다.

레시피 담당에게 신규 독립 시험 파일 작성만 허용하고, F1 후보·기존 시험·제품·migration·공유 파일·Git 쓰기 금지는 유지했다. root의 DB 시험은 종료되어 `fresh_recipe_f1_20260910_02`에 한한 시험 실행권을 돌려주었다. 실제 개발·원격 DB와 reset은 제외한다. 두 Claude 채팅 모두 새 검수 요청이 게시된 것을 브라우저에서 확인했으며, 이 기록 시점에는 최종 후속 회신이 없다.

- 레시피 담당은 F1 후보를 고정한 채 F2 현행 4RED와 미래 수용시험을 분리해 준비한다. F2 제품·revision·receipt·ACL·seed 변경은 아직 착수하지 않았다.
- F1 후속 검수 회신을 대조한 후 최소 수정·재검증·커밋을 진행한다. U1/U2/U4도 실제 결함과 제품 선택사항을 구분한 뒤 구현한다.
- 기존 verify③의 P0 화면 변경 금지 게이트 실패는 미해결이다. 보호 기준을 임의 완화하거나 baseline을 덮어쓰지 않는다.
- 정확한 변경판의 전체 verify 6/6, 정식 Fable 독립검수, exact-SHA CI, main 병합·운영 배포는 미완료다. 사용자 지정 Claude 자문은 이를 대신하지 않는다.

## F1 후속 Claude 회신 처분

사용자 지정 레시피 검수 작업의 후속 회신을 직접 읽었다. 후보 11파일과 증거 해시를 별도 확인했고, 기존 시험 배선·표시 정밀도·혼합 부자재·구 응답 소비처 지적은 명시 범위 내 해결, 신규 코드 차단사항은 없다는 정적 자문이다. SQL 전체 로그 자체의 DB명 누락은 잔여 증거 한계이며 영수증의 DB명과 혼동하지 않는다. 작성자 로그의 726파일 일치는 해당 제출 당시의 사실이며 이후 F2/U4 병행 변경이 있는 현재 전체 트리 동일성을 주장하지 않는다.

수정된 verify④를 채택하려면 exit0뿐 아니라 지정된 `fresh_verify_*` DB명과 실DB 7건을 포함한 13건 무skip 통과를 확인해야 한다. 기존 DB 없는 ②의 7skip을 ④의 성공으로 쓰지 않는다. 개발 DB reset 권고와 부동소수 산술 지적은 Claude가 철회했다. 마스터 부자재 단위 표시·목록 순서·원정밀도 편집 UX는 후속 P3이다.

F1 11파일과 통합 담당 verify 배선, 이 조정 기록만 분리 커밋 대상으로 선정한다. 미완료 F2 재현 파일·식재료 U4 변경·다른 미추적 파일은 포함하지 않는다. F2 신규 실제 시험의 RED는 미구현 계약을 드러내므로 현재 전체 테스트가 통과한 상태라고 표현하지 않는다. F2 설계는 같은 지정 Claude 작업에 읽기 전용 검수를 요청했다.

F1 분리 커밋 `c6c83fea3175175134c223e104c803342c5648e4`를 origin의 작업 브랜치에 푸시하고 양쪽 SHA 일치를 확인했다. main 병합이나 배포는 하지 않았다.

## U4 취소 안내 소묶음 검수

식재료 담당의 U4 영수증 SHA256 `511280a5dad5acf4d792b5541933fb1a852caefbb6955a3ff0bec4b283ab7a99`를 기준으로 제품 본문 분기와 시험 diff를 직접 확인했다. 차감은 해당 수량 복구, 폐기는 해당 수량 복구·폐기 손실 취소로 안내하고 입고 본문은 유지했다. 버튼·RPC·중복 방지·원장 로직은 변경하지 않았다.

통합 담당이 09:49:33 KST `stockRevertAction.test.tsx` 및 `ingredientPendingContracts.test.tsx`를 재실행해 2파일 9시험 PASS/exit0을 확인했다. 실제 DB가 아닌 RPC mock 시험이다. 작성자의 관련 4파일 26PASS·타입PASS는 별도 제출 로그이며 미구현 U1/U2 4FAIL은 비기본 진단에 원본 증거와 함께 보존됐다. 미충족 계약을 기본 시험 통과로 집계하지 않는다.

사용자 지정 Claude의 U4 후속 회신은 3파일·문서 해시와 서버 근거를 대조해 신규 차단/비차단 지적 없이 소묶음 종결을 권고했다. 읽기 전용 자문이며 시험·DB 재실행이나 정식 Fable 판정은 아니다. U4 세 파일과 이 기록만 분리 커밋한다. U5/U6 키 수명·동시 수정 및 레시피 F2는 아직 별도 미완료다.
