
<!-- fable-review:r002 sha256=df6f4d1b5a7ef81b01f3d485ded3bb6639bffce8475306bb46868301e0c3926f -->
## FABLE_REVIEW · turn-f002 · r002

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `df6f4d1b5a7ef81b01f3d485ded3bb6639bffce8475306bb46868301e0c3926f`
- target_commit_sha: `062e313d664dd9cdf914fcc85047ae2257d5ebf5`
- input_files_sha256: `3c8d74ad0ed1752f0ca1b6cabd718b14d0e3ca60c09f9b59c82f02e4137f7b4d`
- 원본 검수: [r002/review.md](./rounds/r002/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: INTL-HARDEN-F001-PROTOTYPE-LINK-UNVERIFIED
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

INITIAL 검수 결과 PASS. 네 기획 문서는 INTL-HARDEN-001..010을 모두 다루며 상호 모순이 없다. (1) 계산 계약: §3.4 공식 M=1+r0_effective+Σ(ri×bi)와 §3.5 구성 항목별 minor unit 반올림 아래 KR 포함가 12,000원(순매출 10,909·세금 1,091·결제 12,000)과 USD 미포함 10.00(기본세 1.00·포함 기준 추가세 0.55·결제 11.55), 포함가 11.55 역산이 모두 대수적으로 정확히 닫힌다. 목표 수량 재호출·부분 감소·전체 취소는 반올림 완료된 목표 세액 간 차이 이벤트로 정의되어 음수 재반올림 모호성이 없다. (2) 현재 DB 대응: 0090 tax_of의 판매가×Σ(rate/100), 0014 daily_sales_items의 채널 3수량 누계, core locale.ts의 정확히 10개 locale(자동 이관 2·수동 확인 8)이 문서 §5.1·§3.0·§1.3 주장과 일치하며, 과거 판매·etc_tax_rate는 legacy_effective_rate_v1 합계 보존으로 역산 경로가 없다. (3) 프로필 원자성: 시장·세금 프로필은 불변 ID·적용 구간·revision을 갖고 판매 RPC가 영업일 잠금 뒤 한 트랜잭션에서 선택해 스냅샷에 고정하며, 구간 중복·잘못된 국가-지역 조합은 검증 행렬에서 실패 폐쇄된다. (4) 납부 주체는 구성 항목×채널 단위이고 판매 전체 단일 remittance_owner를 금지한다. (5) cutover: capability/최소 앱 버전 게이트 선배포→CLIENT_UPGRADE_REQUIRED 실패 폐쇄→새 계약 판매 발생 후 구 계산 rollback 금지·전진 수정이 세금 기획안 §8, 브랜치-DB 운영안 rollback 블록·§5.2.1, 작업큐 INTL-1 YAML에서 동일하게 진술된다. (6) INTL-BASELINE-1이 최신 main(eb78b650·166개·0177)과 스테이징 0177 운영 증거 2건 합류를 구현 전 선행 게이트로 두며 세 문서의 기준 SHA가 일치한다. (7) 서버: Supabase RPC 권위 유지, §2.4.1에 측정 위치 5곳·경로 5종·표본 200회/7일·초기 SLO(조회 p95 800ms·저장 p95 1,500ms·오류율 1%)와 승급 전 완화 우선 조건이 명시되어 과도한 선제 분리가 없다. (8) 검증 행렬은 SQL↔core 검산, E9 취소·정정, 미국·캐나다 지역 변형, upgrade, 구 앱 차단을 구현 순서 1A~1F에 연결한다. 유일한 비차단 Improvement 1건: 세금 기획안 12행의 프로토타입 상대 링크(./prototypes/international-tax-settings.html)가 봉인 스냅샷 밖이라 존재를 확인할 수 없어, INTL-BASELINE-1 상대 링크 검사에 프로토타입 경로를 명시하도록 제안했다. PASS·VERIFIED는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 유지된다.

### 공동 편집 제안 색인

- INTL-HARDEN-E001-LINK-CHECK-SCOPE: REPLACE `docs/작업큐.md` ·   `git diff --check`, 상대 링크 검사, Fable 재검수 입력 hash를 확인한다. · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r002 -->
