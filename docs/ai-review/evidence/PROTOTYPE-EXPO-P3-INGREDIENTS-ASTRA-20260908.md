# P3 식재료 공용 우선 재접근 — Astra 내부 교차검수

앱 검수 대상: `703d46405a8df84f66458a0c9443160ea1b7ec69`.
측정 보완: `8f5ba28e73be81ed963e5bcccb376a5a415f19ab`,
`0af12e3b74f13b0bc3d6e2ccb99ebb27039f3ee5` (앱 diff 없음).

출처: 같은 Codex 작업의 독립 하위 검수자 `astra_p3_cross_review`의 코드·실렌더·PNG 검토.
이 기록은 Fable/Opus 공식 외부 검수 또는 P3 전체 최종 승인으로 사용하지 않는다.

## 발견·정정·재검수

| ID | 최초 대상 | Major 근거 | 정정 | 재검수 범위 판정 |
|---|---|---|---|---|
| A-F01 | 2de75fc | 320×720·font200%에서 ING-07 최신순 필터 right364.86, viewport보다44.86px 이탈 | ConditionRow 공용 래핑 | targeted web 해결 확인 |
| A-F02 | 2de75fc | 같은 조건 ING-05 폐기 탭 right359.53,39.53px 이탈 | 로컬 탭을 공용 ScrollTabs로 교체 | targeted web 해결 확인 |

검수자는 `candidate-4` 12화면+5상태 모두를 직접 보고 프로토타입12화면과 비교했다.
보통 크기에서 추가 Major 시각 결함을 발견하지 않았으며 Input 기본값·tone 우선순위·ING05
기능 계산과payload 보존·ING07 실제 정렬 상태 표시·ING10 공용Sheet 높이 조정을 확인했다.

`responsive-2` JSON과 핵심 PNG(ING05 세 탭, ING07)를 읽고 6/6 클릭·선택·도움말 도달·footer경계
결과와 행간 겹침 해소를 확인했다. `responsive-1`은 기하6/6이나 안내문 가독성은 FAIL이다.
RN 설치 소스 iOS Fabric `RCTAttributedTextUtils.mm:225`, Paper `RCTTextAttributes.mm:139`,
Android `TextAttributeProps.java:374–382`에서 lineHeight도 확대함을 확인했으므로 확정TYPE 행간을
이 웹 font-only 실험만으로 변경하지 않는 판단에 동의했다.

## 남은 범위

- Android/iOS 실제 확대·터치·키보드 회피
- 12화면 전체200%·긴 번역·모든 스크롤 구간·다양한 데이터
- ConditionRow 긴 라벨+right의 실브라우저 조합(현재 실제 소비처0)
- P3 승계 게이트·승인 시각 manifest·공식 외부 독립검수

## 게이트 별도 검토

`p3_gate_contract_review`는 읽기 전용으로 P0/P2 역사 검사와 P3 현재 검사의 모순을 확인했다.
P0검사322행 경로 금지만 지워도324행 스크립트hash와345–351행 현재 감사 출력 완전일치가 다시
충돌한다. P2시각검사도 헤더5화면 전용이므로 P3본문 승인으로 쓸 수 없다.

권고: 기존 baseline blob·측정tree·당시 검사기·분류를 보존하고 별도P3 successor가 정확한
변경 파일 전후blob·등록화면/상태·새/해소/유지 감사 Finding·시각 증거·검수target을 양방향 결속한다.
경로 예외/전체허용/glob 허용/동일개수 비교/조상PASS 재사용은 하지 않는다. 이 검토에서는 검사기나
임계값을 변경하지 않았고 실행 결과를 만들어 내지 않았다. 실행서P3 체크포인트에서 미해결로 추적한다.

## 후속 큰 글자 재검수 — 044e7fb

대상 `044e7fb10bbe91fa10ff0d5ab11c95d6762d04ee`, 내부 하위 검수자 `astra_p3_cross_review`.
이 단위는 앞 일반390 검수보다 넓으며 같은 의미의 최종승인으로 합산하지 않는다.

