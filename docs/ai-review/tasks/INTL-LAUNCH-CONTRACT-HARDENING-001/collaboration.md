# INTL-LAUNCH-CONTRACT-HARDENING-001 공동 작업 장부

> 이 장부는 국제 출시 세금 계산·이관·배포·서버 경계의 네 공식 기획 문서를 솔라와 페이블이 함께
> 개선하는 append-only 기록이다. 직접 편집은 이 최초 패킷 작성까지만이며 이후 턴은
> `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `062e313d664dd9cdf914fcc85047ae2257d5ebf5`
- artifact_hashes: 실행기의 manifest와 WORKING snapshot이 네 문서의 정확한 파일별 SHA-256을 봉인한다.
- changed_artifact_paths: `task.json`의 `artifact_paths` 네 파일
- 충족해야 할 요구사항·불변식: `INTL-HARDEN-001..010`, DB RPC 계산 권위, 시점 보존, 전진 migration, 설정 판본·무변경 저장
- 이번에 바꾼 내용: 현재 하루 메뉴·채널 누계 구조에 맞는 관리용 세금 계산선과 구성 항목별 minor unit 반올림, 목표 수량 취소·정정, 프로필 원자 선택, 메뉴 과세 상태, 채널별 납부 주체, legacy·기타 매출 비추정 이관, 국가·통화 불변, 사용자 언어 분리, 구 앱 최소 버전 차단, 최신 main 합류 게이트와 해외 지연 측정 계약을 네 문서에 연결했다.
- 집중 검토 질문: 공식과 반올림·취소가 대수적으로 닫히는가? 현재 DB가 보유하지 않은 과거 의미를 추정하는 경로가 남았는가? 시장/세금 프로필 판본이 갈리거나 중복 적용될 수 있는가? 채널·구성 항목 납부 부채와 과세 상태 소유가 충분한가? cutover·rollback·latest-main 합류 순서가 실데이터와 최신 운영 증거를 보호하는가?
- 실행한 테스트·현재 증거: 현행 0014·0090·0149·0152·0168·0172 및 core locale/recipe 계약을 대조했고, 문서 `git diff --check`를 통과했다. 제품 코드·DB는 수정하지 않았다.
- 사람 결정이 필요한 항목: 새 KRW minor-unit 반올림으로 바뀌는 검산값은 구현 commit에서만 현행 권위 문서·시험과 함께 교체한다. 세무 적합성과 production 배포는 별도 사람 승인이다.
- next_review_request: `FABLE_REVIEW`

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
