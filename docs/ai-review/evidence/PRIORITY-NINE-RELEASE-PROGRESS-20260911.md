# 번역 제외 9항목 우선 복구 — 통합 진행

현재 상태: 구현 후보/통합 검수 중, 운영 미배포. 이 기록은 독립검수나 배포 승인을 대신하지 않는다.

## ROOT 직접 확인

- 추가 지출 상세 추가창·판본 충돌·종료 영업일 정정 경로: `salesExpenseConfirm.test.tsx` 7/7 PASS. 커밋 `16f9bcd`, 기능 브랜치 푸시 완료.
- ROOT 관련 회귀 재실행: 추가 지출7 + 부족 목록11 + 식재료 폼 충돌13 = 31/31 PASS. 존재하지 않는 salesPastEditScreen 시험 이름도 명령에 있었으므로 해당 화면 시험을 실행했다고 세지 않는다.
- mobile typecheck exit0. 신규 레시피 읽기 RPC 두 개는 임시 공용 타입 선언으로 통합했다. DB 타입 생성/실제 서버 설치 증거는 아니다.
- AppMap model15/15, samples15/15 PASS. 추가 지출 팝업은 상세 경로에서 열고, 새 읽기 RPC는 응답을 보존하며 샘플 쓰기 차단을 유지한다.
- Edge `localhost:8091/sales/expense?date=2026-09-07`에서 추가 버튼 활성·입력창 열림을 확인했다. 입력/저장/삭제하지 않았다. 당일 장부 미시작 상태는 버튼 비활성이다.
- Edge `/ingredients?stock=below-safety`에서 안전재고 안내와 고춧가루978g/안전1kg 항목을 확인했다. 레시피 탭을 거쳐 식재료 탭에 재진입하면 `/ingredients`로 바뀌고 필터 안내가 사라졌다. 실제 원장 값의 정확성을 별도 DB 감사한 것은 아니다.
- `verify --no-db`: 타입/시험(core·mobile)/웹 번들 통과,③ 실패, exit1. DB·업그레이드는 생략했다. P0 제품 변경 금지 검사 실패를 유지한다.
- 화면 동기화 PASS(65/55/185), 기존 시각 증거 검사 PASS(5화면); 현 후보 전체 시각검수 완료 아님. byte-artifacts 검사는 해시 불일치·미등록 산출물로 실패한다.
- `fable:check`는 설치/인증 정상만 확인했으며 독립검수 실행이 아니다.

## 남은 필수 조건

레시피 최소 권장가 SQL 자체검수/격리 DB 실행,0202~0204 실제 계약 검증,공용 ACL/DB회귀 통합,변경분 독립검수,정식 P3 승계와 산출물 byte 결속,동일 SHA 전체 CI,환경 배포 가드가 남는다. 공유 DB에 fresh migration을 재생하는 제안은 전역 role 영향 때문에 거부하고 별도 컨테이너 계획으로 수정 요청했다. 기존 데이터/실패 증거는 삭제하지 않았다.

식재료 제출은 `.codex/ingredient-44-study/ingredient-connection-result-20260911.json`, 레시피 후보는 `.codex/recipe-study/draft-preview-resume-v1-20260911/`를 참조한다. 후속 레시피 수정은 새 입력 해시로 검증해야 한다.
