# 전체 연결 감사 — 사용자 지정 Claude 브라우저 검토

사용자가 CLI 비용 승인 대신 기존 Claude ‘앱 작업’ 대화에 직접 요청하도록 지정했다. 현재 UI 모델 표시는 **Opus 5 · 중간**이다. CLI/API 호출 없이 로컬 코드 읽기 전용 검토를 요청했다. 이 기록은 브라우저 자문과 Codex 후속 검증이며 Fable protocol 승인·소진 승계·전체 게이트 통과를 뜻하지 않는다.

## 첫 답변과 범위

Claude는 기준 HEAD `e169c4b626a74574dcaef599dc9f87f7d6a0c67b`, 입력 파일 46개 및 로그 11개의 해시 일치를 보고했다. 로그는 해시만 확인했으며 시험은 실행하지 않았다. 약 12개 파일 본문 또는 관련 절을 읽고 나머지는 미검증으로 표시했다. 입력 판본은 `FULL-LINKED-AUDIT-20260914-review-inputs.json`에 보존한다.

| 지적 | Codex 확인·처리 |
|---|---|
| P1-1 고정 지출 배분 표시 누락 | 수용·수정. ‘영업일별 배분’으로 표시하고 기간 공통비 배분과 안내를 구분. 숫자 공식은 그대로 유지 |
| P2-5 팝업 목록/상세 수량·명칭 혼용 | 수용·수정. 제목·판매 수량·채널 구성·조리 폐기를 모두 금액과 같은 상세 응답에서 표시 |
| P2-1 미지정 기타 매출 총액 | 재검토에서 계산 오류 주장은 철회하고 개선 제안으로 하향. 현재 매출 라벨에 총액 표시는 일치하며 순매출로 무조건 치환하지 않음 |
| P2-2 0237 settings_lists 치환 앵커 무검사 | 소스 확인. 현재 업그레이드 체인 통과와 별개로 방어 검사 미비. 이미 적용된 migration은 수정하지 않으며 검증/전진 migration 방식 후속 검토 |
| P2-3 00006 치환 횟수 미검사 | 존재 검사만 있다는 점 확인. 실제 판본의 단일 앵커와 허용 업그레이드 계약을 추가 대조할 항목 |
| P2-4 새로운 채널을 포장으로 처리할 수 있음 | AGENTS와 3채널 고정 정의를 확인한 Claude가 철회. 현재 결함으로 세지 않음 |
| P2-6 국제 과세에서 차감 행 합과 순이익 표시 기준 | 세금 별도 fixture에서 표시의 모순을 확인·수정. 팝업과 채널 화면의 과세액을 ‘세금 (참고)’로 표시하고 추가 차감 부호 제거. 원장 숫자 불변 |

이전 RPC ACL 지적은 allowlist 및 시험이 86개로 일치하고 삭제 검사 RPC 권한을 단언함을 양쪽이 확인했다. 캐시 무효화, 단가 context 우선순위, 순매출 계산, 과거 부자재 총액 처리와 하네스 보호는 읽은 범위에서 타당하다는 의견이다.

## Codex 재현·수정 검증

- `MenuProfitSheet.tsx`와 `menuProfitSheetParity.test.tsx`만 후속 변경했다. 목록 수량 10·상세 수량 12를 주는 반례와 고정 지출 배분 라벨 검사에서 수정 전 **2실패·4통과**, 수정 후 **6통과**. `.codex/full-linked-browser-fix-before.log`, `.codex/full-linked-browser-fix-after.log`.
- 모바일 타입 검사 통과. `.codex/full-linked-browser-typecheck.log`.
- 최신 앱 전체 **130파일·1,453통과·4 DB 전용 제외**. `.codex/full-linked-browser-mobile.log`.
- 기존 입력 해시 영수증은 첫 브라우저 답변의 판본이므로 덮어쓰지 않는다. 이후 변경은 별도 delta로 기록한다.

## 후속 상태

