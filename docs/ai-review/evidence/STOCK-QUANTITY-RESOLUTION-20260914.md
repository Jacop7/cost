# 차감·폐기 응답 유실·재진입 보완 — 2026-09-14

## 확인한 결함

실제 도메인 훅과 화면을 연결한 회귀시험에서 차감·폐기 각각 서버 성공 뒤 응답만 유실되면 1,000 → 900이 된 상태에서 화면 재진입 후 같은 입력이 새 키로 실행돼 800이 되는 반례를 재현했다. 최초 실패는 `.codex/stock-resolution-before.log`에 보존한다. 입고의 오래된 요청 안내와 별개의 요청 수명 문제다.

서버의 재고 충돌 코드는 40001인데 화면의 기존 복구 판정은 정확한 45009/REVISION_CONFLICT만 받았다. 기존 모사 시험이 실제 RPC와 다른 코드를 돌려 불필요한 추가 확인을 놓쳤다. 이번 통합 시험의 서버 모사를 실제 40001로 맞췄다.

## 변경

- `stockQuantityOperation.ts`: 사용자·매장·재료별 요청 키와 종류만 저장하고 전송 전에 저장 성공을 확인한다. 수량·사유는 저장하지 않는다. 응답 미확인 후 재진입·입력 변경·차감/폐기 전환에서도 이전 처리 결과만 조회하며 자동·수동 재전송하지 않는다.
- 웹은 Web Locks가 있을 때 같은 범위의 탭을 직렬화하며 네이티브는 SecureStore와 런타임 잠금을 사용한다. 처리 확인 실패·불완전 성공 응답·저장 공간 오류는 확인 정보를 보존하거나 쓰기 전에 거절한다.
- `resolve_stock_quantity`(00008): 기존 writer와 동일한 요청 잠금을 잡는다. 기록된 요청은 `recorded`; 없는 요청은 키를 종료하고 `not_recorded`. 늦은 writer는 45010으로 거절한다. 이 조회는 재고·원장에 쓰지 않는다.
- `useStockChange`: 실제 RPC 응답 경계의 명확한 거절 코드 40001·22000·45010·42501·P0002 및 정확한 revision 충돌에만 `stockQuantityRejected`를 붙인다. NETWORK/PGRST 등 미확인 오류는 이 판정을 받지 않는다. 코드가 있다는 이유만으로 확정 거절로 취급하지 않는다.
- 화면은 확정 거절 시 요청 키를 해제하고 최신 재고를 읽는다. 결과 조회 성공 시 이미 반영됨/미반영을 알리고 최신 재고를 읽으며, 새 처리는 사용자의 새 확인을 받는다. 일반적인 새로운 차감·폐기는 즉시 기존 경로로 저장한다.

## 실행 증거

최종 작업 트리 18개 파일의 SHA256은 [입력 목록](STOCK-QUANTITY-RESOLUTION-20260914-inputs.json)에 보존한다. 커밋/CI 증거와 구분한다.

| 검사 | 결과 |
|---|---|
| 최종 앱 전체 | 131파일·1,480통과·DB 전용 4개 제외, `.codex/stock-resolution-mobile-all-final.log` |
| 최초 오류 반례 → 보완 시험 | 차감/폐기 응답 유실·재진입 반례 통과, `.codex/stock-resolution-mobile-v4.log` |
| 실제 SQLSTATE·동일 화면 복구 | 5개 서버 거절 코드별 resolver 0회·새 키·최신 조회, `.codex/stock-resolution-conflict-v5.log` |
| 새 DB 전체 migration | `fresh_stock_resolution_20260914`, `.codex/stock-resolution-fresh.log` |
| 새 resolver SQL | 차감/폐기·이미 기록·미반영·늦은 호출·다른 재료/매장·ACL 통과, `.codex/stock-resolution-db.log` |
| 실제 2세션 경합 | 차감/폐기 × writer우선/확인우선 4가지, 실제 잠금 대기·원장 건수·재고 검증 통과, `.codex/stock-resolution-concurrency.log` |
| DB 타입·최종 앱 타입 | `.codex/stock-resolution-types.log`, `.codex/stock-resolution-typecheck-final.log` |
| ACL | 새 공개 함수 포함 88개 계약, `.codex/stock-resolution-acl.log` |
| 실제 REST 경계 | 새 resolver가 스키마에 노출되고 익명 호출은 HTTP 401/SQLSTATE 42501로 거절됨. 최초 검사기가 403을 기대해 실패했으나 인증되지 않은 요청의 정상 상태는 401임을 구분해 `.codex/stock-resolution-rest-acl.json` 원본과 `-interpreted.json`에 함께 기록. 로그인 사용자 실행은 별도 실제 DB authenticated 경합으로 검증 |
| 터치 검사 | 줄·제품 해시 이동 반영 후 감사 통과 및 검사기 66/66, `.codex/stock-resolution-touch-check-final.log`, `.codex/stock-resolution-touch-tests-final.log` |

