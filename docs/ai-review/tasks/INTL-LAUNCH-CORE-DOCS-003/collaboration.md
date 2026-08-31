# INTL-LAUNCH-CORE-DOCS-003 공동 작업 장부

> 이 장부는 국제 출시·브랜치/DB·서버 개정판 3종을 검수하는 append-only 기록이다.
> 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다.

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
- prior_attempt_note: 더 넓은 `INTL-LAUNCH-PLANNING-002` 패킷은 두 회차 모두 모델 결과 생성 전 회차 상한을 초과해 `RUN_FAILED`로 보존됐고 verdict는 없다. 이 패킷은 사용자 요청의 핵심 개정판 3종으로 검수 범위를 축소했다.
- applied_learning_ids: 없음
- excluded_learning_ids: `LRN-ORCH-CI-001`, `LRN-CODEX-TIME-001`, `LRN-OPS-BACKUP-001`, `LRN-AUDIT-PIN-001`(사유는 task.json)
- next_review_request: `FABLE_REVIEW`
