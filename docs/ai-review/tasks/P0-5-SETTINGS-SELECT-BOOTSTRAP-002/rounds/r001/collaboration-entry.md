
<!-- fable-review:r001 sha256=c535575e84447af3329a36698ac0f21eaeb3a5d775dc3a090cad1e0c6a2851f2 -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `c535575e84447af3329a36698ac0f21eaeb3a5d775dc3a090cad1e0c6a2851f2`
- target_commit_sha: `e1da2a5c7402a082d4ed374844da9d4d7d7e85f5`
- input_files_sha256: `fbb172193155bdaf8e6734a1e45713bed3b04be7f0868c0b13c642f61862034b`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

predecessor Finding 4건을 같은 ID로 재검증했고 모두 VERIFIED다. (SEC-001) 증거 문서 389~451행이 최종 보정 commit `710176c`의 verify 6/6·DB 34/34·업그레이드 10/10·fresh_% 0개를 commit SHA와 함께 기록하고, 0164·upgrade-check.sh의 Git blob OID·SHA-256 표를 고정했으며, 그 값(`3f0cb476…`/`f9151ab0…`, `1754c179…`/`3c82982f…`)이 이번 target `e1da2a5c`의 검수 입력 manifest와 정확히 일치한다 — 즉 검증된 blob과 검수 대상 blob이 동일함을 검수자가 독립 확인할 수 있다. baseline diff가 0164 한 파일임과 fb5b4b08↔ff342e08 차이가 문서뿐임도 명시돼 장부·문서 모순이 해소됐다. 이전 실패 기록(331~387행)은 덮어쓰지 않고 보존됐다. (SEC-002) 0164 사후조건 178~183행이 insert·update·delete·truncate 네 종을 `has_table_privilege`로 검사하고, PUBLIC TRUNCATE 사보타주 시 종료 코드 3으로 중단한 기록이 있다. (SEC-003) 187~196행이 `relrowsecurity`=true와 polcmd='r' 정책 존재를 단언하고, RLS 비활성 사보타주 중단 기록이 있다. 197행은 polcmd<>'r'로 ALL('*') 정책까지 쓰기로 취급해 빈틈이 없다. (SEC-004) upgrade-check.sh ⑩ 446~455행이 사전 5튜플을 정확히 `f|t|t|t|f|`가 아닌 `f|t|t|t|t`로 요구하고 불일치 시 '전제가 안 섰다' FAIL 처리하며, 쓰기 선회수 상태(f|f|f|f|f)가 전제 실패로 구분됨을 문서가 기록한다. 보안 관점의 신규 결함은 없다: SELECT 부여는 RLS·읽기 정책 단언에 결속되고, save_settings·save_store_tax는 definer + search_path + 첫 줄 assert_my_store를 유지하며, 스테이징 0163·운영 미접근 기록은 정직하다. 사소한 보완으로 710176c→e1da2a5c 사이 변경이 문서뿐임을 한 줄 명시하는 proposed_edit을 제안한다(비차단). Blocker~Minor 미해결 없음 → PASS. 외부 게이트(보호 CI·스테이징 적용)는 여전히 OPEN이다.

### 공동 편집 제안 색인

- P0-5-SSB-002-EDIT-001: ADD `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md` · 아래 값은 워킹트리가 아니라 `710176c267a9874e58152880ade135970738f76a`의 Git blob bytes를 · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
