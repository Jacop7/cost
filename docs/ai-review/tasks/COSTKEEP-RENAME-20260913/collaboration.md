# COSTKEEP-RENAME-20260913 공동 작업 장부

> 이 파일은 솔라·페이블·Codex·사람·AI 부 오케스트레이터가 `task.json`의 `artifact_paths`에 지정된
> 같은 공식 산출물을 개선하는 append-only 상호작용 장부다. Fable 턴은 검수 실행기만 추가하고,
> 그 밖의 모든 턴은 `corepack pnpm fable:append -- --task <COSTKEEP-RENAME-20260913>`로만 맨 아래에 추가한다.
> 이 파일을 직접 편집하거나 과거 턴을 고치거나 지우지 않는다. `reference_paths`와
> `evidence_paths`는 읽기 전용이다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR`
- reply_to_turn_id: `null`
- 이번에 바꾼 내용: 현재 제품 표시와 코드 네임스페이스를 Costkeep/코스트킵으로 전환하고, 기존 데이터와 원장을 유지한 채 로컬 Supabase role·헤더·GUC·Cron·시드 이메일을 0240으로 전진했습니다. iOS/Android ID는 `com.jacop7223.costkeep`으로 맞췄고, 검증 중 발견한 묶음 단위 RPC 검색 경로는 0241로 보강했습니다.
- 집중 검토 질문: 기존 데이터·role OID·권한 보존, 과거 판본 증거의 옛 명칭 보존, 0240/0241의 재실행 안전성, 네이티브 식별자와 현재 브랜드 계약, 미완료 검증의 기록 정확성에서 P0/P1/P2 문제가 있는지 검토해 주세요.
- 실행한 테스트·현재 증거: 전후 핵심 행 수 일치, core 269개·mobile 1,429개·fresh DB SQL 97/97, 0241 집중 사전검증 3/3, ACL DB 지표 0과 셸/소스 스캔 13/13, 0241 추가 전 업그레이드 25/25, 브랜드 계약과 계약 실행기 시험 7/7이 통과했습니다. 전체 verify는 기존 증거 봉인과 병렬 재료 통합 소스 불일치 때문에 통과로 기록하지 않았습니다.
- 사람 결정이 필요한 항목: 원격 Supabase·EAS·스토어 등록과 새 네이티브 빌드는 이번 승인 범위 밖입니다.
- next_review_request: `FABLE_REVIEW`