| ID | 발견 | 제품 수정 | 재검수 |
|---|---|---|---|
| B-F01 Major | ING01 이름이 상태·카테고리 배지 사이에서 소실. text-200-r3. 기준82651be부터 존재 | cbd616e IngCard 행wrap, Badge값 불변 | responsive4 이름4종 fullNameFits true, PNG 확인. 해당 web범위 CLOSED |
| B-F02 Major | ING10 조리 후 배지가 −50g을 침범. 같은 기준판의 기존 결함 | cbd616e 날짜/배지 그룹wrap | 3행 overlapArea0, PNG 확인. 해당 web범위 CLOSED |
| B-F03 Minor | RecentChangeRow 주석이 label도축소하는 코드와 모순 | 5c23368 주석정정+badge basis0 제거 | 주석일치, 완전소실방지 확인. 전체 상태글자 표시라는 주장은 불가 |

candidate6→7 정상390의 ING01 및 ING10은 각각 PNG SHA 동일함을 검수자가 대조했다.
기존 값·Badge·core 계산·RPC를 바꾸지 않고 큰 글자 행 관계를 조정했다.
BasePrice의 값 표시, 날짜 두 개·마지막 정렬·footer 도달, 기존 ING05 탭·도움말도 확인했다.

미해결: ING11 제목/시각 압축, 장문·다양한 데이터, 네이티브/키보드, P3 게이트 어댑터와 외부검수.
이 결과는 Fable/Opus 공식 독립검수 또는 전체 P3 최종종결이 아니다.

## 공유 수정 이력의 후속 검수 — 3c6c6c2

구현자는 `astra_p3_cross_review`, 별도 읽기 전용 검수자는 `p3_gate_contract_review`다.
주 에이전트도 PNG 전후를 직접 확인했다. 공식 외부 검수와는 구분한다.

- `2240209`: 식재료/메뉴 각 390 기본·320 기본·320/200% 첫 viewport를 검토했다.
  ING11 날짜 숫자 분해와 제목 소실은 해소됐으나 주 에이전트가 발견한 날짜 구분자 공백 차이가 남았다.
- `3c6c6c2`: NBSP 정정 후 검수자가 새 6개 PNG와 JSON을 다시 확인했다. PNG/body hash 6/6 일치,
  오류·배율 오차·가로 넘침 0. 날짜 공백 Minor는 CLOSED이며 해당 첫 viewport 웹 범위의 추가 Finding은 없다.
- 정상 390px의 ING11은 이전 candidate-7과 PNG SHA가 완전히 같다. RCP02b의 변경 전 캡처가 없어
  메뉴 전후 동일성은 판정하지 않았다.
- 목록 전용 배지 축소만 추가됐고 상세 배지 기본값·폰트·색·formatter·서버 ID 판정은 유지됐다.

여전히 미확인: 두 번째 이후 사건의 스크롤 가독성, 긴 값/모든 상태, 상세 시트 확대 기하,
네이티브 및 공식 Fable/Opus 독립검수. 첫 viewport 검토 의견을 P3 최종종결로 사용하지 않는다.

## 상세·스크롤 후속 — a436025

주 에이전트가 구현하고 `p3_gate_contract_review`가 읽기 전용 검수했다.
대상 `a436025ae37f9dab8d9a62a3db213c98853cfb23`, 원본 측정 `6cac057`.

- 200% 상세에서 `기준 단가`와 `제육볶음`이 잘리던 문제를 확인했다.
- 값 행 wrap·항목명 자연 너비·헤더/배지의 반응형 배분으로 해당 샘플의 말줄임과 과도한 분해를 개선했다.
- `change-history-expanded-after2`의 6개 상세 PNG·JSON과 diff를 검수했다. 상세 본문·폰트·색·
  formatter·계산·상태 선택은 유지되고, 확인한 후보 범위에서 추가 가독성 Finding은 없다.
- 첫 목록 PNG는 원본과 6조건 모두 같다. 390px 상세는 식재료 2픽셀·메뉴 3픽셀 차이로 완전 동일하지 않다.
- 기존 회차와 달리 상세 배지도 `allowShrink`에 참여한다. 이전의 상세 배지 무변경 설명은 이전 SHA의 기록이다.

