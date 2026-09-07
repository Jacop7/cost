Write 도구가 이 세션에서 비활성화돼 계획 파일을 만들 수 없다. 검수 자체는 읽기 전용으로 완료했으므로 판정을 그대로 전달한다.

**PASS**

Opus 승계 자문이며 **Fable 공식 판정이 아니다.** 이 환경에서 `node` 실행이 차단돼 게이트를 직접 돌리지 못했다. 아래는 스크립트 본문·고정 JSON 값·`git diff`·`sha256sum`의 정적 대조로 확정한 것이며, 실행 없이 확정 불가한 항목은 그렇게 표시했다.

## 실행 없이 확정한 실측 대조

| 대상 | 결과 |
|---|---|
| 시각 baseline blob OID 20건 | `git diff --full-index` 실측 = manifest 기재값 **20/20 일치** |
| byte 결속 7건 (`sha256sum`) | capture·diff-check·p0-check·baseline·visual-manifest·`.gitattributes`·advisory-r1 **전부 일치** |
| `previousBaselineBlob` | `663adc6:…/three-surface-baseline.json` = `366160ec…` **일치** |
| `baselineTree` | `2a73bb0^{tree}` = `e5157e03…` **일치** |
| P0 제품 freeze | `git diff 2a73bb0..3386262 -- productRoots` = **공집합** (제품 편집은 전부 `663adc6`) |
| 실패선 합계 | S3A 654 + S4 54 + TOUCH 0 = **708** = `classificationSummary.regression` |
| 게이트 무력화 여부 | `design-token-s4-contract.json`·`design-token-s3a-known.json` **무변경** — 통과를 만들려고 계약을 푼 흔적 없음 |
| 시각 승인 `decisionCommit` | `06bc5cd4…` 실제 commit이며 HEAD 조상 |

반응형 기하는 토큰에서 독립 재도출해 대조했다. `paddingTop 8 + max(행높이, 44) + paddingBottom 12` →
ING/RCP/ORD = **64 / 88 / 111**, SALES·MY 열 = 28+4+20 = 52 → **72**(= `subtitleMinHeight`), `insets+72` = **96 / 119**. 15건 전부 manifest와 일치한다. R1에서 틀렸던 94/117이 96/119로 교정된 것이 safe-area가 실제 provider 경로를 탔다는 결정적 증거다.

## 1) R1 Major/Minor 완료 여부

**M1 완료** — `three-surface-p0-check.mjs:124-131,291`이 `activeThresholds` 상수와 baseline `thresholds`를 deep-equal로 검사하고 `stage='P2'`를 요구한다. sync-check `validateP2Thresholds`와의 상호 배제가 해소됐다.

**M2 완료** — 제품 변경(`663adc6`)과 rebaseline(`43b8d6e`→`2a73bb0`)이 분리됐다. freeze 기준이 새 `baselineCommit`이라 `baselineCommit..HEAD`가 공집합임을 직접 확인했다. product diff와 rebaseline을 섞지 않는다는 §6.7 규율을 그대로 적용했다.

**M3 완료** — 실제 `Pressable`이 `COMPONENT.hubHeader.actionTouchSize`(=`minTouchTarget`=44) 양축이고 내부 40dp `View`가 시각 상자를 분리 소유한다. 호출부 `hitSlop` prop이 제거돼 우회 경로 자체가 없어졌다. dot이 내부 40dp 상자 기준이라 아이콘 대비 위치가 보존된 것도 확인했다.

**M4 완료** — 세 게이트를 재측정하고 `outputSha256`·`lineCount`·`failureLines`·`failures`·`regressionBacklog`를 함께 갱신했다. TOUCH-EXACT는 exitCode 0 / 실패선 0으로 전환돼 P0의 `successorContract`("P2/P3 refreshed touch inventory")가 실제로 이행됐다.

**M5 완료** — `compareResponsiveChecks()`가 10필드 양방향 완전 비교를 하고 capture가 이를 호출한다(`three-surface-visual-capture.mjs:188`). 정적 쪽도 `safeTop` 모드 일치와 6개 카운터 0을 단언한다.

Minor 8건(m1~m8)도 전부 반영됐다. 특히 m5는 부제 `TYPE.caption.lineHeight`(20) 일체화, 아이콘 `iconSize.lg`(24) 단일화, dot의 `COMPONENT.hubHeader.notificationDot.*` 이동으로 3계층 경로를 회복했다.

## 2) safe-area·영어·2x·이탈/겹침 충분성

