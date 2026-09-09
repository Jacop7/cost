# 식재료 0195 마이그레이션 앵커 검증 보강

## 범위와 기준

- 사용자 요청: 재부팅 후 작업·검수 자동 진행. 기준 `6fcf46c81908263c3ce727c2539cdc52271a19c3`.
- 공식 루트 `C:/Users/jacop/프로젝트/식자재관리앱`, `codex/ingredient-write-integrity-review`.
- 기존 다른 브랜치의 추적 수정25개 및 전환 충돌 미추적80개를 stash `d8588ff06c5d70a33308d91375a3f067a2fc1a1f`에 보존했다. 별도 미추적 파일과 실행 중 Expo 작업본은 건드리지 않았다. stash는 작업 종료 후 기존 브랜치에서 복원하고 삭제하지 않는다.
- 새 모델 계획/유료 검수/승인/배포를 생성하지 않았다. 기존 검수 브랜치 모델 계획 SHA `3cdd981be409540bdfaa2de424d1718a888924c4033e9385f9ebfbb25e318f08` 검증 성공.

## 검수 후속 판정

사용자 지정 Claude ‘앱 작업’ 직접 Cowork 검수 후속 답변을 확인했다. 정식 Fable 게이트의 대체가 아니다.

- P1-1 유지: 문자열 치환이 불발해도 성공하는 잠재 위험. 실제 로컬 장애가 재현됐다는 주장은 철회됨.
- P1-2는 P2 문서 표현으로 낮춤. 구매 옵션의 `volume`은 이미 정규화된 기준단위 값이며 `base_unit` 생략은 기존 RPC 호환성. 필수화 권고 철회.
- P1-3 차감/폐기 수정내역 갱신 결함은 철회. entity_change_events에 실제 기록한다는 경로가 확인되지 않은 비대칭만으로 결함 판정하지 않음.
- P2-1 차감 라벨 지적 철회. Codex 추가 확인: IngredientDetailScreen과 StockHistoryScreen 모두 `toLedgerView`를 사용하며 음수 stocktake를 ‘차감’으로 표시.
- 기존 검수자의 추출 트리 시험은 공식 검수 입력에서 제외, 참고 관측으로만 남김. 후속 답변은 기기 셸 연결 문제로 새 git show를 실행하지 못했다는 제한을 명시했다.

## 변경

0195는 운영·스테이징 미적용이며 로컬 개발 DB에만 적용된 파일이다. 이번 수정은 원격 첫 적용 전에 실행할 사전 검증 강화이며 기존 계산/저장/ACL/RPC 서명은 변경하지 않는다. 배포된 migration을 소급 편집하는 처분이 아니고, 기존 로컬 DB에는 재적용하지 않았다.

- 문자열 치환 대상10곳이 정확히 한 번 있어야만 함수 재정의 진행. 누락과 중복 모두 예외 처리.
- save_ingredient의 Windows CRLF를 먼저 정규화하고 구매 가격 INSERT 값 앵커까지 검사. 종전 중복 replace 제거.
- discard 함수 서명 정규식도 정확히 한 번 매칭돼야 함.
- 원격 적용 전에 migration 전체 트랜잭션이 실패하도록 하며 기존 데이터/함수 일부만 적용된 상태를 남기지 않음.
- ARCHITECTURE에 구매 옵션의 정규화된 volume 및 선택적 base_unit 대조 계약을 명확히 추가. 기존 증거 원문은 덮어쓰지 않음.
- 업그레이드 게이트에 24번째 시나리오 추가. 전체 게이트를 통과했다는 뜻은 아님.

## 확인한 실행 증거

공식 루트에서 `fresh-db.sh --until 20260909000194 fresh_ing_anchor_20260910`으로 전체 과거 migration과 seed를 적용한 격리 DB를 준비했다. 이후:

`node packages/db/tests/ingredient-migration-anchors.mjs fresh_ing_anchor_20260910`

**22/22 PASS**: 열 개 앵커의 missing/duplicate 각20건, 정상 LF/CRLF2건. 각 오염 본문이 유효한 PL/pgSQL로 생성되는지 먼저 확인해 syntax error를 가드 성공으로 오인하지 않는다. 예상 함수별 앵커 예외를 검사하고, 매 회차 rollback 뒤 공개 함수 정의 해시·원장 건수·0195 스키마 부재가 동일한지 확인했다. 정상 적용에서는 입고 payload 보호와 폐기 note 주입을 확인한다.

- `node --check packages/db/tests/ingredient-migration-anchors.mjs`: PASS.
- `git diff --check`: PASS.
- 기존 개발 DB inventory_events: 865건 유지. 원장 수정·DB reset·원격 DB 적용 없음.

## 남은 검사

이 문서 시점에는 새 커밋에서 전체 verify를 실행하기 전이다. fresh DB 전체54파일, 경합, 24개 업그레이드 경로, 전체 verify6단계와 기존 화면 동결/byte artifact/시각 계약 정합성 및 정식 독립검수는 후속 실행 결과로 별도 판정한다. 22개 국소 시험을 전체 승인으로 확대하지 않는다.