범위는 최초 로드된 식재료 2행·메뉴 1행과 첫 사건 상세 시작/끝이다. 긴 상세의 실제 스크롤·pagination·
네이티브·외부 독립검수는 미완료다. 목록 요약의 의도된 말줄임은 남아 있으며 수집기의 exit 0을
모든 leaf 가독성 PASS로 해석하지 않는다. 자세한 한계와 다음 target 순서는 세부 실행서에 기록했다.

## ING02/04 공용 선택 시트 — abf1250

주 에이전트가 구현하고 `astra_p3_cross_review`는 코드/공용 계약을,
`p3_gate_contract_review`는 측정기와 최종 산출물을 읽기 전용으로 검수했다.
공식 Fable/Opus 검수의 대체가 아니다.

| ID | 발견·근거 | 적용·검증 |
|---|---|---|
| PICK-F01 Major | UnitPicker에 역할·선택 상태 없음. 가이드 1000–1002행 | `eb29733`에서 button/native selected를 추가. 웹은 토글 버튼으로 만들지 않고 “현재 선택됨” 이름을 제공 |
| PICK-F02 Minor | 공용 Select 및 폼 두 진입점에 역할·필드 이름 연결 누락 | `eb29733`에서 공용 optional label/expanded와 폼 소비 연결. 스타일을 복제하지 않음 |
| PICK-F03 | 주 에이전트 실렌더 발견: 신규 거래처 입력 320/200% 취소가 두 줄. 부모 1:2가 가이드 670·784행의 1:1과 불일치 | `abf1250`에서 부모 비율만 1:1. 기본 크기에서도 버튼 폭/위치가 바뀌는 의도된 수정 |

`astra_p3_cross_review`는 `04e7cb27`까지의 코드 및 전용 시험 12/12를 직접 재현했고
PICK-F01/F02의 코드 측면을 PASS로 판정했다. 200% 목록에서 거래처 추가를 누르기 전에
확대해야 한다는 후속 지적은 `abf1250` 수집기의 별도 trigger 경로로 반영했다.

측정기 검수 중 재열기 상태를 저장만 하는 결함, 동일 값 선택으로 변경 성공이 가능한 결함,
배율 검사 NaN/분리 DOM 누락을 정정했다. 닫기 backdrop은 옵션 집계에서 제외했다.
인증/읽기 차단을 포함한 초기 시도는 성공 증거가 아니며 `pickers-before-r4`를 유효 원본으로 쓴다.

증거 폴더: `pickers-before-r4`(ec108326, 36PNG), `pickers-after`(04e7cb27, 42PNG),
`pickers-after2`(abf1250, 48PNG). 공통 경로는
`docs/prototypes/three-surface-p3-ingredient-visual/`이다. 각 JSON은 exact sourceCommit과 PNG hash를 보존한다.
주 에이전트 재측정: 최종 선택 변경·재열기 안내·닫기 18/18, vendor 추가 접근/입력 취소 6/6,
비교 가능한 목록 PNG 36/36 원본 동일. 최종 타입검사 exit 0, 모바일 264/264.

한계: 현재 로드 목록과 한국어 웹 390·320·320/200% 근사뿐이다. 긴 목록·영어·키보드/IME·
네이티브 접근성/터치·저장 RPC는 미검증이다. Modal visibility stub 시험과 실제 브라우저 증거를 구분한다.
수정 폼의 단위 그룹 정책과 신규 거래처 저장 실패 Alert는 기존 기능 계약 후속으로 별도 남긴다.

최종 독립 내부 검수: `p3_gate_contract_review`가 abf1250의 source/script SHA·48PNG 실제 해시,
원본 대비 36장 동일성, 18조건 선택·재열기·닫기와 vendor 6조건을 직접 대조했다. 7PNG 시각 표본에서
취소 두 줄 → 한 줄과 390/320 표시를 확인했고 추가 Finding은 없었다. 전체 헤더/푸터 규격·영어·
네이티브·공식 외부 승인으로 범위를 넓히지 않는다. Fable/Opus 공식 전송은 NOT_SENT를 유지한다.

