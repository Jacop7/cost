# AI-PLANS-SIM-CODEX-ULTRA-R2 — 실제 업무 계약 2차 적대 재감사

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `VERIFIED`
> 기준: 구현 commit 생성 전 공식 worktree 후보
> 기준 부모 commit: `8ab364e3330bbd7205572279fb5a4d6b969e2a51`
> 역할: Codex 계약 감사 2차
> 실행: `corepack pnpm ai:plans:simulate` — 59/59 통과

## 1. 독립성 경계

1차 증거의 PASS 수를 복사하지 않고, 아직 직접 공격하지 않은 수명주기·경로·감사 경계를 새로
변이했다. 제품 코드·DB·실제 `docs/team/roles`·`docs/plans` 디렉터리는 변경하지 않았다. 네 후속
기획안은 계속 `DRAFT`이고 사람의 활성화 Decision을 만들지 않았다.

## 2. 추가 공격과 결과

| 공격 | 기대 | 결과 |
|---|---|---|
| `reviewBy`가 지난 VERIFIED Learning 적용 | 만료 거부 | `LEARNING_REVIEW_EXPIRED`로 적중 |
| VERIFIED Learning을 감사 사건 없이 CANDIDATE로 역행 | 현재 상태 복원 실패 | append-only 전이 대조로 적중 |
| 문서 링크에 `C:/Windows/System32` 사용 | 저장소 밖 절대경로 거부 | 절대경로 검사로 적중 |
| Task의 `route` 사후 변경 | 계약 변조 거부 | contract hash·감사 사건 대조로 적중 |
| Task의 `reviewerRole`을 미등록 역할로 변경 | 역할·계약 변조 거부 | 역할 allowlist와 contract hash로 적중 |
| Task의 `appliedLearningIds` 삭제 | 학습 적용 계약 변조 거부 | contract hash·감사 사건 대조로 적중 |
| Task의 `editOwner`·세션·lease를 직접 바꾸고 새 작업자가 쓰기 | 무단 인수 거부 | 등록·LEASE 감사 원본 복원으로 쓰기 전 적중 |
| 등록되지 않은 `human-*` 문자열로 Decision 생성 | 사람 승인 위조 거부 | 사람 승인자 registry로 적중 |
| 하나의 Learning 검증 Decision을 두 Learning에 재사용 | 1회 소비 계약 | 첫 검증에서 Decision 소비 후 두 번째 거부 |
| 실제 작업큐 evidence 파일 삭제·거짓 DONE | 재개·종료 거부 | 파일 실재 검사와 보호 gate 전 종료 차단으로 적중 |
| 존재하지 않는 원 요청·정규화 뒤 의미 변경 | Task 생성 거부 | 요청·정규화 payload hash 결속으로 적중 |
| ADD·SUPERSEDE 승인 payload를 DB·운영 변경으로 교체 | 위험 우회 거부 | payload hash와 R0 민감범위 재분류로 적중 |
| 네 권위 문서의 `supersedes` 순환·일괄 은퇴 강제 | 수명주기 분리 | 최초 활성화만 원자화하고 같은 `doc_id@version` 대체만 허용 |
| 가상 protected gate를 실제 운영 증거로 승격 | 외부 증거 오인 거부 | `VIRTUAL_SIMULATION`·`VIRTUAL_FIXTURE` 경계를 감사 상태에 봉인 |

또한 Task·Decision·Finding registry에서 감사 원본 뒤 항목을 삭제하는 세 계열, Learning·자율성
현재 상태 변조, 중대 경계 사고의 A0 강등, A1 최소 30개 표본 우회를 함께 재실행했다.

## 3. 후보 파일 SHA-256

| 파일 | SHA-256 |
|---|---|
| 팀 구성안 | `FB695AC180F98C66EC9F5A2A3F4DCF863B32B238D6D5F2A6966F19D7B704296C` |
| 온톨로지 | `8C0DE404951DD133C9757163BDC1F273759482F919392363CF2C10590A454111` |
| 오케스트레이션 | `83B14CBA83A919D32072C3DBB14E6FC4013B2E5DC2B61E7D6C706BA0D6986F9C` |
| 디렉터리·문서 신경망 | `059EBAAB6429035598D2EC876861107C555FD6C348C341267D2FF000C758AF48` |
| 품질·학습·자율성 | `1CCBE0DB830E11D3D6EA12EEF584BB3F014F2A51A7E565B8DFDD5C79A16AECFC` |
| 시뮬레이터 | `AA22F05BF6CF212FD659201B020B0DA30EB21F62C28823963136685647617476` |
| 적대 시험 | `F267D3A66F9981B89AE5C6AFA07A4FBFDFE150B77A11D85D68E8D5D888CA7042` |

## 4. 결론

Codex 2차 적대 재감사 범위의 열린 필수 Finding은 0건이다. 이 판정은 문서 활성화나 실제
디렉터리 생성을 승인하지 않는다. 다음 단계는 전체 `pnpm verify`를 통과한 exact commit을 만든 뒤,
그 동일 SHA를 서로 다른 공식 Task·scope·session으로 Fable 2회 독립 검수하는 것이다.
