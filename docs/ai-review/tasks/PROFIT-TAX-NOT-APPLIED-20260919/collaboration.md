# PROFIT-TAX-NOT-APPLIED-20260919 공동 작업 장부

> 이 파일은 솔라·페이블·Codex·사람·AI 부 오케스트레이터가 `task.json`의 `artifact_paths`에 지정된
> 같은 공식 산출물을 개선하는 append-only 상호작용 장부다. Fable 턴은 검수 실행기만 추가하고,
> 그 밖의 모든 턴은 `corepack pnpm fable:append -- --task PROFIT-TAX-NOT-APPLIED-20260919`로만 맨 아래에 추가한다.
> 이 파일을 직접 편집하거나 과거 턴을 고치거나 지우지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR`
- reply_to_turn_id: `null`
- target_commit_sha: `a8fe3157f742bbfb6c65b15230157d1ad7e7d7b6`
- input_files_sha256: `검수 실행기 산출`
- artifact_hashes: `검수 실행기 산출`
- changed_artifact_paths: 세금 공식·DB RPC·설정 UI·손익 표시·문서
- 충족해야 할 요구사항·불변식: 세금 미적용은 손익에서 0원, 서버 계산 권위, 과거 스냅샷 보존, 통화 단위 반올림
- 이번에 바꾼 내용: 세금 별도 호환값을 사용자에게 세금 미적용으로 단순화하고 세율·추가 세금·0원 세금 행을 조건부로 숨김
- 집중 검토 질문: core와 DB 공식이 일치하는지, 미적용에서 과세가 누락 없이 0원인지, 기존 확정 기록이 보존되는지
- 실행한 테스트·현재 증거: 타입·관련 core/mobile/DB 시험·fresh migration·업그레이드 26단계·웹 번들 통과. 전체 게이트의 기존 비관련 실패는 별도 기록
- 사람 결정이 필요한 항목: 없음. 사용자가 전체 수정을 요청함
- next_review_request: `FABLE_REVIEW`

<!-- FABLE_REVIEW/FABLE_RECHECK 턴은 실행기가 review 원본 링크와 hash를 아래에 자동 추가한다. -->