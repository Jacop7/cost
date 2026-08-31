# INTL-LAUNCH-CORE-DOCS-005 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `e7a7fd0811257cb34dd3b55f3453542d97e73df5`

## 요약

INTL-LAUNCH-CORE-DOCS-005 FABLE-ARCH RECHECK 결과 PASS. predecessor r001의 Finding 5건이 커밋 e7a7fd0의 세 기획안에서 모두 수용 기준을 충족해 VERIFIED로 전환한다. (1) ARCH-INTL004-OPS-STATUS-CONTRADICTION: 브랜치 문서 머리말·§4.5와 서버 문서 채택 상태가 '스테이징 cvfvmpzcldyqurcrappu에 0164~0174 배포 가드 적용, SQL Editor 경로 앱 ACL 감사 4개 지표 0건 실측(배포·ACL 증거 JSON 링크 고정), admin-acl.sh --remote audit 셸 경로는 작업큐 P1-1 대기, production 접근·적용 없음·실측 없으면 배포 중단'이라는 하나의 사실로 통일됐고, ARCHITECTURE.md 옛 기준선은 소급 수정 없이 작업큐 INTL-DOC-SYNC-1 별도 동기화 과업으로 등록됐다. 단 스냅샷에는 산출물·참조 6개 파일만 실체화돼 docs/deployments/*.json과 작업큐.md 링크 대상의 실재는 SOLAR가 협업 장부에 보고한 상대 링크·증거 존재 검사 통과에 의존했다. (2) ARCH-INTL004-TAX-TREATMENT-FORMULA: §3.4가 r0_effective(taxable→r0, zero_rated·exempt→0)·A(treatment)·bi(미포함 1, 포함 1+r0_effective)·M=1+r0_effective+Σ(i∈A)(ri×bi)를 정의하고 applies_to_treatments 명시·빈 값 실패 폐쇄, override 소유 단위·우선순위는 §10 7번 게이트로 등록됐으며 항목 수 표기도 '일곱 항목'으로 일치한다. 숫자 검산 정합: r0=10%·추가세 5% 기본세 포함이면 M=1.155로 미포함 10,000→결제 11,550, 포함 11,550→N 10,000이고 zero_rated는 bi=1·M=1.05, exempt에 적용 추가세가 없으면 M=1이다. 검증 행렬(298행)이 r0_effective·A(treatment)와 1:1 대응한다. (3) ARCH-INTL004-BRANCH-NAMING: §2.2·§8.1이 codex/를 허용 작업유형으로 등록하고 두 INTL-1 계획 브랜치가 slug 규칙(2~4단어, 20~40자)을 따르며 두 문서의 표기가 동일하다. (4) ARCH-INTL004-LEGACY-FORMULA-DESC: §5.1이 판매가 × (Σ tax_items.rate ÷ 100)·퍼센트 포인트로 AGENTS.md 권위 계약과 일치한다. (5) ARCH-INTL004-PRICE-BASIS-OWNER: §4.2가 price_basis 소유 원본을 시장 프로필 하나로 확정하고 세금 프로필 중복 저장을 금지하며 판매 스냅샷도 시장 프로필 값을 굳힌다. DB RPC 계산 권위·시점 스냅샷·전진 migration·현재/계획 상태 분리 불변식은 유지되고 새 모순은 발견하지 못했다. VERIFIED는 로컬 확인이며 PASS·VERIFIED가 외부 게이트를 닫지 않고 gate_state는 OPEN으로 유지된다. 정식 CLOSED 전환은 향후 P0-2 보호 게이트 절차의 몫이다.

## Findings

### ARCH-INTL004-OPS-STATUS-CONTRADICTION — Major / VERIFIED

- 범주: OPERATIONS
- 검증 엔진: FABLE
- 영향: 배포·복구 단일 출처의 내부 모순이 해소돼 INTL-1 schema 배포 시 §5.3·§5.4 게이트 판정 기준이 하나의 사실(스테이징 SQL 실측 완료·셸 경로 대기·production 미확인·실측 없으면 중단)로 고정됐다. 잔여 위험은 링크된 증거 파일 실재를 이 스냅샷에서 독립 확인하지 못한 점뿐이다.
- 근거: docs/브랜치-DB-운영-기획안.md:10, docs/브랜치-DB-운영-기획안.md:343, docs/브랜치-DB-운영-기획안.md:355, docs/서버-확장-아키텍처-기획안.md:27, ARCHITECTURE.md:153, COLLABORATION_LOG:0
- 완료 조건: 브랜치 문서 머리말·§4.5와 서버 문서 채택 상태가 스테이징 적용 범위, ACL 실측 수행 경로, P0-5 완료·잔여 범위, 원격 audit 잔여 확인 항목을 하나의 사실로 서술한다. / 확인되지 않은 상태는 모두 '미확인'으로 표기하고 작업큐·배포 기록의 실측 근거를 링크한다. / ARCHITECTURE.md 기준선(0173·스테이징 미확인)과의 동기화가 별도 과업으로 등록된다.
- 필요한 테스트: 세 산출물과 작업큐·배포 기록의 스테이징 적용·ACL·P0-5 상태 서술 전수 대조 검토 / docs/deployments/ 증거 JSON 2건과 작업큐.md INTL-DOC-SYNC-1·P1-1 앵커의 실재 확인(전체 저장소 스냅샷에서)

### ARCH-INTL004-TAX-TREATMENT-FORMULA — Minor / VERIFIED

- 범주: ARCHITECTURE
- 검증 엔진: FABLE
- 영향: SQL↔core 검산의 기준 공식에 과세 상태 분기가 명문화돼 exempt·zero_rated 매장의 포함가 역산과 기본세 포함 기준 추가세 계산이 구현자 재량 없이 결정된다. 검증 행렬의 과세 상태 시험을 작성할 수 있는 상태다.
- 근거: docs/국가-통화-세금-국제출시-기획안.md:119, docs/국가-통화-세금-국제출시-기획안.md:152, docs/국가-통화-세금-국제출시-기획안.md:296, docs/국가-통화-세금-국제출시-기획안.md:334
- 완료 조건: §3.4에 과세 상태별 유효 r0 치환 규칙과 그때의 bi·M 변화가 명시된다. / 과세 상태가 추가세 부과 여부에 미치는 영향과 과세 상태의 소유 단위(매장·메뉴·채널)가 §10 확정 게이트 항목으로 등록된다. / 검증 행렬의 일반 과세·0% 과세·면세 조합이 명시된 공식과 1:1로 대응한다.
- 필요한 테스트: INTL-1 구현 시 zero_rated·exempt × 포함·미포함 가격 × 추가세 기준(포함·미포함) × applies_to_treatments 조합의 SQL↔core 검산 시험

### ARCH-INTL004-BRANCH-NAMING — Minor / VERIFIED

- 범주: POLICY
- 검증 엔진: FABLE
- 영향: 명명 규칙과 INTL-1 계획 브랜치명이 일치해 브랜치 생성·병합·정리 자동화나 후속 검수가 규칙 기준으로 판정해도 충돌이 없다.
- 근거: docs/브랜치-DB-운영-기획안.md:105, docs/브랜치-DB-운영-기획안.md:554, docs/국가-통화-세금-국제출시-기획안.md:10, docs/국가-통화-세금-국제출시-기획안.md:312
- 완료 조건: §8.1(및 §2.2) 명명 규칙과 INTL-1 계획 브랜치명이 일치한다: codex/ 접두어를 허용 작업유형으로 등록하거나 두 브랜치명을 기존 규칙에 맞게 변경한다. / 국제 출시 기획안과 브랜치 문서의 브랜치명 표기가 동일하게 유지된다.
- 필요한 테스트: 두 산출물의 브랜치명 표기와 §8.1 규칙의 문자열 대조 검토

### ARCH-INTL004-LEGACY-FORMULA-DESC — Improvement / VERIFIED

- 범주: OTHER
- 검증 엔진: FABLE
- 영향: 현재 0090 계약 서술이 권위 공식과 일치해 이관 감사(§5.2)와 검산 작성 시 요율 단위 오독 여지가 사라졌다.
- 근거: docs/국가-통화-세금-국제출시-기획안.md:238, AGENTS.md:54
- 완료 조건: §5.1의 현재 tax_of() 서술이 AGENTS.md·ARCHITECTURE.md의 '요율 ÷ 100(퍼센트 포인트)' 계약과 일치한다.
- 필요한 테스트: 없음

### ARCH-INTL004-PRICE-BASIS-OWNER — Improvement / VERIFIED

- 범주: ARCHITECTURE
- 검증 엔진: FABLE
- 영향: price_basis 소유가 단일화돼 두 프로필의 revision이 독립적으로 돌아도 값 분기 위험이 없고 판매 스냅샷의 출처가 하나로 고정됐다.
- 근거: docs/국가-통화-세금-국제출시-기획안.md:175, docs/국가-통화-세금-국제출시-기획안.md:190, docs/국가-통화-세금-국제출시-기획안.md:213
- 완료 조건: price_basis의 소유 프로필이 하나로 확정되고 다른 쪽은 파생·검증 값임이 §4에 명시된다.
- 필요한 테스트: 없음

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