## ING03/06 구매 옵션 행·단가 — b5351c6

주 에이전트 구현, `astra_p3_cross_review`의 소스/공용 계약 검수와
`p3_gate_contract_review`의 수집기/보존 증거 검수를 분리했다. Fable/Opus 대체가 아니다.

| 항목 | 근거·처리 |
|---|---|
| 고정 배지 높이 | Astra가 height18을 지적. 실제 320/200%에서 자연 높이와 용량행 충돌 확인. 공용 Badge를 변경하지 않고 부모 고정을 제거 |
| 이름·값 경쟁 | 긴 옵션의 왼쪽 이름 소실·금액 한 글자 분해를 전후 PNG에서 확인. 두 host의 PurchaseOptionRow 배치만 공유, 각 글자 변형/formatter/가격 계산은 보존 |
| 단가 footer | 긴 새 값의 가로 이탈을 확인. 이전 값·화살표+새 값 그룹 wrap. `0.005` 비교와 단가 계산은 변경하지 않음 |
| 구매처 Select | 기존 공용 선택 API의 필드/현재값 이름·expanded 소비 연결 |
| 단위 컨트롤 | kg에 더해 ml/박스 선택 후 390/320/200% 직접 촬영. 관측한 문제 없어 기존 2:1 유지. 단위 base 정책 변경은 섞지 않음 |
| 긴 행 증거 누락 | 첫 after의 영문 관리 행 아래쪽이 footer 뒤라 끝 접근을 입증하지 못한다는 검수 의견 수용. 최종 수집기는 각 행 첫/마지막 textual endpoint를 별도 스크롤하고 경계 안 노출을 단언 |

Astra는 b5351c6 source의 계산/환산/최저·최고/브랜드 순서/저장/이동 및 두 host의 타이포
변형을 대조하고 전용 시험 10/10을 직접 재현했다. 코드 범위 추가 차단 Finding 없음이며,
50% 최소 폭은 새 후보 배치 판단이므로 실렌더 확인을 별도로 요구했다.

두 번째 검수자는 원본 fcfc408과 첫 after b5351c6의 72PNG 실제 해시, 각각24조건36PNG,
출처별 script hash와 162개 text/fontSize/fontWeight 동일성을 대조했다. 14개 시각 표본에서 확인된
영역의 추가 Finding은 없지만 긴 행 끝이 미측정임을 지적했다. 이 범위 제한은 위 수집기 보완으로 처리했다.

보존: `options-before`(fcfc408), `options-after`(b5351c6), `options-unit-before`(27bdfac),
`options-after2`(93f8b3b). 공통 폴더는 `docs/prototypes/three-surface-p3-ingredient-visual/`.
최종 24조건60PNG와 48끝점은 원본의 서로 다른 text 162개를 보존한다. 24는 페이지 수가 아니라
2 fixture × 4 host × 3 웹 조건이다. 서버 도메인 쓰기는 없고 auth POST는 허용됐다.
입력/아이콘/실제 occlusion/네이티브·키보드·모든 데이터 범위는 증명하지 않는다.
주 에이전트 b5351c6 타입 검사·모바일274/274, 93f8b3b 타입 검사 exit0. 전체 verify PASS로 쓰지 않는다.

최종 재검수 수신: Astra가 총16PNG(일반390/320 양host, long200% 시작/끝·편집,
kg/ml/박스200%, 원본390)를 직접 확인하고 요청한 웹 시각 표본 범위 PASS로 판정했다.
일반 폭의 불필요한 줄바꿈 없음, 큰 글자 값 보존, 자연 배지 높이의 의도된 변화, 단위 2:1 유지에
동의했다. 다른 검수자는 최종60PNG hash와48끝점을 전수 대조하고 가장 긴 영문 행의 두 PNG를
직접 확인해 “끝 접근 증거 부족” 지적을 닫았다. 두 검수 모두 추가 차단 Finding 없음이다.
이는 공식 외부 승인이나 전체 상태/네이티브 종결로 확대하지 않는다.

