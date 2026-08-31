
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- verified_commit_sha: `5e4ffab90ccb0313d5de4c41271f8c8ea969c084`
- finding_ids: `ARCH-INTL004-OPS-STATUS-CONTRADICTION`, `ARCH-INTL004-TAX-TREATMENT-FORMULA`, `ARCH-INTL004-BRANCH-NAMING`, `ARCH-INTL004-LEGACY-FORMULA-DESC`, `ARCH-INTL004-PRICE-BASIS-OWNER`
- artifact_hashes: `docs/국가-통화-세금-국제출시-기획안.md=bb75ca688506a0505e5dc89dfc26e41ac2ed186c41e295ca7ca1ba0a0193fd08`, `docs/브랜치-DB-운영-기획안.md=593a5edf19b36fc2f9d241f3075151a5de1f200dbf6fd18bd5dc794b5833d7d0`, `docs/서버-확장-아키텍처-기획안.md=10f230d035f9b14f14406941d53ddb822ead517ee8181d26900c237ffda53163`, `docs/작업큐.md=97027b50cd9cee1d1042c32d722f7dec6cf2cdc800fa99022955499d88ff9034`
- 실행 명령: `git diff --check`; 변경 문서 상대 링크·배포 증거 파일 존재 검사; 운영 상태·브랜치명·공식·price_basis 문자열 전수 대조; Node 단독 공식 검산
- 종료 코드·결과: 모두 0. 배포·ACL 증거 파일 2개 존재, 깨진 로컬 링크 0개. `taxable`은 `M=1.172`, `zero_rated`·`exempt`는 같은 활성 추가세 집합에서 `M=1.070`이며 포함가 역산이 원래 `N`으로 돌아옴을 확인했다.
- 증거 파일·로그 위치: `docs/deployments/2026-08-29T12-36-00-620Z-staging-f165e23.json`, `docs/deployments/2026-08-29T12-51-42-staging-acl-audit.json`, `docs/ai-review/tasks/INTL-LAUNCH-CORE-DOCS-004/rounds/r001/review.json`
- 미실행 항목과 이유: 문서·프로토타입 전용 수정이므로 제품 전체 `corepack pnpm verify`는 실행하지 않았다. SQL↔core 조합 시험은 INTL-1 구현 완료 조건으로 유지한다.
- remaining_required_finding_ids: r001 기준 3건이며 successor Fable 재검수에서 같은 ID로 확인 요청
- remaining_optional_finding_ids: r001 기준 2건이며 모두 적용 후 successor 재검수 요청
- next_review_request: `AI_DEPUTY_SUCCESSOR_HANDOFF`
