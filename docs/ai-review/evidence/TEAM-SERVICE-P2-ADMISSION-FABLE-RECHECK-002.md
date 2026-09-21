# TEAM-SERVICE P2 로컬 입장 Fable 직접 재검수 002

## 성격과 결속

- 채널: 기존 `AI 팀 지식망 스터디·인계` Fable Cowork 채팅
- 입력 패킷: `docs/ai-review/evidence/TEAM-SERVICE-P2-ADMISSION-RECHECK-CANDIDATE-002.json`
- 입력 패킷 SHA-256: `974534e3705385a15d88d14e02c12941eb8a07ce83386540b4229c4380949ffc`
- 대상 HEAD: `fe96c3c196d4c3211024c1ecbe18e9d358a230b8`
- 대상 후보005 SHA-256: `f15b2f2928583a342516e3ae6a1772ac4927ad0a457d048450b455ac6cf80ed5`
- 성격: 직접 Cowork 독립 자문 검수. formal CLI typed receipt가 아니며 provider attestation도 아니다.

## Fable 최종 판정

- `local_core_admission_for_exact_p2`: **PASS**
- `p2_implementation_may_begin`: **YES**
- 범위: gate 소유자가 후보005와 본 재검수 및 실패 처분002를 결속한 P2 한정 admission 결정을 기록한 뒤, `docs/team/service-flow-state-contract.json`과 `scripts/team-service-state-contract.test.mjs`의 AC-18-A01~A06 구현에 한정한다.
- P2b~P5, 실제 provider send, Team Router 변경, 앱·DB·migration·Supabase·스테이징·운영 변경은 허용하지 않는다.
- `service_ready`, 실제 11개 채팅 왕복 완료, 전체 `pnpm verify` 통과를 주장하지 않는다.

## 입력 무결성과 여섯 요구 판정

Fable은 요청 패킷 SHA, 후보005·canonical 계획·HEAD 및 입력 pin을 대조했다고 보고했고, 다음 여섯 요구를 모두 `PASS`로 판정했다.

1. `EXACT_LOCAL_MODEL_SCOPE` — 후보005의 stage 1~13이 canonical과 같고 stage 14만 P2다.
2. `LOCAL_SCOPE_REVIEW` — 현재 직접 재검수로 충족했다.
3. `FIXTURE_ONLY_BOUNDARY` — 로컬 mock/fixture 경계와 무발송 경계를 유지한다.
4. `VERIFY_RUN_PINNED_INPUTS` — 전체 검증 관측과 실패 상태를 그대로 보존했다.
5. `FAILURE_DISPOSITION_INDEPENDENTLY_REVIEWED` — 실패를 면제하지 않은 처분002를 수용했다.
6. `AC24_REUSE_OR_NEW_RUN` — P2 입장에는 신규 `AC24-ADMISSION-P2-005`를 사용하고, P2 완료는 별도 `P2_STATE_CONTRACT` 실행만 인정한다.

이전 차단 B-1(모델 범위 누출), B-2(raw TAP·catalog 등록), B-3(실패 처분 결속)과 P2 완료 프로필·CURRENT 가시성 조건은 해소됐다고 판정했다.

## 착수 전 기록 조건

차단이 아닌 마지막 기록 행위로, gate 소유자가 SOL-003과 같은 형식의 P2 한정 admission 결정을 만들어 다음을 결속하도록 요구했다.

- 후보005 SHA
- 본 Fable 재검수
- 실패 처분002
- `LC-ADMISSION.scoped_admissions`
- CURRENT의 P2 범위 상태

## 비차단 후속

1. 봉인 후보004는 stage 13 오염 때문에 직접 수정하지 말고 `WITHDRAWN_STAGE13_SCOPE_LEAK` 철회 기록을 남겨 오사용을 막는다.
2. 실패 처분002의 DB 실패 요약 3종과 달리 raw stdout상 실패 파일은 `01`, `04`, `08`, `14`, `17`, `22`, `27`, `28` 여덟 개다. 전체 목록이나 raw stdout 참조를 남긴다.
3. 전체 검증 run의 입력 inventory는 `docs/**`와 `.codex/team-router/**` 전체를 포괄하지 않으며 별도 완전 inventory companion이 없음을 명시한다.
4. P2-005 observation의 raw TAP 결속은 원본의 의미론적 완전성을 보증하지 않으며 TAP 원문에 일부 pin 정보가 직접 노출되지 않는 한계를 유지한다.
5. 후보005의 `input_refs`가 요약 중심이라는 사실은 다음 재봉인에서 보강하되, 열린 실패와 `service_ready=false`, 실제 send 차단은 그대로 유지한다.

## 보존 원칙

이 문서는 Fable 화면 응답을 저장소의 재현 가능한 입력·판정 구조로 옮긴 기록이다. 봉인 후보나 과거 검수 원본을 덮어쓰지 않으며, gate 소유자의 별도 P2 범위 결정과 구현 후 사후검수를 대신하지 않는다.
