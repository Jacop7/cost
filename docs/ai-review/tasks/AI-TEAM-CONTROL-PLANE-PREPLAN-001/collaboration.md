# AI-TEAM-CONTROL-PLANE-PREPLAN-001 공동 작업 장부

> 이 작업은 새 기획안을 먼저 쓰지 않는다. 기존 다섯 공식 기획안을 기준으로 사용자가 합의한
> 다중 채팅·부서·토큰 관리·배포 게이트 구조를 Fable이 선행 검토하고, 그 결과를 다음 공식 개정의
> 입력으로 사용한다. 이후 턴은 `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `933262b1f193d1b4cacbb7c2fb08564592cdf419`
- input_files_sha256: `r001 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/팀구성_상세기획안.md, sha256: fb695ac180f98c66ec9f5a2a3f4dcf863b32b238d6d5f2a6966f19d7b704296c, change_type: UNCHANGED }, { path: docs/AI-지식-온톨로지-기획안.md, sha256: 8c0de404951dd133c9757163bdc1f273759482f919392363cf2c10590a454111, change_type: UNCHANGED }, { path: docs/AI-오케스트레이션-상세기획안.md, sha256: 83b14cba83a919d32072c3dbb14e6fc4013b2e5dc2b61e7d6c706ba0d6986f9c, change_type: UNCHANGED }, { path: docs/디렉터리-문서신경망-재설계-기획안.md, sha256: 059ebaab6429035598d2ec876861107c555fd6c348c341267d2ff000c758af48, change_type: UNCHANGED }, { path: docs/AI-품질-학습-자율성-평가기획안.md, sha256: 1ccbe0db830e11d3d6ea12eef584bb3f014f2a51a7e565b8dfdd5c79a16aecfc, change_type: UNCHANGED }]`
- changed_artifact_paths: `없음 — 기획안 작성 전 구조 검토 단계`
- 충족해야 할 요구사항·불변식: 다중 채팅에서도 저장소 공식본이 권위이고, 상황실·조정실·Task 채팅이 경쟁 장부를 만들지 않으며, 사람의 운영 승인과 독립 품질 판정이 보존돼야 한다.
- 이번에 바꾼 내용: 공식 기획안은 아직 바꾸지 않았다. 마스터 작업 5개 채팅과 부서 그룹 6개 채팅, 전 부서에 적용되는 부 오케스트레이터·토큰 관리자, Task 채팅 수명주기, 개발/운영 배포 게이트 분리를 변경 제안으로 고정했다.
- 집중 검토 질문: 제안이 기존 다섯 기획안과 하나의 네트워크로 이어지는가? 채팅 수가 과하거나 빠진 통제실이 있는가? 모든 팀 상황실과 _shared 제어면이 중복 권위를 만드는가? 토큰 관리자와 부 오케스트레이터의 권한이 과도하지 않은가? Data Backend와 Server Supabase Operations 경계가 실제 업무에서 충돌하지 않는가? 개발·스테이징과 운영 배포 채팅을 분리하는 것이 안전한가? 공식 개정 전에 확정해야 할 사람 결정은 무엇인가?
- 실행한 테스트·현재 증거: 기존 5개 기획안 상호작용 시뮬레이션과 공식 Fable 감사 기록이 있으며, 이번 제안은 아직 구현·문서 변경 전이라 구조 대조만 요청한다.
- 사람 결정이 필요한 항목: 최종 채팅 이름과 개수, 모든 팀 상황실의 쓰기 권한, Task 채팅 종료 기준, 초기 _shared 문서 최소 집합은 Fable 지적을 받은 뒤 사람이 확정한다.
- next_review_request: `FABLE_REVIEW`

