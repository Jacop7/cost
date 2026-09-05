# 서비스 총괄 라우팅 — Codex 1차 검증

날짜: 2026-09-05. 요청: Codex 1차 전체 테스트 후 Opus 2차 검수.
기준 HEAD: 6497666e655609a4f4bfe10bfaea6070dad01286. 미커밋 공유 작업본 검사이며 정확한 소스 hash는
2차 입력 스냅샷에 함께 보존한다. 제품 코드·migration·배포·활성화 계약은 이번 검증에서 수정하지 않았다.

## 검증 결과

- `corepack pnpm verify`: 전체 6단계 실행 중. 현재 전체 PASS가 아니다.
- 타입: 통과.
- 기존 개발 DB: 43/50, 별도 동일 명령 재현에서도 43/50.
- core 별도 실행: 194 통과, live DB parity 조건부 12개 건너뜀.
- mobile 별도 실행: 233/233 통과.
- 새 일회용 DB: migration 전체 적용 후 SQL 50/50 통과.
- 새 DB ACL: metric 22개·mobile RPC 73개·비-mobile 예외 2개 계약 통과.
- 새 DB 2세션 경합: 통과. 실제 B←A 잠금 관측·마감 직렬화·원장 합계 확인.
- 새 DB locale/international parity: 13/13 통과. 일회용 fresh_verify DB 정상 정리 확인.
- upgrade 경로와 웹 번들: 아직 실행 결과 대기.
- 라우팅/문서 그래프 관련 node 시험: 42/42 통과(새 workflow 10 + 정적 요구 검사 6 + 기존 graph 26).
- Team Router python unit: 38/38 통과.
- 정책/manifest CLI: POLICY_VALID / ACTIVE_DISPATCH, MANIFESTS_VALID / 11 chats / 21 edges.
- 별도 실제 문서 그래프 검사: PASS. 새 요구 진단은 REQUIREMENTS_NOT_MET이며 전송은 없음.
- CLI 고정 계약, 배포 가드 21/21, ACL 소스 스캔 13/13, CI 계약, 보호 게이트 18/18,
  GitHub ruleset 선언, 운영 모니터링 계약, ACL shell 보안 회귀시험: 각각 통과.

전체 verify의 ③은 setup-doctor 실패 후 하위 검사를 단락한다. 따라서 뒤의 검사를 별도로 실행했다.
이 개별 결과를 verify ③ PASS로 바꾸거나 전체 6/6 PASS로 합성하지 않는다.

## 기존 환경/기준선 문제

1. 기존 DB 실패: 01_checksums, 08_write_paths, 14_volume_weighted, 17_profit_history,
   22_revision_and_close, 27_amend_ended_day, 28_past_edit_round_trip.
   주요 증상은 legacy 기대 4046.69 vs 국제 세금 확정 4046.60, 기타매출 채널 누락 거부,
   판매 fixture 전제 불일치다. 동일 SQL 스위트가 fresh DB에서는 50/50이므로 기존 개발 DB와
   새 fixture의 상태 차이가 원인 후보다. 개발 DB를 reset하거나 제품 계산값을 옛 기대값으로 되돌리지 않았다.
2. setup-doctor는 Supabase CLI를 찾지 못했다고 실패했다. 그러나 직접
   `corepack pnpm --filter @margincook/db exec supabase --version`은 2.116.0을 반환했다.
   동일 node_modules/supabase/dist/supabase.js 진입점도 재검사에서 451ms / exit 0 / 2.116.0이었고,
   setup-doctor 재실행은 PASS 15 / WARN 4 / FAIL 0이다. 최초 실패 원인은 재현되지 않았다.
   실행기의 7초 제한 등 일시적 실행 조건은 원인 후보일 뿐, CLI 미설치로 단정하거나 재설치하지 않는다.
3. 별도 색 대비 검사 실패: 결정 commit f351058f30aa, 9ffba3176f11, 0d9f437782d6이 현재 HEAD의
   조상이 아니라는 provenance 오류다. 이번 라우팅 변경과는 다른 파일·기준선 영역이며 자동 수정하지 않았다.

## 새 코드에서 추가 재현한 결함

### C1 — 식별자 타입 검사가 없어서 배열 Task ID를 받음

`createServiceWorkflow({taskId:['TASK-A'],correlationId:'CORR-A',team:teams[0],taskPointer:'TASK:A'})`
가 성공하고 반환 state.taskId는 배열이다. 정규식 test의 문자열 강제 변환 때문이다.
JSON 저장/복원 후 event.taskId strict equality와 계약 타입이 깨질 수 있다. 문자열 타입 명시 검사가 필요하다.
기존 10개 workflow 시험에는 이 반례가 없다.

### C2 — 같은 event의 JSON key 순서만 달라도 중복 재전송으로 인정하지 않음

HUMAN_STOP 이벤트 e를 적용한 뒤 `Object.fromEntries(Object.entries(e).reverse())`로 같은 내용을
재전달하면 EVENT_ID_CONFLICT다. hash가 정렬되지 않은 JSON.stringify를 사용한다.
재직렬화 경로가 키 순서를 바꾸는 경우 멱등 재시도가 실패한다. canonical 직렬화 규칙과 시험이 필요하다.

두 반례는 node에서 직접 실행해 확인했으며 이번 요청은 테스트·검수이므로 소스 수정 없이 Opus에 전달한다.

## 아직 증명되지 않은 서비스 기능

- foreground 상태 reducer는 실제 앱 전송 adapter·실제 영수증 verifier·영구 outbox에 연결되지 않았다.
- 활성 source가 다음 leg를 실제로 실행하는 hook/agent 운용 연결과 crash recovery가 없다.
- CEO 직접 지시와 부의 동기화, 팀 간 협업, 상황실 상태 취합, 모든 역할의 사람 보고는 미완료다.
- 11개 runtime endpoint는 generation 1 / ACTIVE_INITIAL이며 successor 재결속 완료 증거가 아니다.
- 실제 01→주→부→팀→부→주→01 왕복·팀 협업·사람 보고 메시지는 이번에 전송하지 않았다.
- 합성 verifier를 사용한 상태 전이 시험은 수신 ACK 진위·사람 승인·서비스 운영 정상의 증거가 아니다.

## 2차 Opus 요청 및 승인

사용자는 이번 라우팅 코드·시험·진단 기록의 Opus 1회 검수에 $2 soft cap과 실제 초과 위험을 명시적으로
승인했다. 자동 증액·재시도·반복 호출은 하지 않는다. OPUS_DIRECT_ADVISORY로 원본 응답·모델 사용량·
입력 hash를 보존하며 Fable fallback으로 위장하거나 공식 Fable gate를 종결하지 않는다.
