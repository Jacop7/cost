# INTL-LAUNCH-CONTRACT-HARDENING-001 Fable 검수 — r002

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `062e313d664dd9cdf914fcc85047ae2257d5ebf5`

## 요약

INITIAL 검수 결과 PASS. 네 기획 문서는 INTL-HARDEN-001..010을 모두 다루며 상호 모순이 없다. (1) 계산 계약: §3.4 공식 M=1+r0_effective+Σ(ri×bi)와 §3.5 구성 항목별 minor unit 반올림 아래 KR 포함가 12,000원(순매출 10,909·세금 1,091·결제 12,000)과 USD 미포함 10.00(기본세 1.00·포함 기준 추가세 0.55·결제 11.55), 포함가 11.55 역산이 모두 대수적으로 정확히 닫힌다. 목표 수량 재호출·부분 감소·전체 취소는 반올림 완료된 목표 세액 간 차이 이벤트로 정의되어 음수 재반올림 모호성이 없다. (2) 현재 DB 대응: 0090 tax_of의 판매가×Σ(rate/100), 0014 daily_sales_items의 채널 3수량 누계, core locale.ts의 정확히 10개 locale(자동 이관 2·수동 확인 8)이 문서 §5.1·§3.0·§1.3 주장과 일치하며, 과거 판매·etc_tax_rate는 legacy_effective_rate_v1 합계 보존으로 역산 경로가 없다. (3) 프로필 원자성: 시장·세금 프로필은 불변 ID·적용 구간·revision을 갖고 판매 RPC가 영업일 잠금 뒤 한 트랜잭션에서 선택해 스냅샷에 고정하며, 구간 중복·잘못된 국가-지역 조합은 검증 행렬에서 실패 폐쇄된다. (4) 납부 주체는 구성 항목×채널 단위이고 판매 전체 단일 remittance_owner를 금지한다. (5) cutover: capability/최소 앱 버전 게이트 선배포→CLIENT_UPGRADE_REQUIRED 실패 폐쇄→새 계약 판매 발생 후 구 계산 rollback 금지·전진 수정이 세금 기획안 §8, 브랜치-DB 운영안 rollback 블록·§5.2.1, 작업큐 INTL-1 YAML에서 동일하게 진술된다. (6) INTL-BASELINE-1이 최신 main(eb78b650·166개·0177)과 스테이징 0177 운영 증거 2건 합류를 구현 전 선행 게이트로 두며 세 문서의 기준 SHA가 일치한다. (7) 서버: Supabase RPC 권위 유지, §2.4.1에 측정 위치 5곳·경로 5종·표본 200회/7일·초기 SLO(조회 p95 800ms·저장 p95 1,500ms·오류율 1%)와 승급 전 완화 우선 조건이 명시되어 과도한 선제 분리가 없다. (8) 검증 행렬은 SQL↔core 검산, E9 취소·정정, 미국·캐나다 지역 변형, upgrade, 구 앱 차단을 구현 순서 1A~1F에 연결한다. 유일한 비차단 Improvement 1건: 세금 기획안 12행의 프로토타입 상대 링크(./prototypes/international-tax-settings.html)가 봉인 스냅샷 밖이라 존재를 확인할 수 없어, INTL-BASELINE-1 상대 링크 검사에 프로토타입 경로를 명시하도록 제안했다. PASS·VERIFIED는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 유지된다.

## Findings

### INTL-HARDEN-F001-PROTOTYPE-LINK-UNVERIFIED — Improvement / OPEN

- 범주: OTHER
- 영향: 합류·재검수 시 상대 링크 검사가 프로토타입 경로를 누락하면 단일 출처 문서가 존재하지 않는 파일을 가리킬 수 있다. 계산·이관 계약에는 영향이 없는 비차단 개선 항목이다.
- 근거: docs/국가-통화-세금-국제출시-기획안.md:12, docs/작업큐.md:174
- 완료 조건: INTL-BASELINE-1의 상대 링크 검사 범위에 docs/prototypes 경로가 명시되거나, 다음 검수 스냅샷에서 해당 프로토타입 파일 존재가 확인된다.
- 필요한 테스트: INTL-BASELINE-1 합류 시 네 문서의 전체 상대 링크(프로토타입 포함) 유효성 검사

## 공동 편집 제안

### INTL-HARDEN-E001-LINK-CHECK-SCOPE — REPLACE

- 대상: `docs/작업큐.md`
- 위치:   `git diff --check`, 상대 링크 검사, Fable 재검수 입력 hash를 확인한다.
- 연결 Finding: INTL-HARDEN-F001-PROTOTYPE-LINK-UNVERIFIED
- 이유: 세금 기획안 12행의 프로토타입 링크가 검수 스냅샷 밖이므로 INTL-BASELINE-1 링크 검사 범위에 프로토타입 경로를 명시해 누락을 방지한다.

      `git diff --check`, 프로토타입(`docs/prototypes/`) 경로를 포함한 상대 링크 검사, Fable 재검수 입력 hash를 확인한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
