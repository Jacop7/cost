# ING-BULK-INBOUND-20260921 공동 작업 장부

> 이 파일은 솔라·페이블·Codex·사람·AI 부 오케스트레이터가 `task.json`의 `artifact_paths`에 지정된
> 같은 공식 산출물을 개선하는 append-only 상호작용 장부다. Fable 턴은 검수 실행기만 추가하고,
> 그 밖의 모든 턴은 `corepack pnpm fable:append -- --task ING-BULK-INBOUND-20260921`로만 맨 아래에
> 추가한다. 이 파일을 직접 편집하거나 과거 턴을 고치거나 지우지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR`
- reply_to_turn_id: `null`
- target_commit_sha: `c7d351ff25093baa6a4f2c6bf0e1650da5c6a74f`
- changed_artifact_paths: `docs/재료-일괄-입고-상세계획안.md`, `apps/mobile/src/features/ingredients/*`,
  `packages/db/supabase/migrations/20260921000144_bulk_quick_inbound.sql`, 관련 시험과 AppMap 연결
- 충족해야 할 요구사항·불변식: 서버 단가 권위, E7·E1 원장, 원자 저장, 요청 키 멱등성,
  응답 유실 복구, 네이티브 이탈 방지, 최대 20개 카드
- 이번에 바꾼 내용: + 추가 메뉴와 ING-12 화면, 카드 입력·미리보기·저장·복구, DB 원자 RPC,
  ACL·동시성·UI 회귀시험을 구현했다.
- 집중 검토 질문: 부분 성공이나 중복 원장이 가능한 경로가 남았는가, 권한 경계와 단가 계산이 기존
  직접 입고 규칙과 같은가, 저장·복구 중 네이티브 뒤로가기로 결과를 잃을 수 있는가.
- 실행한 테스트·현재 증거: `corepack pnpm verify` 6/6 통과. DB 124/124, core 281,
  mobile 1,790, 업그레이드 26/26, 웹 번들 통과. Astra Ultra 최종 `READY`, R0~R3 없음.
- 사람 결정이 필요한 항목: 없음. 네이티브 기기 증거 4종은 정책상 비차단 후속 검수다.
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `ce6b7cae38603bdbfa6fdf1d584f064d66185962`
- finding_ids: `BULK-IMPL-01`, `BULK-IMPL-02`, `BULK-IMPL-03`, `BULK-IMPL-04`
- 실행 명령: `corepack pnpm verify`; 모바일 typecheck; bulkInbound 15시험; DB 35; same-key·distinct-key 경합
- 종료 코드·결과: 전체 기준선 6/6 통과, 최종 보완분 대상 검증 모두 0; Astra READY; Claude 브라우저 재검수 READY·findings none
- 증거 파일·로그 위치: `docs/ai-review/evidence/ING-BULK-INBOUND-IMPLEMENTATION-20260921.md`
- 미실행 항목과 이유: 네이티브 기기 증거 4종은 운영 정책상 비차단 후속. 공식 Fable CLI는 `PROVIDER_HARD_CAP_UNAVAILABLE`로 외부 호출 전 중단.
- next_review_request: `HUMAN_DECISION`
