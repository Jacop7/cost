# P2-1-DEVICE-TIMEZONE-IANA-001 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `471d17d87b2bfd4d3711b59557004b45f3968798`

## 요약

P2-1 기기 시간대 IANA 형식 회귀시험 보강을 읽기 전용으로 검토했다. 제품 경로는 deviceTimezone()이 Intl.DateTimeFormat().resolvedOptions().timeZone을 변형 없이 반환하고(MyHoursScreen.tsx 45-54), 배너 문구 "기기 시간대는 {deviceTz} 예요."(335) → chooseTz(deviceTz)(337) → saveTz.mutate(tz)(263-265) → set_store_timezone의 p_timezone(hooks.ts 503-505)까지 같은 문자열이 그대로 흐른다. 새 시험(myHours.test.tsx 277-291)은 서버 timezone을 'UTC'로 두고 기기를 'Asia/Seoul'로 mock해 제안 값의 출처가 서버 상태가 아니라 Intl임을 구분하며, 제안 문구와 useSetStoreTimezone mutate 첫 인자를 toBe('Asia/Seoul')로 엄격 단언한다(P2-1-2 충족). 기존 UTC 시험(259-275)은 그대로 보존됐고(P2-1-1), 두 시험이 비슬래시·슬래시 IANA 두 대표 형태를 함께 막는다(TEST:UTC-and-slash-IANA-forms). 변경은 시험 한 파일의 공백 포함 16줄(276-291)이며 제품 소스·시간대 정책 변경은 없다(P2-1-3, AGENTS 원칙 7 서버 권위 유지). 입력 파일은 패킷의 6개뿐이고 artifact는 시험 파일 하나로 미커밋 UI 변경이 섞인 흔적은 없다(P2-1-4). 차단 결함은 없어 PASS다. 비차단 Improvement 2건: (1) UTC 시험은 저장 인자만 확인하고 배너 문구는 단언하지 않아 새 시험과 비대칭이므로 한 줄 추가를 제안한다. (2) 정확한 feature SHA의 Node 20.19.4·24 원격 CI는 아직 미확인이고 작업큐 P2-1은 status: 대기이며 완료 조건에 CI 통과가 포함돼 있어, LRN-ORCH-CI-001에 따라 CI 성공 확인 뒤 main fast-forward와 완료 기록 갱신이 별도 절차로 남는다. PASS는 외부 게이트를 닫지 않는다.

## Findings

### P2-1-TEST-UTC-BANNER-TEXT-SYMMETRY — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 비슬래시 형태의 표시 문구 회귀(예: UTC를 빈 문자열이나 다른 값으로 표시)는 현재 UTC 시험이 잡지 못한다. 저장 인자는 보호되므로 기능 결함은 아니며 시험 대칭성 개선 항목이다.
- 근거: apps/mobile/tests/myHours.test.tsx:259, apps/mobile/tests/myHours.test.tsx:277, apps/mobile/src/features/my/screens/MyHoursScreen.tsx:335
- 완료 조건: UTC 시험에 expect(screen.getByText('기기 시간대는 UTC 예요.')).toBeTruthy() 단언을 추가한다. / myHours.test.tsx 전체가 여전히 통과한다.
- 필요한 테스트: corepack pnpm --filter @sikjae/mobile test -- myHours.test.tsx

### P2-1-OPS-REMOTE-CI-AND-QUEUE-RECORD-PENDING — Improvement / OPEN

- 범주: OPERATIONS
- 영향: 검수 자체의 결함은 아니지만 작업큐 완료 조건 중 원격 CI 통과가 미충족 상태이고 완료 기록도 갱신되지 않았다. 게이트 소유자가 471d17d 정확 SHA의 CI 성공을 확인한 뒤 fast-forward와 작업큐 완료 기록을 남겨야 한다.
- 근거: docs/작업큐.md:810, AGENTS.md:124, COLLABORATION_LOG:0
- 완료 조건: 471d17d87b2bfd4d3711b59557004b45f3968798 정확 SHA의 verify --no-db(Node 20.19.4·24)와 full-db-required job이 completed/success로 기록된다. / 같은 SHA의 main CI 결과와 함께 docs/작업큐.md P2-1 완료 기록이 갱신된다.
- 필요한 테스트: GitHub Actions 정확 SHA CI 결과 확인(별도 게이트 절차)

## 공동 편집 제안

### P2-1-EDIT-UTC-BANNER-ASSERT — ADD

- 대상: `apps/mobile/tests/myHours.test.tsx`
- 위치:       expect(screen.getByText('매장 시간대를 정해 주세요')).toBeTruthy();
- 연결 Finding: P2-1-TEST-UTC-BANNER-TEXT-SYMMETRY
- 이유: UTC 시험도 새 Asia/Seoul 시험과 같이 제안 문구까지 단언해 비슬래시 형태의 표시 회귀를 막는다. 앵커 바로 다음 줄에 추가한다.

          expect(screen.getByText('기기 시간대는 UTC 예요.')).toBeTruthy();

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
