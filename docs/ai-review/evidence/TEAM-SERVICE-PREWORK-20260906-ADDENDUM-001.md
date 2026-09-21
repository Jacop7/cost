# 최종 자문 후 보충 처분 (원본 불변)

- D-1: 동일 source/test SHA에서 `node --test scripts/docs-graph-check.test.mjs` 실제 26/26 PASS, skip0, exit0. 실행 전후 hash·완전 출력은 D1-CHECKS-001.json. 이전 기준선 결과를 옮겨 쓰지 않고 새 보충 시험을 했다. 전체 verify③은 FAIL인 역사로 유지한다.
- D-2: full verify 중 dirty181→185의 새 항목은 `.codex/mission-relay/candidates/`, `TEAM-SERVICE-PREWORK-20260906-CHECKS-001.json`, `TEAM-SERVICE-PREWORK-20260906-SOURCE-CANDIDATE-001.json`, `TEAM-SERVICE-PREWORK-20260906-SOURCE-FABLE-001.md`. 모두 병행 선작업 후보/증거이며 인벤토리591개 drift0과 구별한다. 정확한 git status 행은 D1-CHECKS에 있다.
- D-3: 후보001 createdAt `2026-09-02T23:13:55.902917+00:00` → 후보002 `2026-09-03T08:13:55.902917+09:00`는 같은 순간. 이번 생성 과정에서 PowerShell ConvertFrom-Json/ConvertTo-Json을 거치며 시간대가 재직렬화됐다. Orchestrator CLI 때문이라고 단정하지 않는다. 의미 변화 없음, byte 변화 있음. 봉인된 원본 둘은 보존한다.
- D-4: 호스트 모델 catalog의 별도 실측 snapshot/hash는 아직 없다. 후보에 있는 현재 작업 model/effort의 로컬 관측을 provider attestation으로 승격하지 않는다. 구현 모델 채택 시 확인할 항목으로 남긴다. 현재 노출된 도구에 별도 model-catalog 조회가 없어 임의 경로나 API를 추측해 호출하지 않았다.

페이블 원본 `TEAM-SERVICE-PREWORK-20260906-FINAL-FABLE-001.md` SHA `43d27db843c3aaa6e8cf1d4de96ad197d3478371b154dd36ce234050fdf039cc` 보존. 이 보충 기록은 원본 검수의 판정 소급 변경이 아니며 D-1 실행 관측의 후속 확인 대상이다. formal/LC-ADMISSION/실제 전송 승인 아님.