## ING03 메모 · ING06 빈 목록/추가 — 60e86ef

| Finding | 수정/판정 |
|---|---|
| MEMO-F01 Major — 명시 입력 이름 없음 | 공용 MemoEditSheet TextInput에 `accessibilityLabel="메모"` 추가. 입력값 유무 두 시험이 기존판 실패→수정판 통과 |
| MEMO-F02 Minor — footer1:1.4 | 가이드784의1:1에 맞춰 완료flex만1. Button의variant/폰트/색 유지. 실제390 양쪽171px·320/200% 양쪽136px |
| 수집기-F01 — 100자 fill만 기록 | 실제 inputValue가 draft와 같은지 단언. 절단된 입력으로 취소복원만 통과하는 경로 방지 |
| 수집기-F02 — 내부 스크롤 기록만 존재 | textarea 시작/끝의 actual/expected 차이를 단언하고 PNG와 보존 |

출처 `9632f32f58e5895222c2906912d4b173a7528acc` → `60e86efe9c8276f7a619730e0a8828540485b8f1`.
`forms-before-r2`/`forms-after` 각각9조건21PNG. 최초 `forms-before`는 Modal 전환 중 중복 locator로
실패해 유효 원본에서 제외하고 보존했다. 수집기가 단일 Modal과 animation 종료를 기다리도록 수정했다.
옵션/메모만 합성값이고 주변은 실제 읽기 데이터다. 쓰기/미등록 RPC guard를 유지하며 제출하지 않았다.
textarea textContent의 Range는 실제 입력 표시가 아니므로 별도 controls 값/스크롤로 구분했다.

주 에이전트 타입검사exit0·모바일283/283. Astra가 신규9시험을 직접 재현하고 메모4PNG,
추가200%3PNG·빈 목록200%1PNG를 직접 검수해 두 디자인 Finding을 코드/표본 범위에서 닫았다.
메모100자·입력 처음/끝·1:1footer·취소→메뉴 재열기 복원3/3 확인. 실제 RecipeDetail 통합 또는
네이티브/키보드 검수가 아니다. GenericHost 두문구 테스트를 두제품화면 증거로 쓰지 않는다.

dirty 폐기확인·저장중backdrop·편집중refetch·최대길이 불일치는 기존 미해결 동작 계약으로 분리했다.
120자 기존값은 mock 시험에서 임의 절단 없이 보존됨을 확인했다. 실제 저장/Alert실패 경로는
실행하지 않았다. 공식 Fable/Opus NOT_SENT, 전체 P3 미종결 상태는 유지한다.

별도 검수자 `p3_gate_contract_review` 최종 재검수:42PNG 실제hash·source별script SHA,
100자 실제inputValue3건·scroll start0/end최대값56/56/440px·원본복원3건을 전수 대조했다.
오류/차단0·읽기RPC4종·제출없음과 불일치throw→exit1을 확인해 측정 누락 지적을 닫았다.
추가 Finding 없음은 이 웹 표본과 수집기 보완에 한정된다.

## ING07/08/09/10 필터 · 공용 요약 — 743807b

### 제품 검수

- Astra의 24d4f55 읽기 검수에서 웹 선택 상태와 구매/폐기 상세 조회 오류 누락 Major2건을 확인했다.
  `89be36d`에서 기존 picker의 웹 선택 이름 전략 및 공용 QueryState 혼합 상태 처리로 반영했다.
  상세 실패 때 단위 기본g를 보여주지 않으며 오류 retry는 상세/이력 양쪽을 호출한다. RPC·계산 불변.
- `p3_gate_contract_review`가 실제3화면 통합시험21건을 작성했다. Modal visibility/읽기만 mock하고
  BusinessDateGate와 공용 시트·화면 상태를 유지한다. 상세 loading/error4건 RED를 직접 재현한 뒤
  수정 후21/21·타입exit0을 확인했다. Astra도21/21을 별도로 재현해 두Major를 코드/시험범위에서 닫았다.
