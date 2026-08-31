
## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `0aaed6c3a50929fa115a23004070544b1732c17cb943a3b3ac92472ecbf31b9f`
- remediation_commit_sha: `5e4ffab90ccb0313d5de4c41271f8c8ea969c084`
- changed_artifact_paths: `docs/국가-통화-세금-국제출시-기획안.md`, `docs/브랜치-DB-운영-기획안.md`, `docs/서버-확장-아키텍처-기획안.md`
- supporting_official_path: `docs/작업큐.md`

### ARCH-INTL004-OPS-STATUS-CONTRADICTION

- disposition: `APPLIED`
- 적용 위치: 브랜치 문서 머리말·§2.2·§4.5, 서버 문서 채택 상태, 작업큐 `INTL-DOC-SYNC-1`
- 적용 내용: 스테이징 사실을 `0164~0174 적용 + SQL Editor 앱 ACL 감사 완료`로 고정하고, 직접 libpq 자격이 필요한 원격 셸 래퍼는 대기, production은 미적용으로 분리했다. P0-5 완료 지표와 배포·ACL 증거 JSON을 직접 링크했다. `ARCHITECTURE.md` 기준선 동기화는 별도 문서 작업 `INTL-DOC-SYNC-1`로 등록했다.
- 필요한 재검수: 세 기획안에서 스테이징 SQL 실측·원격 셸 대기·production 미적용이 한 가지 사실로 유지되는지 확인

### ARCH-INTL004-TAX-TREATMENT-FORMULA

- disposition: `APPLIED`
- 적용 위치: 국제 출시 기획안 §3.4·§4.2·§7·§10
- 적용 내용: `r0_effective`, 과세 상태별 활성 추가세 집합 `A(treatment)`, `bi`, `M`을 정의했다. 추가세마다 `applies_to_treatments`를 명시하고 누락·모호함은 실패 폐쇄한다. 과세 상태 override의 소유 단위와 우선순위를 구현 전 7번째 게이트로 등록했다.
- 필요한 재검수: zero_rated·exempt × 포함·미포함 × 추가세 기준 조합이 공식과 검증 행렬에 1:1로 대응하는지 확인

### ARCH-INTL004-BRANCH-NAMING

- disposition: `APPLIED`
- 적용 위치: 브랜치 문서 §2.2·§8.1
- 적용 내용: Codex가 만드는 단명 작업의 `codex/<기능영역>-<변경목적>`을 허용 접두어로 등록하고 `codex/international-launch`·`codex/international-tax-legacy-cleanup`이 같은 slug 규칙을 따르도록 했다.
- 필요한 재검수: §2.2·§3.3·§8.1과 국제 출시 기획안의 브랜치명 문자열 일치 확인

### ARCH-INTL004-LEGACY-FORMULA-DESC

- disposition: `APPLIED`
- 적용 위치: 국제 출시 기획안 §5.1
- 적용 내용: 현재 `tax_of()`를 `판매가 × (Σ tax_items.rate ÷ 100)`으로 바로잡고 `rate`가 퍼센트 포인트임을 명시했다.
- 필요한 재검수: AGENTS.md·ARCHITECTURE.md의 0090 공식과 단위 일치 확인

### ARCH-INTL004-PRICE-BASIS-OWNER

- disposition: `APPLIED`
- 적용 위치: 국제 출시 기획안 §4.1~§4.3
- 적용 내용: `price_basis` 소유 원본을 시장 프로필 하나로 고정하고 세금 프로필의 중복 필드를 제거했다. 판매 스냅샷에 `market_profile_revision`을 추가해 출처를 고정했다.
- 필요한 재검수: 두 revision이 갈릴 수 있는 복제 경로가 제거됐는지 확인

- next_review_request: `CODEX_EVIDENCE`
