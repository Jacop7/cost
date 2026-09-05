# Sol ultra 전체 계획 검토 R3

날짜: 2026-09-05. 요청 모델 gpt-5.6-sol / ultra, 독립 agent 1개, 추가 agent 없음.
아래는 실제 반환 Finding의 주담당 정리본이며 verbatim raw export로 주장하지 않는다.
반환 원문은 현재 작업의 검수 agent 최종 응답에 남아 있다. formal gate가 아니다.

판정: **CHANGES_REQUIRED**.
범위는 v0.3 조사·구현계획의 내부 정합성 검토뿐이며, formal gate·구현·활성화·서비스 승인 판정이 아니다.
검토 대상 계획 SHA-256: eab9e85c246db6e5feffa54ef85131f3b204409495e7c5914dda8ae8242c14e5

## Blocking findings

1. SF-R3-01 / 높음 — P2가 자기 산출물인 상태·권한·event schema 없이 통과할 수 있다.
계획 :116-137, :139-177 및 :275; acceptance :218-223.
하나의 선형 상태열만 제시하며 Task·subtask·assignment·delivery·effect·blocker의 상태 소유자와 roll-up이 없다.
모델 profile만 봉인하면 schema 없이 P3로 진입할 수 있다.
entity별 상태/전이/roll-up 표와 ACK 이후 진행·sibling 병행·Task 완료 조건 P2 case가 필요하다.

2. SF-R3-02 / 높음 — STOP 선형화가 실제 effect 및 재개 세대를 막지 못한다.
계획 :121, :157-162, :169-177; acceptance :103-112.
effect 확인과 STOP이 같은 root lock/CAS라는 계약이 없고 효과 직전 epoch 확인은 TOCTOU를 남긴다.
새 run generation이 fence/receipt에 결속되지 않아 옛 결과가 새 실행을 충족할 수 있다.
effect_claim과 STOP CAS를 동일 잠금에서 선형화하고 run_generation을 action/lease/route/receipt/result에 넣어야 한다.
AC-09에 effect claim 경합과 RESUME 이후 구세대 결과 거부를 추가해야 한다.

3. SF-R3-03 / 높음 — 권한 만료·폐기와 신뢰 시계 계약이 닫히지 않았다.
계획 :105-112, :157-159, :223-232; acceptance :211-215, :153-161.
fence에 decision_id/revision/expires_at이 없고 실행 상태별 만료 전이가 없다.
trusted UTC는 필수인데 PH 필드에 없으며, 늦은 유효 결과 AUDIT_ONLY와 무효 실행 REJECTED 구분이 없다.
AUTH_EXPIRED/REVOKED와 안전 STOP/보고·새 Decision 후 재개를 명시해야 한다.

4. SF-R3-04 / 높음 — PH-FEASIBILITY의 완전한 결과·후속 단계 결정표가 없다.
계획 :217-237; acceptance :201-230; 계획 :5/CURRENT :7/correction :5.
성공 terminal 및 UNVERIFIED 잔존 시 결과가 없고 mock 개발 허용 범위가 모호하다.
FEASIBLE_STATIC / HOST_BINDING_UNAVAILABLE_IN_SCOPE / DISCOVERY_INCOMPLETE와 각 후속 단계,
depends_on을 기계 계약에 넣고 P1A/PH-FEASIBILITY 명칭을 통일해야 한다.

5. SF-R3-05 / 높음 — 수용 목록이 단계 순서와 핵심 성공 흐름을 증명하지 못한다.
계획 :252-261, :276, :58-61, :279, :302-309; acceptance :115-123, :251-255, :20-28, :90-100, :232-249.
AC-10에 payload conflict/경합/부분 실패가 빠졌고 P5에 성공 CEO→팀→총괄 sync 및 peer request/result가 없다.
5팀 왕복이 P4, DAG 자손 STOP이 P3로 너무 이르다.
자유문장 required_assertions와 case pass만으로는 빈 시험도 통과할 수 있어 stable assertion_id와 전부의 실행 증거가 필요하다.

6. SF-R3-06 / 높음 — ACK-only probe와 실제 P9 파일럿이 같은 case이고 probe 전에 send가 열린다.
acceptance :189-198, :281-307; 계획 :282-288, :355-357.
AC-16을 probe와 실제 왕복으로 분리하고 P8에는 exact 승인된 PROBE_ONLY만 열어야 한다.
일반 신규 dispatch는 probe 성공 후에만 가능해야 한다.

7. SF-R3-07 / 높음 — formal gate 검토 대상 및 acceptance hash 결속이 없다.
CURRENT :3-6; acceptance :266-278; 계획 :334-338, :350-353; AGENTS :125-133.
candidate_manifest에 plan/acceptance/schema/runner/구현/시험/정책 SHA를 먼저 봉인하고
typed formal receipt가 해당 target SHA를 참조해야 한다.
최종 activation envelope는 candidate SHA + review receipt SHA + 사람 Decision SHA를 결속해야 한다.
Fable 기본/제한된 Opus fallback·동일 target·Finding 상태를 단순 문자열 PASS로 대신할 수 없다.

## 현재 판정과 한계

권장 상태: PLAN_CHANGES_REQUIRED_BEFORE_PH_FEASIBILITY.
implementation_authorized/service_ready는 계속 false.
사람01→CEO02→서비스총괄03→5팀, CEO 직접 관여, peer 협업, 비차단 상황실, 전 역할 사람 보고의 방향은 반영됐다.
문제는 이를 통과 조건으로 충분히 증명하지 못한다는 점이다.
Opus 원본은 timeout/빈 출력/판정 없음이며 formal gate가 아니다.
새 baseline42/38/44는 AC 실제 실행 또는 전체 verify PASS가 아니다.
읽기 전용 정합성 검토뿐이며 host 신뢰 기능/실제 wake/DB/AC/전체 verify를 실행하지 않았다.

## 검토 SHA

- plan: `eab9e85c246db6e5feffa54ef85131f3b204409495e7c5914dda8ae8242c14e5`
- acceptance: `8856e030edeec9c1897bd6e3db0812e94a269207008b9ab1c70060b75c03e7c0`
- correction: `869fb5c1a0c32c151fb0bb760174f5b592c440e913faaddd0eaea2bdeb5e62bf`
- current: `f7776618f800c30787532eb504f4bf29a103e67c8096323a4a13f2fc40f0d547`
- input: `c79a041adec5ab6f52b380a4d151be0e48a1bfc982579f337e288f050ff2d282`
- model_plan: `60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e`
- AGENTS: `d003d7c381d412c842ff3cd19978f7cb19fa841d8bab4c7b3f383514764bb194`
