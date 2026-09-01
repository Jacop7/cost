# AI-ORCH-PLANS-1 공동 작업 장부

> 다섯 핵심 기획안의 누적 Opus 직접 자문과 사람 결정을 기록하는 append-only 장부다.
> Fable 턴은 공식 검수 실행기만 추가하고, 그 밖의 턴은
> `corepack pnpm fable:append -- --task AI-ORCH-PLANS-1`로만 추가한다.
> 직접 Opus 결과는 `OPUS_DIRECT_ADVISORY`이며 공식 Fable gate를 대체하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `006000bdcb60783cf34f96d83e298e54277d2e0b`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/AI-지식-온톨로지-기획안.md`, `docs/AI-오케스트레이션-상세기획안.md`, `docs/디렉터리-문서신경망-재설계-기획안.md`, `docs/AI-품질-학습-자율성-평가기획안.md`
- 충족해야 할 요구사항·불변식: 누적 문서 상호작용, 다중 채팅 저장소 권위, Stage 4 r2 Finding 반영, 직접 advisory와 공식 Fable gate 분리
- 이번에 바꾼 내용: Stage 1~4 Opus 교차검수 결과를 반영하고 exact SHA CI protected gate까지 통과했다.
- 집중 검토 질문: Stage 4 r2 Finding 7건이 모두 해소됐으며 잔여 Critical·Major·명세상 필수 Finding이 0건인가?
- 실행한 테스트·현재 증거: exact SHA `006000b` GitHub Actions Node 20.19.4·Node 24·full-db-required·protected-gate 성공
- 사람 결정이 필요한 항목: 추가 advisory 예산 상향
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `QUEUE-LOST-UPDATE-80`, `AUTO-BASELINE-81`, `PLAN-COUNT-82`, `METRIC-ANCHOR-83`, `LRN-VERIFIER-84`, `LOCK-NEST-86`, `OWNER-LOCK-ORDER-87`
- decision_id: `AI-ORCH-PLANS-OPUS-BUDGET-002`
- 결정: `advisory_budget_usd_approved = 2.00`
- 허용 범위·기한: 다섯 핵심 기획안의 Stage 4 r2 반영 결과 최종 읽기 전용 Opus 재검수 1회, 2026-09-02에 한함
- 근거: 사용자가 “승인”으로 직전 제안인 “Opus 최종 재검수 추가 상한 $2”를 명시 승인함
- 승인자·시각: 사람 주 오케스트레이터 · 2026-09-02 Asia/Seoul
- next_review_request: `OPUS_DIRECT_ADVISORY`

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-h001`
- target_commit_sha: `006000bdcb60783cf34f96d83e298e54277d2e0b`
- advisory_route: `OPUS_DIRECT_ADVISORY`
- advisory_session: `8cee16bc-7b02-4ea7-914f-b9ee5a22c225`
- advisory_verdict: `CHANGES_REQUIRED`
- cli_reported_cost_usd: `1.402057`
- conservative_cumulative_usd: `21.37 / 22.00`
- evidence_path: `docs/ai-review/evidence/AI-PLANS-STAGE4-OPUS-R3.md`

### ADVISORY-BUDGET-88

- disposition: `APPLIED`
- 적용 위치: r3 증거와 본 공동 장부
- 적용 내용: `turn-h001`의 collaboration entry hash, append 후 장부 hash, 회차 비용과 센트 올림 누적액을 고정했다.
- 반박 또는 부분 적용 근거: 승인 pin은 호출 전에 존재했지만 Opus 입력 스냅샷에서 빠졌으므로 검수자의 CHANGES_REQUIRED 판정을 그대로 보존한다.
- 필요한 재검수: 승인 장부·t0001 run·r3 증거를 포함한 다음 유효 Opus advisory

### A0-DELEGATE-89

- disposition: `APPLIED`
- 적용 위치: `docs/팀구성_상세기획안.md` §4.5
- 적용 내용: A0 최소 권한과 평가안 §8의 `DELEGATED_PENDING` 전이 소유 관계를 명시했다.
- 필요한 재검수: 다음 누적 advisory

### ONTO-REF-90

- disposition: `APPLIED`
- 적용 위치: `docs/팀구성_상세기획안.md` §3.2
- 적용 내용: 온톨로지 소유권은 해당 기획안의 `ACTIVE` 승격 뒤부터라는 단서를 추가했다.
- 필요한 재검수: 다음 누적 advisory

- 기존 Stage 4 r2 Finding 7건: Opus r3에서 모두 `RESOLVED`
- next_review_request: `HUMAN_DECISION`
