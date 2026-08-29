# P2-6-ACL-AUDIT-EVIDENCE-001 공동 작업 장부

> P1-1 지원 시험 후속 Improvement 네 건을 반영한 확정 commit을 보안 관점에서 독립 검수한다.
> Fable 턴은 검수 실행기만 추가하며 이 장부를 직접 편집하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `e4118d1fae1b05fd94ba27ffd78893f84dc4e8b4`
- changed_artifact_paths: `packages/db/scripts/admin-acl-audit.test.mjs`, `packages/db/scripts/admin-acl-source-scan.mjs`, `packages/db/scripts/admin-acl-source-scan.test.mjs`, `packages/db/scripts/admin-acl-audit.sql`, `scripts/verify.mjs`, `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- 충족해야 할 요구사항·불변식: 구조 분해·계산 키 RPC 우회 차단, 누락 루트 실패, DB 인식 허용목록, 실제 stdout·Git blob 판본 결속.
- 이번에 바꾼 내용: 모바일 RPC AST 스캔을 독립 모듈과 6개 회귀시험으로 분리하고, 감사 SQL 임시 표를 PostgreSQL이 직접 내보내도록 했다. P2-6 증거에 실행 stdout과 V1·V2·현재 blob OID를 추가했다.
- 집중 검토 질문: 새 스캐너에 남은 실용적 우회 또는 오탐이 있는지, DB 임시 표 내보내기가 rollback·metric 계약을 약화하지 않는지, 증거가 실제 실행 판본을 충분히 고정하는지.
- 실행한 테스트·현재 증거: `corepack pnpm verify` 6/6 exit 0, DB 34/34, 업그레이드 10/10, `fresh_%` 0개. 독립 증거는 `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`에 보존했다.
- 사람 결정이 필요한 항목: 없음. 운영 DB 원격 audit·적용은 별도 작업큐 범위다.
- next_review_request: `FABLE_REVIEW`

