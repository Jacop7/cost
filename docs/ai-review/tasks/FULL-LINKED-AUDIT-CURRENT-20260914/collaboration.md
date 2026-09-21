
## SOLAR_REQUEST · turn-s001

- role: `SOLAR-ARCH`

이 패킷은 FULL-LINKED-AUDIT-20260914의 외부 호출이 비용 하드캡 가드에서 시작 전 차단된 후, 후반 수정까지 포함한 최신 범위의 첫 검수를 준비합니다. 이전 task.json과 t0001~t0003을 변경하지 않습니다. 이전 성공 회차·Finding·비용 소진·승계 승인을 주장하지 않습니다.

재료/메뉴/설정 카테고리 갱신, 0·2·4 단가 정밀도 전파, 세금 포함·별도 채널 순매출, 과거 메뉴 명칭·부자재 금액·서버 손익, 조회 실패 상태와 복수 판매가를 검토하세요. 최종 MenuProfitSheet와 실제 RPC 매퍼 왕복 시험도 포함합니다. 경합의 실제 Lock 대기, 정상 영업 종료 RPC를 이용한 업그레이드 fixture 처리, ACL 하네스 환경 격리가 보호 조건을 약화하지 않는지 확인하세요.

원장/과거 스냅샷은 보존해야 합니다. evidence 문서의 자체 재검증, 단일 verify 6/6 미통과, 공식 바이트 증빙 미완료, native 4건 advisory를 구분하십시오. 관련 스냅샷에서 재현 가능한 필수 Finding을 제시하세요.

docs/ai-review/evidence/FULL-LINKED-AUDIT-20260914-review-inputs.json는 로컬 원본 및 시험 로그 해시 영수증입니다. 외부 검수 결과/커밋 봉인/사람 비용 승인으로 취급하지 않습니다. 회차 r001에 기술 soft cap $2.00, single-pass를 제안하며 현재 승인 대기입니다.

## CODEX_EVIDENCE · turn-c001

- role: `CODEX-FUNCTION-QA`

사용자가 CLI 회차 비용 승인 대신 기존 Claude 브라우저의 ‘앱 작업’ 대화에 검수 요청을 입력하도록 지정했습니다. 해당 대화에 현재 패킷, 46개 입력 파일 해시 영수증, 최신 검산 문서, 확정 재고/삭제/영업 상태 계약과 미완료 항목을 보내고 ‘Claude가 응답 중입니다’ 및 File system 도구 사용을 확인했습니다. 모델 선택 표시는 Opus 5 중간입니다. 파일·DB 변경, 다른 AI/유료 CLI 호출을 금지한 읽기 전용 검토 요청입니다. 응답 본문과 실제 코드 접근 범위는 수신 후 따로 검증합니다. 이 요청은 특정 CLI soft cap 승인이나 protocol 1.2 Fable 소진 승계가 아니며, 원 CLI 게이트를 통과로 바꾸지 않습니다.

## CODEX_EVIDENCE · turn-c002

- role: `CODEX-FUNCTION-QA`

사용자가 지정한 Claude 브라우저 대화에서 첫 검토 응답을 수신했다. 파일 46개와 로그 11개의 hash 일치를 확인했다고 보고했지만 본문 검토는 일부 12개·관련 절에 한정했다. 자체 시험 실행이나 CLI Fable 승인으로 기록하지 않는다. 지적과 대조 내용은 docs/ai-review/evidence/FULL-LINKED-BROWSER-20260914.md에 기록했다.

고정 지출 배분 표시 누락과 팝업의 목록/상세 데이터 혼용은 Codex가 반례로 재현하고 수정했다. 관련 시험 수정 전 2실패·4통과에서 수정 후 6통과. 최신 앱 130파일 1453통과·4 DB 전용 제외, 모바일 타입 검사·웹 번들 통과. 원본 입력 영수증을 보존하고 변경 2파일/검증 5로그를 FULL-LINKED-BROWSER-20260914-delta.json에 별도 결속했다. 공식 바이트 증빙 clean commit 조건, 정식 독립검수 protocol과 native advisory는 미완료다.

