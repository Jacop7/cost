
<!-- fable-review:r001 sha256=71606957c3aa9683cec0798b435aba790cd45aa81db5a23c8b6a800eeb5e1adb -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-FINAL`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `71606957c3aa9683cec0798b435aba790cd45aa81db5a23c8b6a800eeb5e1adb`
- target_commit_sha: `b4f79a6e9e3bfc830b4686a7b6ab861a37b26cf3`
- input_files_sha256: `d4b02ac733eab0fd589c768026b88251d22d750a9c4a99c18f558aafcb149bfa`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: FW5-B4F79A6-RUN-EVIDENCE-002, FW5-QUEUE-SNAPSHOT-001
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

다섯 기획안을 처음부터 독립 감사했다. (1) 요청·정규화·Task·단일 소유자·lease 결속: 온톨로지 §6이 판정 enum 4종(ADD·SUPERSEDE_PROPOSAL·NEW_TASK·STATUS_ONLY)과 정규화 필드를 단일 소유하고, 팀 구성안 §11이 queue ledger lock→Task lock 고정 순서, request_dispositions[]의 Task별 seq·직전 hash chain, 만료 lease 자동 인수 금지, 최초 edit_owner 1회 지정을 완결한다. 오케스트레이션 §4와 디렉터리 §7은 이를 재정의 없이 참조하며 authority DAG(team→ontology→orchestration→directory→quality)는 다섯 문서 front matter와 디렉터리 §6 기계 판독 블록에서 일치한다. (2) 정상·오류·방치 흐름 폐쇄: 실패는 RUN_FAILED·환경 미검증으로만 남기고 PASS로 합성하지 않으며(오케스트레이션 §9.1, 평가안 §4.6), 검수 루프는 OPEN→FIXING→READY_FOR_REVIEW→VERIFIED와 보호 원격 체크+closure successor 뒤에만 CLOSED를 허용하고(팀 §4.4), 프로덕션·정책·위험 수용은 자율성 단계와 무관한 사람 전용이며(평가안 §8, 오케스트레이션 §10.2), Learning은 CANDIDATE→VERIFIED→RETIRED에 독립 검증자·사람 Decision을 요구하고 FINAL_INDEPENDENT 전 회차 주입을 금지한다(평가안 §6). (3) 증거 대조: R3의 c1b595f 파일 SHA-256 7개 중 다섯 기획안 해시는 이 스냅샷 해시와 정확히 일치하고, GitHub Actions 33582393050의 Node 20.19.4·24·full-db-required 성공이 R3 71~79행에 고정돼 있다. R4는 Fable 실패·거부 5회(총 $11.790167)를 유효 회차로 세지 않고 보존했으며 유효 회차는 WORKFLOW-001/r001 CHANGES_REQUIRED 1회뿐이라는 기록이 작업큐와 일치한다. R2의 CRLF 해시 오류는 덮어쓰지 않고 R3로 정정됐다. 과거 실패 회차는 증거 이력으로만 취급했고 가상 VIRTUAL_SIMULATION gate를 실배포 증거로 승격하지 않았으며 DRAFT 활성화를 승인하지 않는다. 새 Finding 2건: (Major) task packet이 필수 증거로 주장한 b4f79a6 exact-commit 격리 실행 59/59가 저장소 내 어떤 파일에도 기록돼 있지 않다. 줄끝 안정 manifest 구현은 시뮬레이터에 실재하지만 마지막 격리 실행 기록은 07fbbbe(시험 파일 5E5CEF71…)이고 이 스냅샷의 시험 파일(16b07928…)과 판본이 다르다. (Minor) b4f79a6에 commit된 작업큐가 R4를 여전히 untracked·worktree mixed로 선언하고 current_state도 07fbbbe까지만 기록해, §11 재개 계약의 Git 상태 대조와 어긋난다. 두 건 모두 evidence 경로 수정이 필요하므로 proposed_edits 없이 별도 후속 Task를 요청한다. 판정은 CHANGES_REQUIRED이고 gate_state는 OPEN으로 유지된다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
