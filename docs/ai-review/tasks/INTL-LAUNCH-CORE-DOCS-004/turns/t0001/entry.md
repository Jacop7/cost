
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `99cd21f272d08465e91b685b80989a04a0c5d6af`
- changed_artifact_paths: `docs/국가-통화-세금-국제출시-기획안.md`, `docs/브랜치-DB-운영-기획안.md`, `docs/서버-확장-아키텍처-기획안.md`
- 충족해야 할 요구사항·불변식: `INTL-CORE-001..008`, DB RPC 계산 권위, 시점 스냅샷, 전진 migration, 현재 구현과 계획 상태 분리
- 이번에 바꾼 내용: 다섯 국가·두 언어 출시 범위, 국가별 통화·로케일·시간대·세금 용어, 기본세 포함 여부와 추가세별 계산 기준, 확정 스냅샷, 브랜치·DB 전진 배포·복구, 서버 확장 보류 판단을 세 공식 개정판에 연결했다.
- 집중 검토 질문: 세 문서 사이에 출시 범위·상태·구현 순서 모순이 있는가? 포함·미포함 및 추가세 수식에 이중 과세·누락 가능성이 있는가? DB 권위·revision·스냅샷·복구 계약이 충분한가? 제품이 세율을 자동 판정하거나 신고를 대행한다고 오인할 표현이 있는가?
- 실행한 테스트·현재 증거: Markdown 링크 확인, 프로토타입 스크립트 문법 확인, `git diff --check`, `corepack pnpm fable:check`, `corepack pnpm fable:self-test` 통과. 문서·프로토타입 전용 변경이라 제품 전체 `corepack pnpm verify`는 실행하지 않았다.
- 사람 결정이 필요한 항목: 국가·지역별 실제 세율과 신고 규칙은 출시 전 공식 기관·현지 전문가 확인이 필요하다.
- prior_attempt_note: 넓은 패킷과 앞선 핵심 문서 패킷은 모델 결과 생성 전 회차 상한 초과로 `RUN_FAILED`가 됐고 verdict는 없다. 사용자가 추가 실행 한도 최대 4.00 USD를 승인했으므로 이번 신규 패킷은 첫 회차에 3.90 USD를 배정한다.
- applied_learning_ids: 없음
- excluded_learning_ids: `LRN-ORCH-CI-001`, `LRN-CODEX-TIME-001`, `LRN-OPS-BACKUP-001`, `LRN-AUDIT-PIN-001`(사유는 task.json)
- next_review_request: `HUMAN_DECISION`
