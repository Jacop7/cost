# AI-PLANS-SIM-FABLE-DIFF-RECHECK-R1-VALIDATION-REJECTED

> Task: `AI-ORCH-PLANS-SIM-1`
> Review Task: `AI-ORCH-PLANS-BUNDLE-A-FABLE-DIFF-RECHECK-009`
> 상태: `RUN_FAILED / VALIDATION_REJECTED`

## 실행 결과

- 실행 방식: 변경된 두 공식 문서와 source r001 Finding 증거만 담은 `--single-pass`
- 승인 soft cap: USD `8.00`
- 실제 사용액: USD `4.215557`
- provider 상태: `completed` / `success`
- 실행기 실패: `RESULT_VALIDATION_FAILED`
- 검증 단계: `SEMANTIC_VALIDATE_RESULT`
- 실패 코드: `RESULT_FINDINGS_CONTRACT`
- run SHA-256: `6d2df4840fff4ebcea85969a35e321cbba9b5cabca934ea3e0d6dc7b89874b36`
- 후보 SHA-256: `db69d8ee159347babc6d10110569d4709055f6d9d90ba37118b055c19c16ffb5`

## 해석

Claude Fable은 구조화 후보에서 두 source Finding을 모두 `VERIFIED`로 판단하고 verdict `PASS`,
필수 미해결 Finding 0건을 반환했다. 그러나 이번 Task는 source Task의 formal `predecessor_review`
계약을 승계하지 않은 새 `INITIAL` Task였으므로, 과거 Finding ID를 `VERIFIED`로 반환한 결과는
저장소 의미 계약에 맞지 않아 실행기가 거부했다.

따라서 이 후보는 두 수정의 내용상 해소를 뒷받침하는 격리 진단 증거일 뿐, 공식 `review.json`,
유효 PASS, Finding 종결 또는 gate 통과로 사용하지 않는다. 자동 재시도·추가 증액·Opus 전환은 하지
않으며, 다음 외부 호출 전에 `WORKING_TREE_HASHED` source의 Finding을 안전하게 승계할 정식 계약을
설계·검증해야 한다.

## 원본

- `docs/ai-review/tasks/AI-ORCH-PLANS-BUNDLE-A-FABLE-DIFF-RECHECK-009/rounds/r001/run.json`
- `docs/ai-review/tasks/AI-ORCH-PLANS-BUNDLE-A-FABLE-DIFF-RECHECK-009/rounds/r001/candidate-review.json`
- `docs/ai-review/tasks/AI-ORCH-PLANS-BUNDLE-A-FABLE-DIFF-RECHECK-009/rounds/r001/candidate-review.md`