동일 브라우저 대화에 해시만 확인했던 코드의 추가 검토를 요청했다. 미지정 매출을 순이익으로 읽는 지적과 고정 3채널 밖 가정은 현재 계약/실제 반례로 재평가하도록 명시했다. 적용된 migration 불변 원칙도 전달했다. 추가 응답은 아직 수신 대기다.

## CODEX_EVIDENCE · turn-c003

- role: `CODEX-FUNCTION-QA`

사용자 지정 Claude 브라우저 ‘앱 작업’에서 총 세 응답을 수신했다. 최종 5파일 delta-v2의 hash 확인과 P1-1·P2-5·P2-6 해결, 새 P0/P1 없음 판정을 받았다. 본문 전체 미검토 범위는 남아 있으며 UI 모델 관측과 정식 CLI protocol 증거는 구분한다. CLI/API 검수는 호출하지 않았다.

Codex는 팝업 배분 라벨·상세 응답 우선 표시·세금 참고 라벨을 수정했고 적용 migration을 변경하지 않는 사후 검사 8개를 추가했다. 실제 로컬 카탈로그 8/8, DO 메모리 문자열 누락·중복 반례 15/15 통과. DB 원장/함수 정의 쓰기 없음. 타입·core 269·앱 1453·웹 번들 통과. 터치 입력 갱신 후 감사 및 검사기 회귀 66/66 통과.

마지막 verify --no-db의 ③ 실패 원본은 보존했다. 바이트 증빙 레지스트리 contentSha256 불일치와 clean commit 조건, 네이티브 advisory 4개, 정식 review protocol 및 단일 전체 DB 포함 6/6 게이트는 미완료다. 작업큐와 docs/ai-review/evidence/FULL-LINKED-BROWSER-20260914.md에 검증 범위와 후속 사항을 기록했다. 사용자 데이터 삭제·커밋·푸시·운영 배포는 수행하지 않았다.

## CODEX_EVIDENCE · turn-c004

- role: `CODEX-FUNCTION-QA`

네이티브 비차단 후속 검수를 진행했다. 현재 로컬 Expo에서 iPhone 1배와 2.143배는 각각 13개 시나리오, 새 무판정 미달 0, 중첩 0으로 통과했다. Android 1배는 밀도 2.625의 좌표 반올림으로 생긴 물리 1픽셀 인접 2건을 실패로 보존했다. Android 확대를 위한 시스템 글자 크기 변경 명령은 자동 승인 검토에서 거부되어 실행하지 않았고, 확대 표본 없이 허용 예외나 임계값을 완화하지 않았다.

실제 관리 행의 ActionSheet, 재고 선택기, 확대 시 화면별 중앙 스크롤, HostPortal/Modal 표면 root와 캡처 전후 글자 배율 고정을 검사 계약에 반영했다. 네이티브 검사기 회귀시험 55/55와 변경 파일 diff check가 통과했다. Claude 브라우저 읽기 전용 검토는 modal root 및 스크롤 보완이 타당하다고 했으나 정식 Fable protocol 결과가 아니다.

격리 DB 실행은 타입·core/DB/mobile과 새 DB migration 101/101, ACL, 판매·설정·재료 경합, migration anchor, recipe v2 두 세션 계약까지 통과했다. 이후 DB 전용 mobile 시험 시작 중 작업 환경 전환으로 종료되어 6단계 전체 통과로 표시하지 않는다. ③ 필수 실패는 clean exact commit이 필요한 three-surface byte artifact 1건이며 네이티브 실행·영수증·통합·글자 확대 4건은 계속 advisory 미완료다. 진단 JSON을 공식 영수증으로 승격하지 않았다. 공식 상태와 hash는 docs/ai-review/evidence/FULL-LINKED-NATIVE-FOLLOWUP-20260914.md에 기록했다.

## CODEX_EVIDENCE · turn-c005

- role: `CODEX-FUNCTION-QA`