- `faffc63` 공용 SummaryCard 헤더 wrap은 별도 검수했다. Astra 신규4시험 직접통과, 소비4파일/5host의
  390px·320px/200% 총10PNG 직접검수. 제목과 값/보조 역할 배치·원래font/weight/color·metrics 계산
  보존에 동의했다. 배지18px의 명백한 겹침은 표본에서 보이지 않아 확정Finding으로 쓰지 않았다.
  이력행 말줄임/펼치기·긴 metrics·네이티브는 남겨 두었다.

### 수집기 검수와 보존

`history-before-r2`(733246d) / `history-after`(89be36d) 각각9조건27PNG, source별 수집기SHA와
실제54PNG hash를 별도 검수자가 대조했다. 대응27PNG는 전부 동일, 필터 선택이름만 변경됐다.
각27조회 날짜 기록·오류/차단0 확인. RPC 전체인자나 실제SQL 정확성을 증명하지 않는다.
최초`history-before`(37201bd) 실패는 note끝 이벤트명 제거를 고려하지 않은 fixture/locator 오류다.
원문을 고친 것이 아니라 fixture끝에 `기록`을 붙여 shared formatter와 충돌하지 않게 했다.

별도검수는 허용 RPC의 HTTP방식 제한과 확대 관측의 isConnected/유한수 검사가 빠진 점을 지적했다.
`743807b`에 반영하고 `history-summary-final`9조건27PNG로 재실행했다. 이전 자료를 삭제하지 않았다.
`history-summary-after`(faffc63)9조건27PNG 및 `summary-change-hosts-after`(faffc63)6조건6PNG도 보존한다.
주 에이전트가 요약 변경 전후489텍스트 관측의 text/fontSize/fontWeight 동일을 확인했다.

주 실행검증743807b: 모바일308/308, 타입통과. `verify --no-db` exit1:①②⑥통과,
③기존P0 제품변경금지 차단,④⑤생략. core194통과/12생략. 게이트 계약을 우회하지 않았다.
공식 외부검수NOT_SENT·전체P3미종결을 유지한다. 내부검수 또는 이33장 수정후 표본을 공식
외부승인·전체185target 검수로 확대하지 않는다.

최종 재검수 수신: `p3_gate_contract_review`가743807b 가드수정·최종9조건27PNG 실제hash 및
source별script SHA를 검증했다. faffc63 대비27PNG 바이트·text/fontSize/fontWeight·fixture·
조회27건·checks 모두 동일, 오류/차단/확대실패0을 확인했다. 금지방식 실제 음성요청 미실행 한계는 유지한다.

## ING03/07/09/10 긴 행·음수 잔량 — ca129a2

제품 후보 `ca129a2865ed249f8bb33010b4c7f2b615a8dfb5`는 원래 Expo LedgerRow/Purchase/Discard
행의 값 묶음을 wrap하고, identity 최소50% 후보·최대2줄을 사용한다. 구매 Badge 부모를 minHeight18로
바꾸고 날짜/상태를 wrap한다. 폐기 메뉴44px·삭제 권한/함수는 유지한다. 새 폰트/색/토큰을 만들지
않았으며 ING03 balNeg 누락만 기존 음수 색/800으로 복원했다.

`p3_gate_contract_review`가 실제 화면 두 개의 서버 잔량 부호 통합시험4개를 만들고1 RED를 확인했다.
주 에이전트 수정 후4/4 GREEN을 검수자가 독립 재실행했다. 실제 formatter/LedgerRow를 유지하고
RNW Text의 전달 style을 관찰한다. jsdom 폰트 픽셀·실DB 검산으로 쓰지 않는다.

수정 전 `history-rows-before-r2`(e2db16b), 후 `history-rows-after`(ca129a2) 각각12조건66PNG.
검수자가 실제132PNG hash·각 source의 script SHA·fixture 동일을 전수 대조했다. 오류·차단·확대
실패0, 현재 네 host의 note/vendor 두 번째 ancestor는 실제 행이다. 처음 `history-rows-before`
(f8e3cdf)는 상세의 LossCard 중복 note 때문에 strict locator 실패했고, footer 기준 Card scope로
수정했다. 실패 원본은 보존하며 `.first()`로 임의 선택하지 않았다.

