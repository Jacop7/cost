# 이전 입고 확인이 새 입고를 막는 오류 — 2026-09-14

## 원인과 수정

재고 수정의 입고 화면이 브라우저에 남은 9월 11일 미확인 요청을 발견하면 현재 입력 대신 이전 입고 확인을 요구했다. 서버 기록 유무를 확인하지 않고 임시 요청을 계속 유지하는 복구 흐름이 원인이었다. AppMap 팝업 연결 오류가 아니다.

`20260914000007_quick_inbound_resolution.sql`은 `resolve_quick_inbound`를 추가한다. 입고와 같은 매장·요청 키 잠금 안에서 기존 원장이 있으면 `recorded`를 반환하고, 없으면 요청 키를 종료해 뒤늦은 원래 요청을 거절한다. 확인은 재고·입고 원장을 추가하거나 삭제하지 않는다. 종료 요청 표는 앱의 직접 쓰기를 허용하지 않고 소유 매장 RPC로만 접근한다.

앱은 화면 진입과 미확인 응답 뒤에 결과를 자동 확인하고, 정확히 일치하는 임시 요청만 정리한다. 현재 입력과 새로운 요청 키를 사용하므로 같은 수량·금액의 별도 입고를 허용한다. 서버 확인이 실패하면 사유와 임시 정보를 보존하고 결과 재조회만 제공한다. 과거 입력의 자동·수동 재전송 경로를 제거했다. 이미 기록된 요청은 원 입고일과 함께 반영됐다는 토스트를 표시한다.

## 로컬 적용·실제 화면

- 실제 로컬 Supabase에 00007만 전진 적용하고 DB 타입을 재생성했다. 원격 배포는 하지 않았다.
- 대파의 오래된 요청은 서버 입고 원장에 없음을 확인했다. 자동 확인으로 그 키만 종료됐고 이전 안내가 사라졌다.
- AppMap 실제 Expo에서 현재 입력 123g의 `재고를 입고할까요?` 확인창이 열리는 것을 확인하고 취소했다. 검증 중 실제 입고를 제출하지 않았고 표시 재고 4.6kg는 유지됐다.

## 실행 증거

| 검사 | 결과·로그 |
|---|---|
| 새 DB 전체 migration·SQL 스위트 | 102/102 · `.codex/inbound-resolution-db.log` |
| 관련 앱·임시 요청 저장 시험 | 최종 78/78 · `.codex/inbound-resolution-mobile-v3.log` |
| 최종 앱 전체 시험 | 130파일·1,458통과·DB 전용 4개 제외 · `.codex/inbound-resolution-mobile-all-final.log` |
| 실제 2세션 경합 | 입고 우선/확인 우선 모두 PASS · `.codex/inbound-resolution-concurrency.log` |
| DB 타입 생성·앱 타입 | PASS · `.codex/inbound-resolution-types.log`, `.codex/inbound-resolution-typecheck-final.log`, 같은 이름의 `.result.json` exitCode 0 |
| 실제 DB ACL·실행자 권한 | metric 22개·모바일 RPC 85개·예외 2개 PASS · `.codex/inbound-resolution-acl-db.log` |
| ACL 셸 보안 회귀 | PASS · `.codex/inbound-resolution-acl-shell.log` |
| 소스 터치 감사 | 미달 0·중첩 위험 0, 기존 미판정 목록의 줄 이동 갱신 후 PASS · `.codex/inbound-resolution-touch-check-v2.log` |
| 터치 검사기 회귀 | 최종 66/66 · `.codex/inbound-resolution-touch-tests-v2.log`. 최초 같은 호출에 DB 식별자 인자를 빠뜨린 감사 1건은 실패 보존 후 올바른 fresh DB 인자로 재실행해 통과 |
| 기록된 키의 다른 재료 조회 거절 | 추가 반례 포함 1/1 SQL 파일 통과 · `.codex/inbound-resolution-db-v2.log` |

전체 `corepack pnpm verify`는 격리 컨테이너에서 6단계를 모두 실행하고 종료했다. ① 타입, ② core 269개·당시 앱 1,455개·DB 102개, ④ 새 DB 102개·메뉴 DB 왕복 12개·DB locale parity 13개, ⑤ 업그레이드 26/26, ⑥ 최종 웹 번들이 통과했다. 업그레이드는 2,103.7초가 소요됐다. ③의 최초 ACL 함수 수 및 터치 입력 결속 실패는 보완 후 개별 재검사했다. 최종 앱 1,458개와 타입·터치 검사도 별도 재실행해 통과했다.

최초 전체 실행은 ③ 실패로 exitCode 1이며 원본을 보존한다: `.codex/inbound-resolution-verify/verify.log`, `result.json`. clean commit에 묶이는 세 표면 바이트 증빙과 네이티브 advisory 4건은 기존 미완료이며 전체 6/6 PASS로 표현하지 않는다. 신규 입고 경합 실행의 verify 편입은 실행기 시작 이후 변경돼 이번에는 별도 실행 증거로 보존한다.

## 독립 검토

사용자가 지정한 Claude 앱 작업 대화에서 UI 모델 `Fable 5.1 중간`을 관측했다. 로컬 기기 브리지 연결 실패로 첫 요청은 미검증이었다. 이후 SHA256·원본 줄 번호가 포함된 소스 원문을 첨부해 읽기 전용 검토를 요청했다. 입력은 `.codex/inbound-resolution-review.txt`에 보존했다. 브라우저 검토는 정식 Fable protocol 승인이나 실행 시험 대체가 아니다.

- P1: 조회 실패 전체에서 예전 payload를 재전송하던 수동 복구 경로를 지적했다. `onSave`의 replay 인자·분기를 제거하고 오류 시 요청 보존/사유 표시만 남겼다. SQLSTATE 22000·42501·P0002와 네트워크 오류 4종에서 재전송 0을 단언한다.
- P2-1: recorded 결과를 알리는 원 입고일 토스트를 추가했다.
- P2-2: 실제 로컬 `pg_get_functiondef`를 제공해 writer가 business 잠금→요청 키 잠금 순서임을 대조했다. 역순 교착 지적은 해소됐다.
- P2-3: `_prelude.sql`의 NO BYPASSRLS executor+JWT 실행 조건을 제공하고 기록된 키+다른 재료 22000 반례를 추가했다.
- P2-4: 결과 조회 중 journal 부재를 확인하면 복구창·오류를 닫는다. 이전 탭의 늦은 거절 사유 표시는 유지한다.
- `.codex/inbound-resolution-review-v2.txt` 재검토에서 P1 및 P2 4건 해소 답변을 받았다. 첨부 hash는 저장소와 직접 대조하지 못했고 시험은 보고 수치로 구분했다.
- 비차단 P3 관찰: 자동 확인 실패 시 원래 저장 오류를 우선 표시한다. 다른 웹 탭이 먼저 journal을 정리하면 원래 탭의 보수적인 정리 실패 안내가 남을 수 있다. 이 경우 서버 원장은 한 건이며 원장 손실/중복으로 판정하지 않았다. 원문 확인용 재조회 버튼은 재전송하지 않는다.

최종 소스 16개 SHA256은 `INBOUND-REQUEST-RESOLUTION-20260914-inputs.json`에 결속했다. 별도 기능 시험용 `fresh_inbound_resolution_20260914` DB와 전체 verify 전용 `costkeep-inbound-resolution-20260914` 컨테이너는 완료 뒤 정리했다. 실제 `supabase_db_costkeep`는 healthy이며 앱·AppMap 서버를 유지했다. 커밋·푸시·원격 배포는 수행하지 않았다.
