# 전체 페이지 UI 가이드 적용본 검수 장부

- 적용본: `full-page-flow-prototype-ui-applied.html`
- 보존 원본: `full-page-flow-prototype.html`
- 작업 시작 원본 SHA-256: `9B538CE9ACD1D93AA75845EB1851391B8EB4C5732DF7094214E8AC5662428414`
- 검수 범위: 활성 화면 61개 + 활성 popup/state host 123개 = 약 184개 host 단위
- 고유 popup/state ID: 97개
- 숨김 유지: `discard_type`, `discard_period` 2개. 삭제하지 않고 활성 계약에서 제외한다.
- 실제 Expo 앱 수정: 없음

## 판정 규칙

각 화면은 아래 7개 항목을 모두 확인한 뒤에만 `PASS`로 바꾼다.

1. 구조: Header / Content / Page StickyAction / BottomTab의 소유권과 겹침
2. 요소: 병합 요소 사용, Card·RowGroup·Field·Result의 의미 분리
3. 상태: 기본·빈 상태·선택·오류·확인·완료 상태
4. 상호작용: 버튼·필터·뒤로가기·바깥 닫기·Escape·포커스 복귀
5. PC: 기본 데스크톱 viewport에서 카탈로그와 phone frame 확인
6. 모바일: 390×844, 이후 320px·큰 글꼴·키보드·safe area 추가 확인
7. 맥락: 이전·다음 페이지와 같은 정보 구조와 용어를 유지

상태 코드는 `TODO / COMMON / CODEX PASS / OPUS PASS / PASS / BLOCKED`만 사용한다.

## 공통 적용 1차

| 항목 | 구현 | Codex | Opus | 상태 |
|---|---|---|---|---|
| 원본 보존 | 별도 적용본 생성, 시작 SHA 기록 | PASS | 승인 가능 | PASS |
| 토큰 | 색·텍스트·선·간격·라운드·그림자·높이·터치 크기 | PASS | 긍정 | PASS |
| 병합 요소 | Card, RowGroup, Field, Result, Badge, Control, Layer, StickyAction | PASS | 긍정 | PASS |
| 의미 분리 | Field↔Result, Card↔선택행, Page StickyAction↔LayerFooter 분리 | PASS | 긍정 | PASS |
| popup 계약 | 활성 고유 ID 97/97 명시 등록 | PASS | 등록 확인, 런타임 전수검수 필요 | COMMON |
| popup 유형 | PageState / Picker / Form / Info / Action / Confirm / Success / Error / Popover | PASS | 긍정 | COMMON |
| 닫기 정책 | Confirm·Error 바깥 닫기 차단 | 샘플 PASS | 나머지 미검증 | COMMON |
| 접근성 | Confirm `alertdialog`, 제목 연결, focus-visible | 샘플 PASS | trap·focus 복귀 미검증 | COMMON |
| 반응형 | PC + 390×844 샘플 렌더 | 샘플 PASS | 320px·큰 글꼴·키보드 필요 | COMMON |

### Codex 1차 판정

`CONDITIONAL` — 공통 시각 언어와 명시적 popup 계약은 적용됐다. 식재료 메인, 정렬 PickerSheet,
입고 ConfirmDialog를 PC·모바일에서 확인했다. 전체 화면별 검수 전이므로 최종 승인은 보류한다.

### Claude Opus 1차 교차검수

`CONDITIONAL` — 원본 보존, 토큰 단일화, 의미 단위 병합, popup ID별 계약, 중앙 확인창 접근성은
승인 가능하다. 다만 97개 계약 중 샘플 3개만 런타임 확인되어 최종 PASS는 보류한다.

Opus가 지정한 후속 위험은 다음과 같다.

- Layer와 StickyAction의 z-index·스크롤 잠금 회귀
- 공통 토큰이 의도된 예외 강조를 덮는지 여부
- 320px·큰 글꼴·노치·키보드 환경
- Confirm/Error의 Escape·포커스 trap·복귀
- Notice·Badge 색 대비
- 뒤로가기 뒤 PageState 잔존

## 도메인별 진행표

| 도메인 | 화면 | popup/state host | 공통 | 화면별 Codex | 화면별 Opus | PC | 모바일 | 최종 |
|---|---:|---:|---|---|---|---|---|---|
| 식재료 | 12 | 26 | 적용 | TODO | TODO | 샘플만 | 샘플만 | TODO |
| 레시피 | 14 | 26 | 적용 | TODO | TODO | 미검수 | 미검수 | TODO |
| 발주 | 4 | 13 | 적용 | TODO | TODO | 미검수 | 미검수 | TODO |
| 매출관리 | 15 | 28 | 적용 | TODO | TODO | 미검수 | 미검수 | TODO |
| MY | 16 | 30 | 적용 | TODO | TODO | 미검수 | 미검수 | TODO |

도메인 수치의 합계는 popup/state의 host 중복을 포함한다. 고유 계약 완전성은 별도의 97/97로 검산한다.

## 페이지별 기록 형식

각 화면과 popup/state는 아래 한 줄 형식을 추가한다. 수정 전 문제, 수정 내용, 재검수 증거를 생략하지 않는다.

| target | 문제점 | 수정안·병합 요소 | Codex 검수 | Opus 검수 | PC | 모바일 | 맥락 | 상태 |
|---|---|---|---|---|---|---|---|---|

검수 중 다시 수정하면 이전 결론을 지우지 않고 같은 target 아래 `재검수 N`을 추가한다. 확정안 문서에는
마지막 PASS만 반영하고 이 장부에는 변경 과정을 남긴다.