전후336 leaf 문자열/크기 동일. ING03 음수 두 잔량의3조건×2끝점=12관측만 회색/400→음수빨강/800.
Range 불일치58→12는 중복 포함 관측값이고 잔존은200% 두 줄 말줄임이다. leaf-only Range는 중첩
단위 Text의 부모 숫자를 누락하며 endpoint.visible은 기록만 한다(전후132개 true). 주변 LossCard·
요약까지 통과한 증거가 아니고, 검사자가5PNG 표본에서 추가 Finding을 찾지 못한 범위다.

주 에이전트 필터 회귀9조건27PNG(`history-rows-filter-regression`) 오류/차단0, 모바일312/312·
타입PASS. verify--no-db는①②⑥PASS/③기존P0제품금지FAIL/④⑤생략(exit1), core194PASS/12SKIP.
공식Fable/Opus NOT_SENT, 전체P3미종결 및 두 줄 초과 내용 접근·Native/키보드 미완료는 유지한다.

Astra 최종 내부검수: 제품4파일 diff·음수잔량4시험 직접PASS·전후15PNG 직접비교. 이번 변경
범위 PASS, 새 차단 회귀 없음. 50% 후보를 전역토큰으로 승격하지 않는다. 구매 packSummary는
320/200%에서 `4,000` 뒤 `원` 줄 분리가 before/after 모두 존재하므로 숫자·단위 동행 전체 통과가
아니다. 기간 최고 요약의 말줄임도 기존 잔존이다. 이 둘 및 두 줄 초과 메모 접근은 별도 미완료로
남기며 내부검수로 공식Fable·전체화면·Native/실제터치 종결을 대신하지 않는다.

## 공용 metrics — 1d4afb3 CHANGES_REQUIRED → 61491e4 내부 PASS

구매 요약의 긴 단가 말줄임을 칸 단위 wrap으로 보완했다. 초판1d4afb3의 flexBasis:auto가 pair별
내용 폭을 다르게 배분해 정상390의 판매 소진 x194.515625/조정 x211.703125로 어긋나는 Minor를
Astra가 발견했다. 8구조시험은 통과했으므로 이를 실렌더 검증으로 대신할 수 없다는 사례다.

61491e4는 부모 onLayout 실측에서 기존 padding2개+gap을 빼고/2한 공통 최소폭을 사용한다.
추가 onLayout 시험은 리사이즈358→288→358 및0/음수/NaN/Infinity 거부를 확인한다.
Astra 직접9/9 PASS, 정상390 두 오른쪽 열x201 복원 및320/200% 구매 최고값
`12,345,678.90원/g` 전문 표시를 보존JSON/PNG로 재검수해 F01을 닫았다. 새 토큰/폰트/색 변경 없음.

보존: history-metrics-before(dffaa585),history-metrics-after(1d4afb3),history-metrics-after-r2
(61491e4) 각12조건72PNG(행66+별도summaryShots6). 주 에이전트216PNG hash 재계산 일치,
대응72샷 leaf문자열/크기/굵기/색 동일 확인. 잘못된 중간후보를 삭제하지 않았다. 주 에이전트 추가
metrics-change-hosts-after6조건6PNG는 실제 읽기 ChangeHistory 두entity 소비처이며200% 두샷을
직접 확인했다. 주변 live데이터/읽기 전용이고 모든수정이력·Native 검증이 아니다.

최신61491e4 모바일317/317·타입·웹번들PASS. verify--no-db①②⑥PASS/③기존P0제품금지FAIL/
④⑤skip(exit1), core194PASS/12SKIP. 공식 외부검수NOT_SENT,전체P3미종결은 유지한다.
packSummary 숫자/원 줄분리·2줄초과 메모·홀수장문 실제기하·Native/키보드는 별도 미완료다.

Astra 추가 소비처 재검수: ChangeHistory 두entity×390/320글자200%4PNG 직접확인,6조건JSON의
SHA·오류0 대조. 요약 제목/대표건수/직접·자동2열에서 새 겹침·잘림 없으며 이력행 자체는 판정 제외.