추가 답변에서 SalesMenuDetailScreen의 장부 우선/오류 게이트/과거 명칭, 실제 RPC 매퍼 왕복 시험, 17개 단가 소비처 import 연결, 삭제 UI/훅/00004·00005, migration anchor 시험을 확인했다. 단가 소비처 17개 본문 전체와 모든 DB 경로를 검수한 것은 아니다. 0238 치환 방어 미비는 확인했고 적용 migration을 바꾸지 않는 사후 검사를 권고했다.

## 최종 5파일 재검토

변경 5파일은 `FULL-LINKED-BROWSER-20260914-delta-v2.json`으로 결속했다. 세 번째 브라우저 답변에서 5개 after SHA 및 첫 입력 영수증 hash 일치, **P1-1·P2-5·P2-6 해결**, 새 P0/P1 없음이라는 판정을 받았다. 처음 두 요청 시점 모델 UI는 Opus 5 중간이었고, 세 번째 요청 시점에는 Fable 5.1 중간으로 표시됐다. 이것은 UI 관측이며 CLI run의 모델 증명으로 대신하지 않는다.

- 세금 표시 보완까지 포함한 팝업/채널 UI 시험 **10/10**. `.codex/full-linked-browser-tax-display.log`.
- `99_linked_migration_postconditions.sql`: 적용 후 함수 정의에서 8개 단일 출현·연결 조건을 검사. 실제 로컬 DB에서 카탈로그만 읽어 **8/8 통과**. `.codex/full-linked-browser-db-postconditions.log`.
- 해당 검사 입력 문자열을 DO 블록 메모리에서만 누락·중복시킨 **15개 반례 모두 실패 감지**. DB 함수/원장 변경 없음. `.codex/check-linked-postcondition-negatives.mjs`, `.codex/full-linked-browser-db-negative.log`. migration 자체를 변형해 fresh DB에서 재실행한 시험과 구분한다.
- 누적 함수 내 문자열의 위치나 부분 과세 스냅샷의 생성 가능성까지 이 사후 검사가 증명하는 것은 아니다. 향후 정상적으로 키가 추가되는 경우 검사 명세 갱신이 필요하다.
- 터치 래칫은 변경 입력 해시만 갱신됐고 미달/미판정 목록은 동일하다. 미달 0, 재검사 PASS. `.codex/full-linked-browser-touch-check.log`.

공식 바이트 증빙의 clean commit 조건, 정식 review protocol, native advisory와 전체 fresh/upgrade 재실행은 미완료다. 브라우저 검수 범위 밖 화면을 완료로 표시하지 않는다.

## 마지막 공통 검사

- `.codex/full-linked-browser-final-verify.log`: `verify --no-db`의 타입·core 269·앱 1,453시험·웹 번들 통과. ③은 바이트 증빙, 터치 입력 해시 및 해당 회귀시험에서 실패했고 DB fresh/upgrade는 제외됐다. 단일 전체 통과가 아니다.
- 변경 소스의 터치 입력 해시와 생성 레지스트리를 정식 생성기로 갱신한 뒤 터치 감사 PASS, 터치 검사기 회귀시험 **66/66 PASS**. 기존 미달·미판정 목록은 변경하지 않았다. `.codex/full-linked-browser-touch-regression.log`.
- 바이트 증빙 재검사는 `surfaceRegistry.generated.json contentSha256 불일치`로 남는다. `.codex/full-linked-browser-byte-final.log`. 공식 생성기의 clean commit 조건을 우회하거나 다른 작업 변경을 임의 커밋하지 않았다.
- 네이티브 실행 증빙·영수증·기기 통합·글자 확대의 네 가지 명령은 `ADVISORY_FAIL`로 남는다. 네이티브 검사기 자체 회귀시험은 마지막 공통 실행에서 통과했으며 기기 증빙 통과와 구분한다.
- 이번 제품 변경 5파일의 `git diff --check` 통과. 기존 migration·실사용 원장·사용자 데이터는 수정하지 않았다.
