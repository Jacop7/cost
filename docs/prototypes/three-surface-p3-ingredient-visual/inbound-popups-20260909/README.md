# 재고 수정: 구매처 선택·입고 확인·입고 실패

2026-09-09 사용자 지적 반영. 실제 Expo `QuickInboundScreen`과 `/appmap`은 같은 컴포넌트를 사용한다.

- 기준: 권위 루트 `docs/prototypes/0_full-page-flow-prototype-ui-applied.html`의 재고 수정 팝업 탭 3개를 실제 클릭하여 캡처.
- `proto-stock_option.png` / `expo-stock_option.png`: 미선택·저장된 구매 링크, 하단 직접 입력/구매 링크 추가 2열.
- `proto-stock_confirm.png` / `expo-stock_confirm.png`: 중앙 확인창, 식재료/입고량 요약, 취소/입고.
- `proto-stock_error.png` / `expo-stock_error.png`: 중앙 실패 안내, 확인 1개.
- 데이터 차이: 프로토타입 고춧가루와 앱의 현재 선택 식재료 대파는 서로 다른 데이터다. AppMap 샘플은 구매 옵션 1건만 주입하므로 시트 높이는 2건인 프로토타입보다 낮다. 픽셀 완전 동일 판정이 아니다.
- 샘플 오류는 `quick_inbound`를 네트워크로 전달하지 않고 403으로 거절한다. 실제 E7/E1 저장·원장 변경 없음. 실제 데이터 모드에서는 실패 만들기 자동 실행 금지.
- 확인 열기·취소는 쓰기 없음. 실패 후 원래 입력 유지. 서버 오류 상세는 있는 경우 숨기지 않는다.
- 추가/수정 식재료와 구매 링크의 단위값은 공용 Select의 선택적 우측 정렬을 사용한다. 카테고리는 기본 좌측 정렬 유지.

검증: 타입 PASS, AppMap model/samples 22/22, 모바일 전체 67파일 682/682, 이후 추가한 Select 정렬 시험 포함 ingredientPickers 13/13, 실제 브라우저 3탭 열기·캡처 PASS. 전체 verify 6/6 또는 네이티브 실측·P3 전체 종결을 뜻하지 않는다.

Sol 내부 읽기 전용 교차검수: 한정 PASS, 치명·중대 Finding 없음. 별도 재실행 AppMap 22/22, 관련 모바일 5파일 102/102. 확인창 취소/중복 제출/실패 후 초안 보존, 원본 fetch 미호출, 삭제 ConfirmDialog 기본 계약 유지 확인. 외부 Fable/Opus 공식 검수 결과로 대체하지 않는다.
