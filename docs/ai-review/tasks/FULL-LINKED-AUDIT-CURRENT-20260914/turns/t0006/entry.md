
## CODEX_EVIDENCE · turn-c005

- role: `CODEX-FUNCTION-QA`

입고 선택 시 오래된 미확인 요청이 새 입력을 막는 오류를 수정했다. 로컬 migration 20260914000007은 같은 business/advisory 잠금 아래 이전 요청의 recorded 여부를 확인하고 미반영 키를 종료한다. 재고·입고 원장을 변경하지 않는 결과 조회이며 늦은 이전 요청은 거절한다. 앱은 정확히 일치하는 journal만 정리하고 새 입력·새 키로 입고한다. 과거 payload 재전송 경로를 제거했다.

사용자 지정 Claude 브라우저에서 소스 원문과 보완본을 첨부해 검토받았다. P1 재전송 및 P2 4건은 보완 재검토에서 해소됐다. UI 모델 관측은 Fable 5.1 중간이며 정식 protocol 승인으로 표시하지 않는다. 비차단 P3 표시 관찰과 첨부 hash 원본 대조 불가를 증거 문서에 기록했다.

최종 앱 1458시험, 관련78시험, DB102/102 및 추가 반례, 실제 양방향 경합, ACL·타입·터치 회귀66시험 통과. 전체 verify는 6단계를 실행했고 ①②④⑤⑥ 통과, ⑤ 업그레이드26/26 및 최종 웹 번들 통과다. 최초③ ACL·터치 실패는 보완 후 개별 재검사했으나 기존 clean commit 바이트 증빙과 네이티브 advisory4건은 미완료라 단일6/6 PASS로 표현하지 않는다.

실제 AppMap에서 오래된 대파 요청 안내 제거와 현재123g 입고 확인창을 확인·취소했으며 시험 입고를 실제로 제출하지 않았다. 임시 fresh DB·검사 컨테이너를 정리했고 실제 Supabase·앱 서버를 유지했다. 최종 소스16개 hash와 결과는 docs/ai-review/evidence/INBOUND-REQUEST-RESOLUTION-20260914.md 및 -inputs.json에 보존했다. 커밋·푸시·원격 배포 없음.
