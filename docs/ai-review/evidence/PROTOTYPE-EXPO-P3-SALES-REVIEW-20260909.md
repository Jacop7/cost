# P3 매출관리 페이지·상태 검수 — 2026-09-09

## 권위와 범위

기존 Expo kit·3계층 tokens를 권위로 두고 prototype-current-spec §SALES-01의 정보 순서와
공용 행동을 비교한다. 실제 판매/영업전이/삭제/DB 쓰기는 실행하지 않는다.
발주 다음 도메인으로 진행하며 등록19 surface/43 binding/고유37 target은 완료 페이지 수가 아니다.
P3 전체·P4·native·full verify·공식 Fable/Opus는 이 내부 검수로 종결하지 않는다.

## SALES-01 메뉴 목록 — c4610f4

- before: `841601f51e7085ae44f55a20e4bad925615bf118`
- 제품: `c4610f466e2735818949146a1597e799a17e6da4`
- 변경: SalesHomeScreen.tsx, 실제 host 시험 salesHomeParity.test.tsx.
- 320px/글자2배 before의 `순두부찌개`가 `순두부…`로 생략되고 판매가·재료비가 좁은
  왼쪽 열에 세로로 몰렸다. width<=320 또는 fontScale>1에서 설명을 위, 수량/판매를
  아래 행동행으로 배치했다. 정상390/1은 기존 가로 배치다. 긴 이름 clamp만 풀고
  배지 wrap과 narrow 행동행 wrap을 허용한다. 글꼴·크기·굵기·색·아이콘은 기존 token/kit 그대로다.
- soldBy·basisMap·정렬·openMenu·save·서버 날짜·부족/판매중지 판정은 변경하지 않았다.
- 실제 host6/6·type PASS: 390/320/fontScale2 배치, 장문, 오늘 장부 판매가로 계산된 금액,
  다음 영업일 안내, 수량/판매 양쪽 진입과 닫기 no-save, 실제 SortSheet와 오늘 장부 profit 정렬,
  재료 부족은 판매 가능·사용자 판매 중지만 차단을 확인한다. BusinessDayBar와 도메인
  조회/변경 훅·native Modal은 격리했다. 영업 전이나 실제 판매 저장의 시험으로 확대하지 않는다.
- 최종 전체 mobile: **61파일600/600 PASS + typecheck PASS**. full verify6/6 뜻 아님.
- Sol 독립 읽기전용: 지정 diff/host/전후 시각 검수 요청, 결과 대기.

## 보존된 웹 before/after

`scripts/three-surface-sales-capture.mjs`는 실제 Expo `/sales`를 열고 명시된 local 읽기RPC
응답과 request의 비밀 아닌 매장/날짜 필드만 보존한다. auth 응답/토큰/storage는 읽거나
보존하지 않는다. 알 수 없는RPC·nonlocal 네트워크·save/add/delete/영업전이는 차단한다.
기타매출/지출의 입력 초안만 채우고 추가 버튼은 스크롤 앵커로만 사용한다.

| 폴더 (`docs/prototypes/three-surface-p3-sales-visual/`) | source | 조건 | 결과 |
|---|---|---|---|
| before-20260909 | 841601f |5상태×390/320/320글자2배=15pass·33PNG | errors0·blocked0·documentOverflow0 |
| after-menu-20260909 | c4610f4 |같은15pass·33PNG | errors0·blocked0·documentOverflow0 |

PNG66/66 해시를 주 작업자가 재확인했다. PretendardApp400/500/600/700/800 명시load/check,
전체computed font-size/숫자line-height2배 단언을 실행했다. normal행간은 normal 그대로다.
before는841601f, after는c4610f4에서 Metro를 재시작했다. 실제 local 응답은 각 실행마다
보존됐고 데이터가 동일하다고 추정하지 않는다. 실제 화면에서390홈 기본배치와320글자2배
목록 끝의 전체 메뉴명·수량·판매 버튼 도달을 직접 비교했다.
정렬·판매수량·기타매출·지출 시트는 이번 변경의 비변경 대조/후속 문제 파악용이다.
Range box와 documentOverflow0은 조상 clipping·임의 긴 데이터·native/IME/실제탭의 증명이 아니다.

## 확인된 다음 배치 / 생략하지 않을 상태

1. BusinessDayBar의 작은 화면 큰글자에서 날짜가 `9..`로 잘린다. 공용 컴포넌트이므로
   소비처·기존 시험·공통 토큰 계약을 확인한 별도 배치로 수정/검수한다.
2. 판매수량/기타매출/지출의 고정 Sheet sub가 큰글자에서 본문 공간을 많이 차지한다.
   주문 시트처럼 동일 타이포의 스크롤 본문 이동을 검토한다. kit Sheet 자체는 임의로 바꾸지 않는다.
3. 기타매출 판매가/수량2열, 조리폐기 설명/Stepper, 합계 값은 더 긴 값에서 별도 검증한다.
   현재 수집은 local 한 메뉴·초안28000/1·지출15000 표본이며 전수 안전 판정이 아니다.
4. 확정안 §SALES-01의 기타매출/지출 중립 결과 표시와 `취소·추가`1:1 행동이 현재 화면에 없다.
   버튼 역할별 색/opacity와 기존 저장 payload를 유지하면서 공용 kit로 적용할 다음 배치다.
5. 영업 상태·브레이크/마감·부족 확인·revision 충돌·lateClose·오류/삭제 확인은 이번
   비쓰기 캡처로 검수 완료 처리하지 않는다. 격리 host/fixture부터 안전하게 확인한다.
