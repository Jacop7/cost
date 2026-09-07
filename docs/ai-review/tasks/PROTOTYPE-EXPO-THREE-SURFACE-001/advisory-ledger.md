# 프로토타입·Expo 3표면 동기화 Opus 자문 Finding 장부

> 성격: `OPUS_DIRECT_ADVISORY` 임시 추적 장부. P0에서 JSON 권위의 생성 projection으로 전환한다.
> Fable 판정이나 R2/R3 종결 증거가 아니다.
> R1 target: `63f066a8cb406deeedf15be19a393d6a741454ed`
> R2 target: `9ded66e2bbc5a58486aa9ae15b226a1aa3ceff9a`
> R3 target: `9da4e43559ce2d953652c7b279d7584365e3a519`
> R4 target: `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d`
> R5 target: `a02dec70b273e8db692f483b62bc5fbd18f9144b`
> R6 target: `776e7141cb620222e8d7015c90b65d8a2cc795b3`

| ID | 심각도 | 제기 회차 | 상태 | 처리 근거 | 검증 SHA |
|---|---|---|---|---|---|
| R1-M1 | Major | R1 | fixed | 운영 산출물 부재를 단일 기준으로, 런타임 거부를 보조 방어로 한정 | pending R3 |
| R1-M2 | Major | R1 | fixed | native·web prod sentinel 부재 + dev sentinel 존재 빌드 게이트 분리 | pending R3 |
| R1-M3 | Major | R1 | fixed | P4 선택을 운영 제외·provider 비용·구성 변경 3축으로 정의 | pending R3 |
| R1-M4 | Major | R1 | fixed | 제품→`src/dev/**` 다섯 import edge 금지 | pending R3 |
| R1-M5 | Major | R1 | fixed | `fixtureKind=stub|devSeedEntity`와 DB 없는 unsupported 분리 | pending R3 |
| R1-M6 | Major | R1 | fixed | 개발 Supabase allowlist 부팅 hard-fail과 운영 ref 음성 시험 | pending R3 |
| R1-M7 | Major | R1 | fixed | 생성/선언 컬럼 분리, registry·README 생성 순서·bytes 계약 | pending R3 |
| R1-M8 | Major | R1 | fixed | P1은 catalog projection, 실제 entry 대조는 P4로 이동 | pending R3 |
| R1-M9 | Major | R1 | fixed | 임시 차이 schema·UTC 만료·상한 3·차단 코드 제외 | pending R3 |
| R1-M10 | Major | R1 | fixed | P3 도메인별 필수 독립검수 | pending R3 |
| R1-M11 | Major | R1 | fixed | 정상 운영 동기화와 P2~P5 마이그레이션 장부 분리 | pending R3 |
| R1-M12 | Major | R1 | fixed | `myHours` test-only 동기화점 수정, 20회 단독·10회 전체 gate | pending R3 |
| R1-m1 | Minor | R1 | fixed | README 전용 Markdown parser와 생성 영역 제외 | pending R3 |
| R1-m2 | Minor | R1 | fixed | 축별 예외 표와 field dependency matrix | pending R3 |
| R1-m3 | Minor | R1 | fixed | P0~P6 독립검수 표와 최소 검수점 일치 | pending R3 |
| R1-m4 | Minor | R1 | fixed | 절대 시험 수 대신 기준선 실패 0+명시 증분 | pending R3 |
| R1-m5 | Minor | R1 | fixed | adapter 허용 구문과 AST diff 정의 | pending R3 |
| R1-m6 | Minor | R1 | fixed | `.tmp/**`·worktree 복제 경로 scanner 제외 | pending R3 |
| R1-m7 | Minor | R1 | fixed | web production export도 차단 대상 | pending R3 |
| R1-m8 | Minor | R1 | fixed | native 동등 증거 exact-SHA 승인자·범위 artifact | pending R3 |
| R1-m9 | Minor | R1 | fixed | 자문 target·판정·재자문 규칙과 Finding 장부 | pending R3 |
| R1-m10 | Minor | R1 | fixed | P6 local R0/R1, R2/R3 추가 조건 명시 | pending R3 |
| R2-MA | Major | R2 | fixed | regression은 P0 backlog만; 제품 화면 touch 음성 gate | pending R3 |
| R2-MB | Major | R2 | fixed | test-only 원인·query key 기록, 동일 runner 전체 10회 | pending R3 |
| R2-MC | Major | R2 | fixed | registry 직렬화·LF·idempotency·변조 음성 시험 | pending R3 |
| R2-MD | Major | R2 | fixed | README 생성 표식·parser 제외·고정 생성 순서 | pending R3 |
| R2-ME | Major | R2 | fixed | 세 차이 축별 예외와 catalogMode 의존 표 | pending R3 |
| R2-MF | Major | R2 | fixed | 승인 시각 diff manifest와 양방향 검사기 산출물 추가 | pending R3 |
| R2-MG | Major | R2 | fixed | P4 이후 두 격리 task를 매 commit 필수 gate로 등록 | pending R3 |
| R2-MH | Major | R2 | fixed | 이 장부에 R1 22건·R2 전건 추적 | pending R3 |
| R2-m1 | Minor | R2 | fixed | 실행서 checkpoint와 기획안에 R2 target·판정 기록 | pending R3 |
| R2-m2 | Minor | R2 | fixed | import edge 다섯 종류 명시·fixture 요구 | pending R3 |
| R2-m3 | Minor | R2 | fixed | 예외 상한 3, P3 전 backlog 상한, UTC 만료·remediation | pending R3 |
| R2-m4 | Minor | R2 | fixed | catalogEnvironment 경로·소유자·운영 ref schema 거부 | pending R3 |
| R2-m5 | Minor | R2 | fixed | entry module path와 sourceComponent 일치 시험 | pending R3 |
| R2-m6 | Minor | R2 | fixed | P4 decision record 경로·소유·선행 조건 | pending R3 |
| R2-m7 | Minor | R2 | fixed | devSeedEntities 경로와 seed 판본 계약 | pending R3 |
| R2-m8 | Minor | R2 | fixed | native evidence artifact 필드와 대체 승인 기록 | pending R3 |
| R3-F1 | Blocking | R3 | fixed | production absent·force-enabled present·development present 3-leg 양성대조 | pending R4 |
| R3-F2 | Blocking | R3 | fixed | parity와 직교하는 `temporaryDivergence` 객체·축·삭제 복원 | pending R4 |
| R3-F3 | Blocking | R3 | fixed | parity 4종 × 핵심 필드 필수·선택·금지 행렬 | pending R4 |
| R3-F4 | Major | R3 | fixed | Git root 상대 스캔·inventory floor·checkout/worktree hash 동일 | pending R4 |
| R3-F5 | Major | R3 | fixed | 시각 diff 캡처 조건·요소 키·baseline/hash·승인 refresh 계약 | pending R4 |
| R3-F6 | Major | R3 | fixed | base branch 변경 시 별도 rebaseline commit·재검수 | pending R4 |
| R3-F7 | Major | R3 | fixed | P2 전 단일 waiting cap 고정·같은 commit 상한 인상 금지 | pending R4 |
| R3-F8 | Major | R3 | fixed | provider module identity/path와 order-sensitive chain snapshot | pending R4 |
| R3-F9 | Major | R3 | fixed | adapter JSX 허용 grammar·양성/음성 fixture | pending R4 |
| R3-F10 | Major | R3 | fixed | 만료 평가 시각 분리·committer date +7일 제한 | pending R4 |
| R3-F11 | Major | R3 | fixed | JSON 장부 schema/checker·완료 round 전수·closing SHA | pending R4 |
| R3-F12 | Minor | R3 | fixed | PRODUCT-OWNER 승인 목록·self-approval 금지 | pending R4 |
| R3-F13 | Minor | R3 | fixed | fixtureRef를 seed 선택 규칙으로 고정·bare UUID 거부 | pending R4 |
| R3-F14 | Major | R3 | fixed | heavy gate를 exact review SHA·protected pre-merge에 강제·긴급 면제 없음 | pending R4 |
| R3-F15 | Minor | R3 | fixed | 시험 합계를 기준 233 + 선언 증분의 N/N으로 기록 | pending R4 |
| R3-F16 | Minor | R3 | fixed | byte-normative 산출물 LF·BOM 없음·고정 순서·fixed point | pending R4 |
| R3-F17 | Minor | R3 | fixed | 상태별 접근성 tree·스크린샷 hash·sentinel 렌더 증거 | pending R4 |
| R3-F18 | Minor | R3 | fixed | 개발 전용 catalog deep-link scheme와 production 부재 | pending R4 |
| R3-F19 | Minor | R3 | fixed | P4 spike commit 단위·첫 sentinel/route/fixture부터 gate 활성 | pending R4 |
| R4-M1 | Major | R4 | fixed | `specOnly` parity 자체를 catalog 부재 근거로 명시·축 fixture | pending R5 |
| R4-M2 | Major | R4 | fixed | `specOnly.states` 금지·prototype target 상태로 분리 | pending R5 |
| R4-M3 | Major | R4 | fixed | 긴급 commit의 approvers·baseline 상한 수정 금지 | pending R5 |
| R4-M4 | Major | R4 | fixed | migration backlog와 emergency divergence 상한 분리 | pending R5 |
| R4-m1 | Minor | R4 | fixed | fixtureKind별 fixtureRef 판별 합집합 | pending R5 |
| R4-m2 | Minor | R4 | fixed | selector 정확히 1건·0/복수 하드 실패 | pending R5 |
| R4-m3 | Minor | R4 | fixed | LF 규약을 텍스트 산출물로 한정·PNG `-text` | pending R5 |
| R4-m4 | Minor | R4 | fixed | 시각 캡처 renderer·OS·SDK 결속과 rebaseline trigger | pending R5 |
| R4-m5 | Minor | R4 | fixed | 기획안 최소 검수점에 P0 추가 | pending R5 |
| R5-M1 | Major | R5 | fixed | unsupported의 states 금지·route/fixture만 상태 렌더 의무·비어 있는 배열 거부 | pending R6 |
| R5-m1 | Minor | R5 | fixed | parity별 temporary divergence 허용 axes 행렬 | pending R6 |
| R5-m2 | Minor | R5 | fixed | registry `migrationPending`에서 생성하는 P3→P5 backlog projection | pending R6 |
| R5-m3 | Minor | R5 | fixed | 사람 선언 key가 README 정식 ID에 없는 고아 fixture | pending R6 |
| R5-m4 | Minor | R5 | fixed | PNG baseline `.gitattributes -text -diff`와 문서 계약 | pending R6 |
| R5-m5 | Minor | R5 | fixed | 만료 검사 commit-time/current-time 분리·revert remediation | pending R6 |
| R5-m6 | Minor | R5 | fixed | spike는 정적 diff, 첫 catalog artifact부터 heavy gate | pending R6 |
| R5-m7 | Minor | R5 | fixed | structure decision에 채택 구조별 production 강제 연결 절차 | pending R6 |
| R6-F1 | Major | R6 | fixed | 긴급 7일과 migration deadline 규칙 분리·각 음성 fixture | pending R7 |
| R6-F2 | Minor | R6 | fixed | 10회 전체 스위트 측정 SHA·runner·2330/2330 기록 | pending R7 |
| R6-F3 | Minor | R6 | fixed | 생성 5필드와 사람 선언 5필드 parity 계약·C/O 범례 | pending R7 |
| R6-F4 | Minor | R6 | fixed | 사람이 migrationPending 등록 후 기계 projection 생성 | pending R7 |
