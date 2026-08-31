
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-f001`
- verified_target_commit_sha: `e7a7fd0811257cb34dd3b55f3453542d97e73df5`
- verified_review_sha256: `fc8548fead8082df0e5a39f1d493b048efa718388e736546431e44d0d2c2e995`
- verified_run_sha256: `d2552921b8fe842e391c2c7da92cc3586910d522fbdea6ce363693da2edc83ae`
- finding_ids: `ARCH-INTL004-OPS-STATUS-CONTRADICTION`, `ARCH-INTL004-TAX-TREATMENT-FORMULA`, `ARCH-INTL004-BRANCH-NAMING`, `ARCH-INTL004-LEGACY-FORMULA-DESC`, `ARCH-INTL004-PRICE-BASIS-OWNER`
- Fable 결과: `PASS`, 다섯 Finding 모두 `VERIFIED`, 필수·선택 미해결 0건, 새 Finding 0건
- 보조 증거 실재 확인: 스테이징 배포 JSON SHA-256 `20f34131bc3ca31cb10b6422675364f86534231296ac15e5b6b65a0cedc9333f`, ACL 감사 JSON SHA-256 `1a1483177ff82f64d892c4795ccbee3445190fa92341f5fdee82791269817316`, 작업큐 SHA-256 `97027b50cd9cee1d1042c32d722f7dec6cf2cdc800fa99022955499d88ff9034`
- 로컬 검증: `git diff --check`, 변경 문서 상대 링크·증거 파일 존재 검사, 운영 상태·브랜치명·공식·price_basis 문자열 대조, 과세 상태별 숫자 검산 모두 exit 0
- 미실행 항목과 이유: 문서·프로토타입 전용 변경이므로 제품 전체 `corepack pnpm verify`는 실행하지 않았다.
- gate_state: `OPEN`; 로컬 PASS·VERIFIED는 보호 원격 CLOSED 또는 production 배포 승인을 뜻하지 않는다.
- next_review_request: `AI_DEPUTY_GATE_REVIEW`