`capture.mjs:119-120`이 CDP `Emulation.setSafeAreaInsetsOverride`로 실제 inset을 주입하고, `:169`가 렌더된 `paddingTop`을 되읽어 `:180`이 주입값과 같은지 **왕복 단언**한다. DOM padding 조작이 아니므로 `useSafeAreaInsets` → `minHeight: insets.top + 72` 경로가 실제로 통과한다. 기록값 96/119가 이를 뒷받침한다.

영어는 제목·부제 모두 치환한다(`:130-131`). 다만 여전히 앱 현지화가 아니라 DOM `textContent` 교체이며, manifest `responsiveScope`가 이를 명시한다 — 선언된 범위 안이라 수용 가능하되 앱 i18n 검증은 아니다.

2x는 `setProperty(..., 'important')`로 적용한 뒤 2 rAF 후 계산값을 되읽어 오차 0.01 이내를 요구한다(`textScaleMismatches`). R1에서 지적한 `NaN` 무음 실패는 `nonNumericLineHeights`로 **경성 실패**가 됐다. 수평(`escapees`)·수직(`verticalEscapees`)·텍스트×버튼 겹침(`overlaps`)을 모두 측정하고 0을 단언한다. 충분하다.

## 3) HubHeaderAction 계약의 fail-open 여부 — 아니다, 이중으로 막힌다

`touch-target-audit.mjs`의 `componentContracts`가 `width/height: COMPONENT.hubHeader.actionTouchSize` 직접 적용과 `hitSlop` 미수용을 요구하고, 음성시험 3건(hitSlop 우회 / 40dp 토큰 사용 / 정상)이 붙었다. 여기에 더해 `tokenNumericLiteral`에 Identifier 분기가 추가돼 `actionTouchSize: minTouchTarget`이 44로 풀리므로, 일반 row 스캔이 이 Pressable을 44×44 **통과**로 판정한다. 만약 누군가 실제 Pressable을 40dp로 되돌리면 `40 < 44`로 "새 미달"이 나 별도로 FAIL한다. 문자열 매칭이 취약하긴 하나 fail-open은 아니다.

## 4) 증거·data plane 결속

캡처가 헤더 전용으로 좁혀졌다(PNG 64KB→2.5KB, tree 1802B→10B). `dataPlane.{captureScope, bodyStateExcluded, startCommand}`가 manifest에 결속되고 음성시험이 붙었다. before/after tree blob이 5화면 모두 동일하고 `treeChanged → 무조건 실패` 계약이 유지된다. 반응형 20건은 capture 실행 시 키별 완전 대조된다.

## 5) rebaseline migration 검증

`validateMigration`이 `baselineAt(decisionCommit)`으로 **Git에서 이전 baseline을 다시 읽어** `failureLineDelta`를 재계산하고 JSON 기재값과 비교한다. `previousBaselineBlob`도 `git rev-parse`로 재도출한다. 자기 서술이 아니라 이력 결속이다. 음성시험(`badDelta`)도 추가돼 P0 음성 계약이 17→18로 늘었다. JSON 실제 값도 대조했다 — `previousRegression 768 → nextRegression 708`, delta의 S4 순증 6줄이 전부 값의 `COMPONENT.hubHeader` 이동에서 나온 것임을 확인했다.

## 6) alias·gitattributes·CI

`pathAliases()`가 `baseUrl ?? pathsBasePath`(TypeScript와 동일 우선순위)로 바뀌고 `tsconfig.base.json`의 wildcard alias를 두 번째 source로 병합한다 — R1 m6·m7 동시 해소. `.gitattributes`는 디렉터리 catchall `-text -diff` 뒤에 `*.txt`만 LF 예외를 두어 미지정 확장자 공백이 없다. `verify.mjs:121-127`에 P0 기준선·sync·시각 manifest·byte artifact 네 결정론적 검사가 필수로 연결됐고 기획안 §10에 기록됐다.

## 7) 잔여 위험 (차단 아님)

