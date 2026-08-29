# P2-1-DEVICE-TIMEZONE-IANA-001 공동 작업 장부

> 이 장부는 기기 시간대 IANA 형식 회귀시험 보강을 검수하는 append-only 기록이다.
> 이 최초 패킷 이후 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `471d17d87b2bfd4d3711b59557004b45f3968798`
- changed_artifact_paths: `apps/mobile/tests/myHours.test.tsx`
- 충족해야 할 요구사항·불변식: `P2-1-1..4`, `AGENTS:server-business-time-authority`, `WORK-QUEUE:P2-1`
- 이번에 바꾼 내용: 기존 `UTC` 기기 시간대 시험을 유지하면서 `Asia/Seoul`처럼 슬래시가 있는 IANA 시간대가 제안 문구에 표시되고 `useSetStoreTimezone`의 서버 저장 인자에 문자열 그대로 전달되는 시험을 한 건 추가했다. 제품 소스는 변경하지 않았다.
- 집중 검토 질문: 기존 UTC 시험과 새 Asia/Seoul 시험이 함께 유효 IANA 형식의 두 대표 형태를 막는가? 새 시험이 표시만 확인하는 데 그치지 않고 실제 저장 mutation 인자까지 검증하는가? 사용자 미커밋 변경이 입력이나 커밋에 섞이지 않았는가?
- 실행한 테스트·현재 증거: `corepack pnpm --filter @sikjae/mobile test -- myHours.test.tsx` 16/16 통과. 사용자 보고 기준 `corepack pnpm verify` 6/6, DB 34/34, core 177, mobile 200, 업그레이드 10/10, 웹 번들 통과. 정확한 feature SHA의 Node 20.19.4·24 원격 CI는 push 전이라 아직 미확인이다.
- 사람 결정이 필요한 항목: 이 읽기 전용 검수에는 없음. 원격 push와 main fast-forward는 같은 SHA CI 성공 뒤 별도 절차로 수행한다.
- applied_learning_ids: `LRN-ORCH-CI-001`
- excluded_learning_ids: `LRN-CODEX-TIME-001`(DB fixture 범위), `LRN-OPS-BACKUP-001`(DB 백업 범위), `LRN-AUDIT-PIN-001`(CANDIDATE)
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=55775a1a485a9da554e14ad1e4d9632545c424c740a41492fca07d8eca32fe82 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `55775a1a485a9da554e14ad1e4d9632545c424c740a41492fca07d8eca32fe82`
- target_commit_sha: `471d17d87b2bfd4d3711b59557004b45f3968798`
- input_files_sha256: `f4465c37dc40713390f364ea6106659cf0ecff230ea1c0a8d21fdda955fd0332`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: P2-1-TEST-UTC-BANNER-TEXT-SYMMETRY, P2-1-OPS-REMOTE-CI-AND-QUEUE-RECORD-PENDING
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

P2-1 기기 시간대 IANA 형식 회귀시험 보강을 읽기 전용으로 검토했다. 제품 경로는 deviceTimezone()이 Intl.DateTimeFormat().resolvedOptions().timeZone을 변형 없이 반환하고(MyHoursScreen.tsx 45-54), 배너 문구 "기기 시간대는 {deviceTz} 예요."(335) → chooseTz(deviceTz)(337) → saveTz.mutate(tz)(263-265) → set_store_timezone의 p_timezone(hooks.ts 503-505)까지 같은 문자열이 그대로 흐른다. 새 시험(myHours.test.tsx 277-291)은 서버 timezone을 'UTC'로 두고 기기를 'Asia/Seoul'로 mock해 제안 값의 출처가 서버 상태가 아니라 Intl임을 구분하며, 제안 문구와 useSetStoreTimezone mutate 첫 인자를 toBe('Asia/Seoul')로 엄격 단언한다(P2-1-2 충족). 기존 UTC 시험(259-275)은 그대로 보존됐고(P2-1-1), 두 시험이 비슬래시·슬래시 IANA 두 대표 형태를 함께 막는다(TEST:UTC-and-slash-IANA-forms). 변경은 시험 한 파일의 공백 포함 16줄(276-291)이며 제품 소스·시간대 정책 변경은 없다(P2-1-3, AGENTS 원칙 7 서버 권위 유지). 입력 파일은 패킷의 6개뿐이고 artifact는 시험 파일 하나로 미커밋 UI 변경이 섞인 흔적은 없다(P2-1-4). 차단 결함은 없어 PASS다. 비차단 Improvement 2건: (1) UTC 시험은 저장 인자만 확인하고 배너 문구는 단언하지 않아 새 시험과 비대칭이므로 한 줄 추가를 제안한다. (2) 정확한 feature SHA의 Node 20.19.4·24 원격 CI는 아직 미확인이고 작업큐 P2-1은 status: 대기이며 완료 조건에 CI 통과가 포함돼 있어, LRN-ORCH-CI-001에 따라 CI 성공 확인 뒤 main fast-forward와 완료 기록 갱신이 별도 절차로 남는다. PASS는 외부 게이트를 닫지 않는다.

### 공동 편집 제안 색인

- P2-1-EDIT-UTC-BANNER-ASSERT: ADD `apps/mobile/tests/myHours.test.tsx` ·       expect(screen.getByText('매장 시간대를 정해 주세요')).toBeTruthy(); · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
