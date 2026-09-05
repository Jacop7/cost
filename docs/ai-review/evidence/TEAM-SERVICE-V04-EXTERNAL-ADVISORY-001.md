# v0.4 외부 전체 자문 접수

출처: 사용자가 이 작업에 붙여넣은 페이블 자문 보고. 제공자 원응답/CLI/model attestation은 전달되지 않았다.
유형: USER_SUPPLIED_FABLE_ADVISORY. formal receipt나 자동 Finding 종결 증거가 아니다.
대상 v0.4 SHA: 29cea3da0dccdf085e6603f1aacfe69149826407a7a9de0fed0884e3ac850820.
사용자 보고 판정: CHANGES_REQUIRED, 차단 3 / 조건 4. 아래는 요청 및 Finding 요약이며 원문 재출력으로 주장하지 않는다.

- EXT-B1: 계획 머리말/§10의 현재 판정·허용 행동 삭제, CURRENT만 정본.
- EXT-B2: PH 읽기 조사는 P0과 병행. P2 이후는 P0와 PH 성공을 모두 요구.
- EXT-B3: intent_key에 run_generation 포함, AC-10 새 세대 새 route/token 확인.
- EXT-C1: 로컬 UTC+monotonic+drift 대안은 소유자 위험 수용 필요.
- EXT-C2: live 파일 접미사·runner 제외·무발송 음성 시험을 P4 전에 요구.
- EXT-C3: fence stop_epoch는 root Task 값만, 자손 epoch 발급 거부.
- EXT-C4: runtime 경로/ACL 검사와 별도 비관리자 principal 실제 읽기 실패 검증.

## 주담당 확인과 처분

EXT-B1/B3 및 root epoch 모호성은 실제 v0.4에서 확인했다.
기존 CURRENT의 허용 범위와 이번 사용자 지시에 따라 PH를 읽기 전용으로 실행했다.
SOURCE/receipt/fence 연결 공백이 시계 선택과 별개로 있으므로 시계 위험 수용을 요청/합성하지 않았다.
strict 기준을 유지했으며 대안은 OWNER_DECISION_REQUIRED다.
HOST-SCOPE-001.json은 조사한 도구 계약·Router 소스·설치 manifest/skill hash와 제한된 결과를 기록한다.

현재 scripts/verify.mjs는 명시 파일을 호출하고 mobile Vitest는 tests/**/*.test.{ts,tsx}만 포함한다.
따라서 'live 파일 추가 즉시 현재 pnpm verify가 전송한다'는 단정은 확인되지 않았다.
향후 bare Node discovery/설정 확대 위험은 유효하므로 v0.5에 명시 격리와 AC-22를 넣었다.
실제 runner/ACL 구현·AC-22/23 실행은 아직 없으며 파일 접미사 변경만으로 완료라 하지 않는다.

v0.5 보완 상태는 후보 반영이며, 독립 재검수 완료로 주장하지 않는다.
과거 R1~R4와 v0.4 입력은 삭제/수정하지 않는다. 현재 상태는 TEAM-SERVICE-FLOW-CURRENT.json만 갱신한다.
