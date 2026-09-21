# TEAM-SERVICE P2 LC-ADMISSION 직접 Fable 검수 001

- 채널: 기존 `AI 팀 지식망 스터디·인계` Fable Cowork 대화
- 대상 요청: `TEAM-SERVICE-P2-ADMISSION-REVIEW-CANDIDATE-001.json`
- 대상 후보004 SHA-256: `d9153b711acd64768d1eab224f5d977d0521242a93af9bdd46dcbd4c682b2bbd`
- 성격: 사용자 승인 직접 Fable 검수. formal CLI receipt가 아니며 구현·전송 승인이 아니다.

## 판정

- `local_core_admission_for_exact_p2`: `CHANGES_REQUIRED`
- `p2_implementation_may_begin`: `NO`
- P2b~P5, 실제 전송, Router, 앱, DB, Supabase: 승인하지 않음

Fable은 요청 JSON 자체 SHA가 `7f6e5b41…`이고 요청 본문에 적힌 `d9153b71…`은 후보004 SHA라는 표기 차이를 지적했다. 요청의 14개 pin, HEAD `fe96c3c1…`, canonical model plan `60d7cb6a…` 무변경은 직접 대조해 일치 판정했다.

## 요구별 판정

1. `EXACT_LOCAL_MODEL_SCOPE`: `CHANGES_REQUIRED` — 후보004의 canonical diff에 P2와 무관한 stage 13 `opus-review expectedCallsLowerBound 0→2`가 포함됐다. stage 1~13을 canonical과 동일하게 복원하고 stage 14만 추가한 후보005를 재봉인해야 한다.
2. `LOCAL_SCOPE_REVIEW`: 조건부 `PASS` — state contract와 미존재 AC-18 시험 파일이라는 대상은 명확하며 B-1 해소를 전제로 범위가 적정하다.
3. `FIXTURE_ONLY_BOUNDARY`: `CHANGES_REQUIRED` — 경계 관측 자체는 정상이나 AC24 P2-004 증거에 raw TAP·입력 pin이 없고 catalog `AC-24.runs`에 등록되지 않았다.
4. `VERIFY_RUN_PINNED_INPUTS`: 관측 `PASS`, 전체 verify는 `FAIL` 유지 — HEAD 전후 동일, 입력 594개 drift 0, ①④⑤⑥ 통과, ②③ 실패. 증거 수집기의 부분 인벤토리 한계를 명시해야 한다.
5. `FAILURE_DISPOSITION_INDEPENDENTLY_REVIEWED`: 내용은 적정하나 결속 오류 — 처분서가 재봉인 전 후보 SHA `ad24cc7f…`를 가리킨다. 또한 09-05의 43/50에서 현재 42/50으로 퇴행한 `04_ledger` 실패를 명시해야 한다.
6. `AC24_REUSE_OR_NEW_RUN`: P2-004 신규 입장 run은 적정하나 catalog 등록이 필요하다. P2 완료 시 새 시험 파일과 JSON fixture를 포함하는 별도 P2 프로파일을 구현 전에 정의해야 한다.

## 착수 전 필수 변경

1. canonical stage 1~13과 동일하고 stage 14만 추가한 후보005 재봉인.
2. 후보005 SHA와 DB 시험 43/50→42/50 퇴행을 명시한 `DISPOSITION-002` 생성.
3. P2-004 raw TAP·exit·입력 hash 결속 및 catalog run 등록.
4. AC-24 P2 완료 프로파일 사전 정의.
5. CURRENT에 P2 후보와 입장 요청 상태 반영.
6. 위 변경 전체를 다시 Fable 검수.

실패 2단계는 면제되지 않으며 `service_ready=false`, 실제 전송과 모든 운영 변경은 계속 닫힌다.
