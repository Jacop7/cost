
## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `e09b858fd9f8f3786d49245569f5eb31d4d64aaa`
- changed_artifact_paths: `packages/types/src/international.ts`, `docs/작업큐.md`

### INTL1A-IMP-TAXCATEGORY-DOMAIN

- disposition: `APPLIED`
- 적용 위치: `packages/types/src/international.ts`, `docs/작업큐.md`
- 적용 내용: `TaxRegionCode`와 `TaxCategoryCode` 별칭을 만들고 사용자 자유 입력이나 표시 이름이 아니라 INTL-1B 카탈로그가 소유하는 불변 코드임을 명시했다. 하위 관할은 표준 코드가 있으면 ISO 3166-2를 우선하며 판매 스냅샷은 판매 시점 과세 분류 코드를 그대로 보존한다.
- 반박 또는 부분 적용 근거: 없음. 저장 카탈로그와 허용값 시험은 Finding 완료 조건대로 INTL-1B에서 구현한다.
- 실행한 테스트: `@margincook/types typecheck` exit 0, core 183 passed·3 skipped, `git diff --check` exit 0.
- 필요한 재검수: 같은 Finding의 소유권·값 영역 문서화 충족 여부

- next_review_request: `CODEX_EVIDENCE`
