# AI 모델·토큰 운영계약 Claude Opus 독립검수 r1 요청

이 검수는 `AI-ORCH-PLANS-SIM-1`의 12단계 모델·토큰 운영계약 초안을 대상으로 한다. 제품 파일을
수정하거나 명령을 실행하지 말고 지정 파일을 Read/Glob/Grep으로만 확인하라. 한국어로 3,500 token
이내에 완결된 검수 결과를 출력하라.

## 대상 기준선

- repository: `C:\Users\jacop\프로젝트\식자재관리앱`
- branch: `codex/ai-team-knowledge-orchestration-plans`
- baseline HEAD: `f3f79bc5e954f6bca81552eba6020d4464ecb4b3`
- mode: `WORKING_TREE_HASHED`
- 대상 변경: 오케스트레이션 §6.3, 품질안 §4.4.1, 작업큐의 관련 사람 Decision·lease·manifest hash
- AGENTS SHA-256: `7c4b651732f5b973b38d033c7310fda062bf57eebfb64780ff57594156ab01cd`
- 오케스트레이션 SHA-256: `1b06da10bcf1b496b0fb1f094b23bc5d757bbb854fead179f9ec8b98f3cc6866`
- 품질안 SHA-256: `a432a7402c4c5685cf3c620347dc0f4c9df1ae49d16f4ec9d777c4ac6c67e8c9`
- 작업큐 SHA-256: `ffc6eab4322d60549d0b9f0a76dd50523c9b3279970a9c4b711b43076ece636a`
- ai-review README SHA-256: `71c42f1fc914c9c7c767a39e2edbac42fb1e5dc90fefaf0f4c4f41f6cf7efa42`

## 반드시 읽을 파일

1. `AGENTS.md`
2. `docs/AI-오케스트레이션-상세기획안.md` 전체, 특히 §6.1~§7과 §8.2~§10
3. `docs/AI-품질-학습-자율성-평가기획안.md` 전체, 특히 §4.3~§5.4와 완료 조건
4. `docs/작업큐.md`의 `AI-ORCH-PLANS-SIM-1` Task Packet
5. `docs/ai-review/README.md`의 Opus/Fable 권위·비용·실패 폐쇄 규칙

다른 사용자 소유 모바일·프로토타입·미추적 파일은 읽지 않는다.

## 사용자 요구와 권위 경계

- Terra xhigh는 1~12단계의 주 실행자다.
- Sol high/xhigh는 각 단계에서 구조 판단만 제한적으로 수행한다.
- Claude Opus는 1~12단계 각각의 필수 독립검수다.
- 사용자는 토큰 문제로 이번 계약 작성 회차에서 Fable을 호출하지 말라고 했다.
- 그러나 `AGENTS.md`는 완료 검수에 Fable을 의무화한다. 초안은 이를
  `DEFERRED_NOT_WAIVED`로 표현하고 Opus가 Fable 완료를 대체하지 못하게 한다.
- 이 회차는 Fable을 호출하거나 Fable PASS를 주장하지 않는다.

## 검수 질문

1. 12개 단계 모두 Terra·Sol·Opus가 빠짐없이 배정됐고 각 행·열 합계가 100점과 일치하는가?
2. 상대 점수를 공급자 간 토큰 등가값이나 금액 승인으로 오인할 여지가 없는가?
3. Sol 제한 검토와 Opus 최초 독립검수가 앞 모델의 전체 재수행·결론 주입 없이 가능한가?
4. 80%·100%·120% 제어가 필수 권위·시험·감사를 토큰 절감 명목으로 삭제하지 못하게 하는가?
5. Fable 호출 보류가 완료 게이트 포기나 Opus 대체로 변조될 수 없는가?
6. 8단계 사람 승인과 모델 권고의 경계가 명확한가?
7. 모델 불가·예산·인증·시간 제한 실패가 PASS로 합성되지 않는가?
8. 작업큐의 이번 사람 Decision, 단일 edit lease, candidate manifest hash 갱신이 기존 계약과 일치하는가?
9. 이 운영계약이 기존 §6.1, §8.2, 품질안 완료 조건과 모순되는가?
10. 실제 12단계 실행 전에 반드시 고쳐야 할 Critical/Major 결함이 있는가?

## 출력 형식

- `OVERALL_VERDICT: PASS | CHANGES_REQUIRED | BLOCKED`
- `COUNTS: Critical N / Major N / Minor N`
- 각 Finding: `ID`, `severity`, 정확한 파일·절, 재현 가능한 문제, 필수 수정안
- `ARITHMETIC_CHECK`: 12개 행 합계, Terra/Sol/Opus 열 합계, 총합
- `FABLE_BOUNDARY_CHECK`
- `LEASE_AND_HASH_CHECK`
- `REMAINING_RISKS`

Critical 또는 Major가 하나라도 있으면 `PASS`를 반환하지 마라. 선택 개선은 Minor로 분리하고, 실제로
읽지 못한 파일이나 확인하지 못한 hash는 확인했다고 추정하지 마라.
