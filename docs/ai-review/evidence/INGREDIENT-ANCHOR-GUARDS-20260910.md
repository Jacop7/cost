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

## 후속 실행 결과 — 879d025, 2026-09-10

원본 실행 전 기록은 유지하고 결과를 추가한다. `879d025e8aa017c68f8c3bda35d1226f39b49af0`를 공식 루트에서 고정한 채 전체 `corepack pnpm verify`를 실행했으며 실행 도중 추적 소스를 변경하지 않았다.

| 단계 | 로컬 결과 | 같은 SHA 원격 CI 결과 |
| --- | --- | --- |
| ① 타입 | PASS | PASS |
| ② core·DB·mobile | PASS | PASS |
| ③ CLI·문서·디자인 계약 | FAIL: 첫 P0 제품 변경 동결 검사 | FAIL: 첫 P0 제품 변경 동결 검사 |
| ④ 새 DB·경합·locale | FAIL: 일반 경합 B←A 관찰 0/600 | PASS |
| ⑤ 업그레이드 | 24/24 PASS | 24/24 PASS |
| ⑥ 웹 번들 | PASS | PASS |

로컬②: core208 PASS/12 SKIP, DB54파일 PASS, mobile79파일771시험 PASS. ④의 DB54파일도 통과했다. 일반 경합에서 판매15건·크론 응답·원장 합계·마감 직렬화는 통과했지만 B가 A를 기다리는 쌍 관찰 단언 하나가 실패해 뒤의 식재료 경합/locale는 full run 안에서 실행되지 않았다. 로컬 전체 결과는 **4/6**, 원격은 **5/6**이며 전체 승인 아님.

별도 `fresh_ing_integrity_20260910`에서 생략된 식재료 경합8시나리오(실제 잠금 대기·원장 합계·입고 건수)와 locale/international DB parity13시험을 실행해 PASS했다. 일반 경합 별도 재실행도 PASS했지만 최초 실패는 철회하지 않는다. 새 앵커22시험은 로컬/원격 전체 업그레이드24번째 경로에서도 PASS했다.

원격 원본: [CI run34404478871](https://github.com/Jacop7/cost/actions/runs/34404478871), full-db job102644036640. Node20.19.4/24 fast job 및 protected-gate도 실패했다. 임시 CI 실행이 제품 독립검수·사람 승인을 대신하지 않는다.

## 경합 관찰 보강

`concurrency.mjs`의 관찰자와 준비 장벽은 하나의 DO 트랜잭션에서 pg_stat_activity를 반복 읽지만 통계 snapshot을 갱신하지 않았다. PostgreSQL의 [트랜잭션 내 통계 조회 계약](https://www.postgresql.org/docs/17/monitoring-stats.html#MONITORING-STATS-VIEWS)에 따르면 current-query 정보도 첫 snapshot을 재사용한다.

격리 DB에서 세 psql 세션으로 기존 관찰자와 같은 `pg_stat_activity` 자기 join + `pg_blocking_pids` 쿼리를 재현했다. B 접속 전 pair0 → 실제 B가 A의 advisory lock을 기다리는 동안 cached pair0 → `pg_stat_clear_snapshot()` 후 pair1. 세 세션 모두 exit0이며 세션 잠금 해제/ROLLBACK 뒤 영구 데이터 변경 없음. 이 진단은 실패 당시 세션을 소급 관측한 증거가 아니라 잘못된0을 만들 수 있는 경로의 재현이다.

전체879d025 실행이 끝난 뒤에만 두 polling 루프에 `pg_stat_clear_snapshot()`을 추가했다. 쌍 단언·판매 수·원장 검산·타임아웃을 삭제/완화하지 않는다. 이 보강은 시험 코드 변경이며 제품 RPC/원장을 바꾸지 않는다. 보강 후 실행은 아래 추가 기록으로 구분한다.

## 별도 게이트 진단과 남은 승인

- sync PASS: 화면65/route55/prototype185/orphan0.
- visual-diff PASS는 기존5화면·responsive20/20 증거 범위이며 전체185target 검수 아님.
- byte artifact FAIL: content hash6개 불일치 + 미등록177개. 미등록177개 모두 Git 추적 파일이며 사용자 미추적 파일 때문이 아님.
- S3a/S4/touch FAIL: 현재 제품과 이전 승인 계약 불일치.
- CLI contract/deploy guard/ACL source scan/CI contract/protected gate validator/GitHub ruleset/ops monitoring 시험 각각 exit0. ACL shell PASS. verify-shell·docs-graph 단위시험33/33 PASS.
- 실제 docs-graph --activation은 `MISSING_REGISTRY: chat-context-registry:v1`. HEAD의 ROLE_CONTEXTS.md 자체에 marker가 없다. 승인 레지스트리를 임의 생성하지 않았다.
- 정식 Fable 독립검수·시각 변경 승인 정합성은 미완료. 유료 호출, main 병합, 운영/스테이징 DB 적용 없음.

## 로컬 실행 로그 결속

로그는 `.codex/reboot-backups/20260909-225110/`에 보존한다. 원본 백업 해시 대상은 변경하지 않았다.

| 파일 | SHA-256 |
| --- | --- |
| verify-879d025-20260910.log | 7d5d9e444d92b3cd426a484a831fac1604b2fbc4c3c66f78ecc917153cf33957 |
| pg-stat-pair-diagnostic-20260910.log | 41cf6fa0082e4ec38ba454e8de581c31e7c7975331c376227bccf4437a444fbf |
| ingredient-concurrency-879d025.log | 62bd4b2e81f9fb1b1ee787002ed4dfec1aadda2192f1f4a7445b14ac2ae146a6 |
| locale-parity-879d025.log | d2149a3d7a9abd9206e179ef262cda6643e42feaf512a98891d0a7e0a1e41ce7 |

## 관찰 보강 후 국소 재검증

전체879d025 종료 뒤 새로 준비한 `fresh_ing_integrity_20260910`에서 보강된 `concurrency.mjs`를 실행해 PASS했다. B←A 쌍 관찰·판매15건·마감 경합·원장 합계·직렬화 단언 모두 유지/통과. `node --check`와 `git diff --check`도 PASS. 로그 `concurrency-snapshot-fix-20260910.log` SHA-256은 `857f93753d04e91d605981fba4c660a1194f76d2ffd4cb795a8618b27809b30d`.

이 국소 통과는 보강 커밋의 전체 verify6/6 증거가 아니다. 전체6단계 결과 표는879d025에만 결속되며 보강 커밋의 원격CI 결과와 정식검수는 후속 판정한다.