전체 `pnpm verify`는 별도 네트워크 없는 tmpfs DB 컨테이너에서 6단계를 모두 실행하고 종료했다. ① 타입·② core/DB/mobile·④ 새 DB·⑤ 업그레이드 26/26·⑥ 웹 번들이 통과했다. ⑤는 2,008.8초, 최종 번들은 7.3초였다. ③ 최초 터치 검사 실패는 최종 재실행에서 해소했으나 커밋 연결 바이트 증빙 실패가 남아 전체 exitCode는 1이다. `.codex/stock-resolution-verify/verify.log`와 `result.json`을 최종 권위로 사용한다. 현재 문서는 전체 6/6 통과나 출시 승인을 뜻하지 않는다. 최종 공통 계약 재실행(`.codex/stock-resolution-contracts-final.log`)은 필수 실패가 `three-surface-byte-artifacts-check.mjs` 1개로 좁혀졌으며 터치 검사기 회귀 실패는 해소됐다. 네이티브 advisory 4건은 별도로 미완료다. 실행 중 바뀐 최종 앱 분류 보완은 위 최종 앱 전체 시험으로 별도 검증했다.

일회용 fresh DB와 이번 검사 전용 컨테이너는 결과 종료 후 이름·ID·미션 라벨을 확인해 정리했다(`.codex/stock-resolution-verify/cleanup.json`). 실제 앱·Supabase 서버는 유지했다.

실제 로컬 Supabase에 migration 00008만 전진 적용하고 이력을 기록했다. 원격 배포·커밋·푸시 없음. 실제 AppMap/Expo에서 대파 100g 차감/폐기 확인창을 각각 열고 취소했다. 현재 재고 4.6kg, 폐기 예상 손실 400원 표시를 확인했으며 실제 처리 버튼은 누르지 않았다. 확인 후 실제 DB 재고는 4,625g, 종료 요청 표는 0행이었다.

## 독립 검토와 한계

사용자 지정 Claude `앱 작업` 브라우저에서 Fable 5.1 중간 모델 표시를 관측하고 원문을 첨부했다. `.codex/stock-resolution-review.txt`와 `-review-v2.txt`에 소스·줄 번호·SHA를 보존한다. 정식 Fable protocol 실행을 대체하는 승인 기록이 아니며, 브라우저 검토자는 저장소 원본 해시 대조나 시험 실행을 하지 않았다.

1차는 응답 유실 후 재진입 중복이 코드상 차단됨을 확인했다. P1 SQLSTATE 불일치를 수용해 실제 코드 경계와 시험을 보완했다. 모든 `error.code`를 확정 결과로 보라는 제안은 채택하지 않았다. P2 무한 45010 반복 지적은 기존 resolver가 종료키를 조회·정리하므로 성립하지 않지만 확정 거절 시 즉시 복구하도록 개선했다. actor별 종료 기록 부재와 Web Locks 없는 브라우저의 다중 탭은 별도 제한으로 남는다.

2차 보완 재검토는 첨부 범위에서 이전 P1 해소·P0/P1 잔존 없음으로 판정했다. 알려지지 않은 SQLSTATE는 미확인 상태로 보존하는 안전한 기본 동작이며, 신규 서버 거절 코드 추가 시 목록과 실제 RPC 시험을 함께 검토한다. 22000이 PL/pgSQL 기본 예외 코드라는 부수 설명은 사실과 다르므로 채택하지 않는다(기본은 P0001). SQL 함수는 예외 시 같은 트랜잭션을 롤백하므로 receipt 이후 예외의 유무를 소스 정규식으로 고정하는 추가 시험도 도입하지 않았다. 역할별 ACL·네이티브 adapter 시험은 Codex 실행 근거와 독립 정적 검토를 구분해 보존한다.

## 출시 판단

현재 정식 오픈 승인은 보류한다. 화면별 정상 경로 시험과 전체 연결·실패 경로 검증을 같은 완료로 표현하지 않는다. 전체 실행 종료, 필수 실패 해소, 배포할 정확한 커밋의 CI와 세 표면 증빙, 실제 사용자 시나리오 검증을 구분해서 확인해야 한다. 네이티브 기기 증빙은 프로젝트 정책상 배포 비차단 후속 검수이지만 완료로 표시하지 않는다.
