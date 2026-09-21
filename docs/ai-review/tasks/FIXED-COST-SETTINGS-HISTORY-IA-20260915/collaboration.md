# FIXED-COST-SETTINGS-HISTORY-IA-20260915 공동 작업 장부

비-Fable 턴은 fable:append로만 추가한다. 제품 코드 변경 없이 정보 구조를 읽기 전용 검토한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- 대상: 고정 지출 설정 유지 여부와 변경 내역의 화면 소속
- 충족해야 할 요구사항·불변식: 설정은 항목 템플릿 및 최근 1/2/3개월 평균 기준을 소유하고, 월별 금액은 실제 월별 입력으로 달라질 수 있다. 원장과 영업일 스냅샷은 이 IA 검토에서 변경하지 않는다.
- 이번에 바꾼 내용: 없음. 읽기 전용 제품 설계 자문이다. 검수 제안은 구현이나 확정된 정책이 아니다.
- 집중 검토 질문: (1) 설정을 유지할지 삭제할지 하나를 추천하라. (2) 모든 configuration history를 고정 지출 공통 하위 페이지에 둘지, 설정 내부의 설정 변경 내역에만 종속할지 비교하라. (3) 월별 금액 수정, 항목 구성 변경, 계산 기준 변경, 최신 호환 복구가 서로 다른 사건임을 고려해 간결한 이름과 진입 경로를 제안하라. (4) 기존 코드의 재입력 정책을 자동 승인하지 말고 IA 판단의 전제와 미해결 정책을 구분하라.
- 실행한 테스트·현재 증거: Fable 연결 점검은 공식 Claude Code 2.1.260과 로그인 상태에서 통과했다. 이번 요청에서는 실행 시험과 제품 수정을 하지 않았다. 기존 고정 지출 Fable Task는 PROVIDER_HARD_CAP_UNAVAILABLE로 미실행이며 이번 쟁점의 Fable 결론으로 재사용할 수 없다.
- 사람 결정이 필요한 항목: 일반 Fable 검토 요청만 있으며 정확한 회차별 soft cap 초과 결제 위험 수용은 없다. 가드를 우회하지 않는다.
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- 명령: `corepack pnpm fable:check`
- 연결 결과: 종료 코드 0. Claude Code 2.1.260, 로그인됨. 계정 식별정보는 출력하지 않았다.
- 검수 명령: `corepack pnpm fable:review -- --task FIXED-COST-SETTINGS-HISTORY-IA-20260915 --round 1 --single-pass --max-budget-usd 1.00`
- 실행 결과: runner 종료 코드 64, pnpm 종료 코드 1. `PROVIDER_HARD_CAP_UNAVAILABLE`로 외부 모델 프로세스 시작 전에 중단됐다. 이번 호출의 Fable 비용이나 verdict는 발생하지 않았다.
- 차단 근거: `docs/ai-review/README.md` §8 및 `scripts/fable-review.mjs`의 `assertExternalBudgetEnforcement`. CLI max-budget-usd는 결제 하드캡이 아니며, 정확한 회차별 HUMAN_DECISION의 soft cap 초과 위험 수용 없이는 외부 호출을 하지 않는다. 이번 사용자 요청에서 그러한 수용은 확인되지 않았다.
- 기존 기록: `PILOT-FIXED-BASIS-20260914`도 동일한 가드로 미실행이며 실제 Fable review.json/review.md가 없다. 보존된 review.md에서 고정 지출 설정 유지/삭제 또는 configuration history 소속을 직접 판정한 결과는 확인하지 못했다.
- 범위 보존: 제품 코드와 기존 기록은 수정하지 않았다. 이번 Task의 요청·실행 근거만 append했다. 자동 예산 증액, --allow-soft-budget, Opus 우회는 사용하지 않았다.
- next_review_request: `FABLE_REVIEW`

## SOLAR_REQUEST · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-s001`
- 사용자 추가 조건: 고정 지출 수정 내역은 하나만 제공한다. 설정 변경 내역과 월별 금액 변경 내역을 별도 화면이나 별도 이력 목록으로 분리하지 않는다.
- 이번 요청 범위: 기존 Task의 정보 구조 검토 범위 안에서 단일 통합 이력을 전제로 좁힌다. task.json은 변경하지 않는다. 이전 외부 실행은 모델 호출 전에 차단됐고 rounds는 비어 있으므로 검수 예정 회차는 여전히 r001이다.
- 집중 검토 질문: (1) 고정 지출 공통 하위의 단일 수정 내역 화면에서 월별 금액 수정, 항목 구성 변경, 평균 기간 변경, 복구를 시간순으로 통합하는 방식을 검토하라. (2) 설정과 고정 지출 상세의 진입점은 같은 라우트·같은 전체 목록을 열어야 하며 두 번째 이력 화면을 만들지 않는다. (3) 월/종류 표시는 항목 메타데이터로 제공하고 기본 목록에서 설정 사건이나 다개월 사건을 누락하지 않는다. (4) 변경 발생일과 영향 대상 월, 변경 전후 금액·항목·기준 개월 수를 구분하며 복구를 일반 수정과 구별한다. (5) 진행 중 재입력 초안을 확정 변경처럼 표시하지 않으며 복구 가능성은 서버의 최신 상태·호환성 판단을 따른다. (6) 현재 구현에서 이 조건을 만족하지 못하는 구체적인 표시·조회·복구 위험과 최소 수정 범위를 제시하라.
- 제품 변경 상태: 없음. 이 요청은 읽기 전용 검수 준비이며 소스·원장·설정은 변경하지 않는다.
- 외부 호출 조건: fable:check는 Claude Code 2.1.260 및 로그인 상태로 통과했다. 정확한 회차별 soft cap 초과 결제 위험 수용이 없으므로 모델 호출은 하지 않는다. 예정 Task는 FIXED-COST-SETTINGS-HISTORY-IA-20260915, 회차 r001, single-pass, 기술적 soft cap 1.00 USD다. 실제 결제 하드상한으로 표현하지 않는다.
- next_review_request: `FABLE_REVIEW`
