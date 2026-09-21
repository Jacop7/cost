# SALES-DRAFT-LIFECYCLE-PLAN-001 공동 작업 장부

> 이 파일은 솔라·페이블·Codex·사람·AI 부 오케스트레이터가 `task.json`의 `artifact_paths`에 지정된
> 같은 공식 산출물을 개선하는 append-only 상호작용 장부다. Fable 턴은 검수 실행기만 추가하고,
> 그 밖의 모든 턴은 `corepack pnpm fable:append -- --task SALES-DRAFT-LIFECYCLE-PLAN-001`로만 맨 아래에 추가한다.
> 이 파일을 직접 편집하거나 과거 턴을 고치거나 지우지 않는다. `reference_paths`와
> `evidence_paths`는 읽기 전용이다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR`
- reply_to_turn_id: `null`
- target_commit_sha: `e169c4b626a74574dcaef599dc9f87f7d6a0c67b`
- input_files_sha256: `검수 실행기 산출`
- artifact_hashes: `[{ path: "docs/매출관리-작성수명주기-전환-기획안.md", sha256: "9f5c29c0bde736ac48bc4404922b8696fd9f0dbb462dde1444413181ff00fba0", change_type: "ADDED" }]`
- changed_artifact_paths: `docs/매출관리-작성수명주기-전환-기획안.md`
- 충족해야 할 요구사항·불변식: 수동 영업 상태 제거, 진짜 서버 초안, 확정 원장 원자성, 지연 확정과 절대 실사의 이중 차감 방지, 서버 날짜·계산 권위
- 이번에 바꾼 내용: 매출 피드·초안·완료·정정, 날짜 기준 판본, E5 컷오프, 이관과 수락 조건을 단일 기획안으로 정의
- 집중 검토 질문: E5 컷오프가 지연 확정 이중 차감을 닫는지, 상태·적용일·만료·이관 규칙에 차단 공백이 없는지
- 실행한 테스트·현재 증거: 문서 정적 검토, Astra Ultra 실제 RPC 대조에서 컷오프 보강 필요 확인 후 반영
- 사람 결정이 필요한 항목: 없음. 사용자가 2026-09-16에 새 수명주기와 단계별 양측 검수 진행을 명시적으로 요청함
- next_review_request: `FABLE_REVIEW`

<!-- FABLE_REVIEW/FABLE_RECHECK 턴은 실행기가 review 원본 링크와 hash를 아래에 자동 추가한다. -->
