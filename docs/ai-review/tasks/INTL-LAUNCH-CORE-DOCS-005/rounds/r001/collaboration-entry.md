
<!-- fable-review:r001 sha256=fc8548fead8082df0e5a39f1d493b048efa718388e736546431e44d0d2c2e995 -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `fc8548fead8082df0e5a39f1d493b048efa718388e736546431e44d0d2c2e995`
- target_commit_sha: `e7a7fd0811257cb34dd3b55f3453542d97e73df5`
- input_files_sha256: `dd84c6bd7e758e4f3e5c240f85d383b129344e818a60d8df53dd1611906dc6b3`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

INTL-LAUNCH-CORE-DOCS-005 FABLE-ARCH RECHECK 결과 PASS. predecessor r001의 Finding 5건이 커밋 e7a7fd0의 세 기획안에서 모두 수용 기준을 충족해 VERIFIED로 전환한다. (1) ARCH-INTL004-OPS-STATUS-CONTRADICTION: 브랜치 문서 머리말·§4.5와 서버 문서 채택 상태가 '스테이징 cvfvmpzcldyqurcrappu에 0164~0174 배포 가드 적용, SQL Editor 경로 앱 ACL 감사 4개 지표 0건 실측(배포·ACL 증거 JSON 링크 고정), admin-acl.sh --remote audit 셸 경로는 작업큐 P1-1 대기, production 접근·적용 없음·실측 없으면 배포 중단'이라는 하나의 사실로 통일됐고, ARCHITECTURE.md 옛 기준선은 소급 수정 없이 작업큐 INTL-DOC-SYNC-1 별도 동기화 과업으로 등록됐다. 단 스냅샷에는 산출물·참조 6개 파일만 실체화돼 docs/deployments/*.json과 작업큐.md 링크 대상의 실재는 SOLAR가 협업 장부에 보고한 상대 링크·증거 존재 검사 통과에 의존했다. (2) ARCH-INTL004-TAX-TREATMENT-FORMULA: §3.4가 r0_effective(taxable→r0, zero_rated·exempt→0)·A(treatment)·bi(미포함 1, 포함 1+r0_effective)·M=1+r0_effective+Σ(i∈A)(ri×bi)를 정의하고 applies_to_treatments 명시·빈 값 실패 폐쇄, override 소유 단위·우선순위는 §10 7번 게이트로 등록됐으며 항목 수 표기도 '일곱 항목'으로 일치한다. 숫자 검산 정합: r0=10%·추가세 5% 기본세 포함이면 M=1.155로 미포함 10,000→결제 11,550, 포함 11,550→N 10,000이고 zero_rated는 bi=1·M=1.05, exempt에 적용 추가세가 없으면 M=1이다. 검증 행렬(298행)이 r0_effective·A(treatment)와 1:1 대응한다. (3) ARCH-INTL004-BRANCH-NAMING: §2.2·§8.1이 codex/를 허용 작업유형으로 등록하고 두 INTL-1 계획 브랜치가 slug 규칙(2~4단어, 20~40자)을 따르며 두 문서의 표기가 동일하다. (4) ARCH-INTL004-LEGACY-FORMULA-DESC: §5.1이 판매가 × (Σ tax_items.rate ÷ 100)·퍼센트 포인트로 AGENTS.md 권위 계약과 일치한다. (5) ARCH-INTL004-PRICE-BASIS-OWNER: §4.2가 price_basis 소유 원본을 시장 프로필 하나로 확정하고 세금 프로필 중복 저장을 금지하며 판매 스냅샷도 시장 프로필 값을 굳힌다. DB RPC 계산 권위·시점 스냅샷·전진 migration·현재/계획 상태 분리 불변식은 유지되고 새 모순은 발견하지 못했다. VERIFIED는 로컬 확인이며 PASS·VERIFIED가 외부 게이트를 닫지 않고 gate_state는 OPEN으로 유지된다. 정식 CLOSED 전환은 향후 P0-2 보호 게이트 절차의 몫이다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