1. **`MyTaxScreen.tsx`** — pilot 5화면 밖의 유일한 제품 변경. `QueryState`가 `<>{children}</>`(`QueryState.tsx:95`)라 실제 부모는 `gap: 12`인 ScrollView contentContainer였는데, 감사기는 fragment 너머를 못 봐 gap 0으로 읽었다. 수정은 정적 값을 8로 만들었고 **실제 간격은 12 → 8로 좁아졌다**. 44dp·중첩 계약은 전후 모두 만족하고 세부실행서에 명시됐지만 시각 증거는 없다. 소유자가 비-pilot 제품 편집을 P2 범위 밖으로 본다면 되돌릴 대상은 이 한 곳이다.
2. `headerHeight`는 capture를 돌릴 때만 완전 비교된다. `verify`가 도는 정적 검사 단독으로는 `>0`만 본다(`safeTop`·6카운터는 정적 단언이라 위조 면적은 크게 줄었다).
3. tree 증거가 헤더 전용 **가시 텍스트**다. 본문 변화와 `accessibilityLabel` 변화는 이 게이트 밖이며 `hubHeader.test.tsx`가 label을 대신 덮는다. P3는 본문을 바꾸므로 재확장이 필요하다.
4. `actions={<>…</>}`처럼 JSX 속성에 실린 형제는 중첩 분석 대상이 아니다. 지금은 `HubHeaderAction`에 `hitSlop`이 없어 위험 0이지만 P3에서 슬롯형 공용 컴포넌트가 늘면 재검토 대상이다.
5. `--update-side`는 compare 실패 시에도 manifest를 갱신한다.
6. 시각 manifest의 `approval.decisionCommit`은 40-hex 정규식만 검사한다(p0-check은 ancestor까지 검사).

새 회귀나 과도한 승인 범위는 1번 외에 없다. 승인 prop은 실제 변화와 일치한다 — `actions.touchTarget`·`actions.iconSize`는 액션이 있는 4화면에만, `actions.alignSelf`는 SALES에만, `subtitle.marginTop`은 MY에만 붙어 있다.

## verify S4 잔여의 처리 경계

- `scripts/verify.mjs:127`의 `design-token-s4-check.mjs`가 exit 1(54 실패선)이라 `pnpm verify --no-db` ③은 FAIL이다. `S3A-EXACT`는 verify 경로에 없다.
- **P2 차단이 아니다.** ① baseline `41b8b5e`에서 이미 exit 1(49줄)인 선행 조건이고, ② 계약 파일을 하나도 완화하지 않았으며, ③ 출력·선별 분류·backlog·old/new 차집합이 `663adc60`에 결속돼 p0-check가 재도출·대조한다. P2는 오히려 verify③의 적색 면적을 줄였다 — TOUCH-EXACT가 68줄에서 **0줄**로 통과 전환됐다.
- 순증 6줄은 전부 값이 화면에서 `COMPONENT.hubHeader`로 **이동**한 결과다(`paddingTop:space.sm` ×4, `marginTop:space.xs 7<8`, `borderRadius:radius.full`). `design-token-s4-check`의 파일별 개수 계약이 공용 컴포넌트 소유권을 모델링하지 못한다.
- **다만 병합과 P3 착수의 차단 요인이다.** `verify --no-db`가 `protected-gate`의 유일한 입력이라 이 SHA에는 gate가 붙지 않는다. P3는 배치마다 같은 hoisting을 반복하므로 실패가 선형 증가한다.
- 경계: **P3 배치 1 착수 전에 S4를 독립 결정으로 해소한다.** 파일별 개수 계약에 "값이 `COMPONENT.*`로 이동한 경우"의 승계 규칙을 넣거나 게이트 범위를 재정의하고, 그 결정을 별도 rebaseline commit에 봉인한다. 그 전까지 어떤 문서·보고도 "verify 통과"로 쓰지 않는다(AGENTS.md §검사 실행).

## P3 진입 가능 여부

§6 완료조건의 "P2 exact SHA 독립검수 PASS"는 이 R2로 충족됐다. 그러나 **지금 P3를 열 수는 없다.** AGENTS.md는 R2·R3와 운영 게이트에 Fable 복구 표본 재감사 **또는** exact SHA `3386262`에 결속된 사람의 명시적 위험 수용 중 하나를 더 요구한다. Opus 승계만으로는 R0·R1까지다.

P3 착수 선행 조건은 셋이다 — (a) Fable 재감사 또는 사람의 명시적 위험 수용, (b) S4 잔여 해소, (c) 잔여 위험 3·4번(본문 증거 범위, 슬롯형 형제 분석)의 P3 범위 재확장 결정.

세부실행서가 상태를 "P2 Opus R1 CHANGES_REQUIRED 반영 중, 재검수 대기"로 낮추고 R1 Finding 원문을 byte 결속된 `opus-direct-advisory-r1.md`에 보존한 것은 정확한 처리다. 이 R2 기록도 같은 규약으로 `opus-direct-advisory-r2.md`에 남기고 byte-artifacts에 결속하기를 권한다 — 그 반영은 실행하지 않았다.
