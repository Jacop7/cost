
## CODEX_EVIDENCE · turn-c003 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `a8fe3157f742bbfb6c65b15230157d1ad7e7d7b6`
- finding_ids: `[]`
- 전체 게이트 1차 결과: `corepack pnpm verify`에서 ① 타입, ⑤ 업그레이드 26/26, ⑥ 웹 번들이 통과했다. ②·④ DB는 118/119였고 원인은 새 내부 trigger 함수의 postgres SECURITY DEFINER 정확 목록 누락이었다. ③은 AppMap 생성 레지스트리와 터치 감사 기준선이 현재 작업 트리보다 뒤처져 실패했다.
- 수정·재검증: 권한 기대 목록을 갱신한 뒤 새 DB SQL 전체 119/119 통과. AppMap 레지스트리 화면 74·route 66·prototype 187·orphan 0, 터치 감사 회귀 66/66, byte artifact manifest와 음성 계약 13/13 통과. 전체 병렬 앱 시험에서 드러난 삭제 확인 동명 버튼 간헐 실패를 대화상자 제목 대기와 정확 버튼 선택으로 고정했다.
- 최종 선택 범위: `corepack pnpm verify --no-db` 종료 0, ① 타입·② core/mobile·③ CLI/ACL/문서/디자인·⑥ 웹 번들 4/6 통과. ④·⑤는 이 명령에서 건너뛰었고, 별도 새 DB 119/119와 앞선 업그레이드 26/26 증거를 보존한다. 같은 최종 작업 트리의 단일 6/6 재실행은 하지 않았으므로 전체 통과라고 표시하지 않는다.
- 전수조사 기준선: 215개 표면·구조 누락 0, RPC 후보 178, mutation 후보 102, 수동 추적 36, 명시적 부분 구현 12, fixture 진입 25. 첫 P1인 동적 판매 채널 세금 저장·상세 단절을 수정하고 회귀를 추가했다.
- 독립검수 상태: Fable round 1은 `PROVIDER_HARD_CAP_UNAVAILABLE`로 외부 호출 전에 중단됐다. Fable 응답·Finding은 없으며 필수 검수는 미완료다.
- next_review_request: `FABLE_REVIEW`