입고 선택 시 오래된 미확인 요청이 새 입력을 막는 오류를 수정했다. 로컬 migration 20260914000007은 같은 business/advisory 잠금 아래 이전 요청의 recorded 여부를 확인하고 미반영 키를 종료한다. 재고·입고 원장을 변경하지 않는 결과 조회이며 늦은 이전 요청은 거절한다. 앱은 정확히 일치하는 journal만 정리하고 새 입력·새 키로 입고한다. 과거 payload 재전송 경로를 제거했다.

사용자 지정 Claude 브라우저에서 소스 원문과 보완본을 첨부해 검토받았다. P1 재전송 및 P2 4건은 보완 재검토에서 해소됐다. UI 모델 관측은 Fable 5.1 중간이며 정식 protocol 승인으로 표시하지 않는다. 비차단 P3 표시 관찰과 첨부 hash 원본 대조 불가를 증거 문서에 기록했다.

최종 앱 1458시험, 관련78시험, DB102/102 및 추가 반례, 실제 양방향 경합, ACL·타입·터치 회귀66시험 통과. 전체 verify는 6단계를 실행했고 ①②④⑤⑥ 통과, ⑤ 업그레이드26/26 및 최종 웹 번들 통과다. 최초③ ACL·터치 실패는 보완 후 개별 재검사했으나 기존 clean commit 바이트 증빙과 네이티브 advisory4건은 미완료라 단일6/6 PASS로 표현하지 않는다.

실제 AppMap에서 오래된 대파 요청 안내 제거와 현재123g 입고 확인창을 확인·취소했으며 시험 입고를 실제로 제출하지 않았다. 임시 fresh DB·검사 컨테이너를 정리했고 실제 Supabase·앱 서버를 유지했다. 최종 소스16개 hash와 결과는 docs/ai-review/evidence/INBOUND-REQUEST-RESOLUTION-20260914.md 및 -inputs.json에 보존했다. 커밋·푸시·원격 배포 없음.

## CODEX_EVIDENCE · turn-c006

- role: `CODEX-FUNCTION-QA`

차감·폐기에서 서버 성공 후 응답 유실·화면 재진입 시 중복 차감을 재현하고 수정했다. 영속 요청키로 결과만 조회하며 미반영 키는 종료해 늦은 요청을 차단한다. 실제 RPC 40001과 기존 모의 45009의 차이를 수정하고, 확정 서버 거절은 최신 재고를 조회한 뒤 새 확인을 받도록 했다. 로컬 migration 20260914000008 적용과 DB 타입 재생성을 완료했다.

최종 앱 1480시험, DB 103파일, 실제 2세션 경합 4조합, 타입·ACL·터치 회귀66시험 통과. 전체 verify 6단계 실행 종료: ①②④⑤⑥ 통과, 업그레이드26/26·최종 웹 번들 통과. 최종 공통 계약 재검사에서 필수 실패는 커밋 연결 3표면 바이트 증빙 1건이며 네이티브 advisory4건은 별도 미완료다. 전체6/6 PASS 및 정식 오픈 승인으로 표시하지 않는다.

사용자 지정 Claude 브라우저에서 원문과 보완본을 검토받았으며 2차 첨부 범위에서 이전 P1 해소·P0/P1 잔존 없음으로 판정했다. 정적 첨부 검토이며 정식 Fable protocol 승인과 구분한다. 실제 앱에서는 차감·폐기 확인창까지 열고 취소했으며 사용자 재고를 변경하지 않았다. 임시 fresh DB·검사 컨테이너 정리 완료, 실제 앱·Supabase 유지. 커밋·푸시·원격 배포 없음.

최종 근거와 소스18개 SHA256: docs/ai-review/evidence/STOCK-QUANTITY-RESOLUTION-20260914.md 및 STOCK-QUANTITY-RESOLUTION-20260914-inputs.json. 사용자 제안에 따라 새 작업의 로직 전수검수·기능/프로세스 정의와 현재 작업의 UI 분리를 권고했으며 아직 새 작업은 생성하지 않았다.
