# 프로토타입·Expo 3표면 동기화 Opus 자문 Finding 장부

> 성격: `OPUS_DIRECT_ADVISORY`의 기계 원본 JSON에서 생성한 projection이다.
> Fable 판정이나 R2/R3 종결 증거가 아니다.
> R1 target: `63f066a8cb406deeedf15be19a393d6a741454ed` · CHANGES_REQUIRED
> R2 target: `9ded66e2bbc5a58486aa9ae15b226a1aa3ceff9a` · CHANGES_REQUIRED
> R3 target: `9da4e43559ce2d953652c7b279d7584365e3a519` · CHANGES_REQUIRED
> R4 target: `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` · CHANGES_REQUIRED
> R5 target: `a02dec70b273e8db692f483b62bc5fbd18f9144b` · CHANGES_REQUIRED
> R6 target: `776e7141cb620222e8d7015c90b65d8a2cc795b3` · CHANGES_REQUIRED
> R7 target: `6912a5ac7355237459126ffea41a1860e66f0d33` · CHANGES_REQUIRED
> R8 target: `7fb0ec2d51e2722bdbc08ed33b449d49e5dfc19e` · CHANGES_REQUIRED
> R9 target: `72821f4029fd564ec0d41024b8212065b13caf04` · PASS

| ID | 심각도 | 제기 회차 | 상태 | 처리 근거 | 검증 SHA |
|---|---|---|---|---|---|
| R1-M1 | Major | R1 | closed | 운영 산출물 부재를 단일 기준으로, 런타임 거부를 보조 방어로 한정 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-M2 | Major | R1 | closed | native·web prod sentinel 부재 + dev sentinel 존재 빌드 게이트 분리 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-M3 | Major | R1 | closed | P4 선택을 운영 제외·provider 비용·구성 변경 3축으로 정의 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-M4 | Major | R1 | closed | 제품→`src/dev/**` 다섯 import edge 금지 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-M5 | Major | R1 | closed | `fixtureKind=stub\|devSeedEntity`와 DB 없는 unsupported 분리 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-M6 | Major | R1 | closed | 개발 Supabase allowlist 부팅 hard-fail과 운영 ref 음성 시험 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-M7 | Major | R1 | closed | 생성/선언 컬럼 분리, registry·README 생성 순서·bytes 계약 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-M8 | Major | R1 | closed | P1은 catalog projection, 실제 entry 대조는 P4로 이동 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-M9 | Major | R1 | closed | 임시 차이 schema·UTC 만료·상한 3·차단 코드 제외 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-M10 | Major | R1 | closed | P3 도메인별 필수 독립검수 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-M11 | Major | R1 | closed | 정상 운영 동기화와 P2~P5 마이그레이션 장부 분리 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-M12 | Major | R1 | closed | `myHours` test-only 동기화점 수정, 20회 단독·10회 전체 gate | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-m1 | Minor | R1 | closed | README 전용 Markdown parser와 생성 영역 제외 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-m2 | Minor | R1 | closed | 축별 예외 표와 field dependency matrix | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-m3 | Minor | R1 | closed | P0~P6 독립검수 표와 최소 검수점 일치 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-m4 | Minor | R1 | closed | 절대 시험 수 대신 기준선 실패 0+명시 증분 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-m5 | Minor | R1 | closed | adapter 허용 구문과 AST diff 정의 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-m6 | Minor | R1 | closed | `.tmp/**`·worktree 복제 경로 scanner 제외 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-m7 | Minor | R1 | closed | web production export도 차단 대상 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-m8 | Minor | R1 | closed | native 동등 증거 exact-SHA 승인자·범위 artifact | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-m9 | Minor | R1 | closed | 자문 target·판정·재자문 규칙과 Finding 장부 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R1-m10 | Minor | R1 | closed | P6 local R0/R1, R2/R3 추가 조건 명시 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-MA | Major | R2 | closed | regression은 P0 backlog만; 제품 화면 touch 음성 gate | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-MB | Major | R2 | closed | test-only 원인·query key 기록, 동일 runner 전체 10회 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-MC | Major | R2 | closed | registry 직렬화·LF·idempotency·변조 음성 시험 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-MD | Major | R2 | closed | README 생성 표식·parser 제외·고정 생성 순서 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-ME | Major | R2 | closed | 세 차이 축별 예외와 catalogMode 의존 표 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-MF | Major | R2 | closed | 승인 시각 diff manifest와 양방향 검사기 산출물 추가 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-MG | Major | R2 | closed | P4 이후 두 격리 task를 매 commit 필수 gate로 등록 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-MH | Major | R2 | closed | 이 장부에 R1 22건·R2 전건 추적 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-m1 | Minor | R2 | closed | 실행서 checkpoint와 기획안에 R2 target·판정 기록 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-m2 | Minor | R2 | closed | import edge 다섯 종류 명시·fixture 요구 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-m3 | Minor | R2 | closed | 예외 상한 3, P3 전 backlog 상한, UTC 만료·remediation | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-m4 | Minor | R2 | closed | catalogEnvironment 경로·소유자·운영 ref schema 거부 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-m5 | Minor | R2 | closed | entry module path와 sourceComponent 일치 시험 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-m6 | Minor | R2 | closed | P4 decision record 경로·소유·선행 조건 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-m7 | Minor | R2 | closed | devSeedEntities 경로와 seed 판본 계약 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R2-m8 | Minor | R2 | closed | native evidence artifact 필드와 대체 승인 기록 | `9da4e43559ce2d953652c7b279d7584365e3a519` |
| R3-F1 | Blocking | R3 | closed | production absent·force-enabled present·development present 3-leg 양성대조 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F2 | Blocking | R3 | closed | parity와 직교하는 `temporaryDivergence` 객체·축·삭제 복원 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F3 | Blocking | R3 | closed | parity 4종 × 핵심 필드 필수·선택·금지 행렬 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F4 | Major | R3 | closed | Git root 상대 스캔·inventory floor·checkout/worktree hash 동일 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F5 | Major | R3 | closed | 시각 diff 캡처 조건·요소 키·baseline/hash·승인 refresh 계약 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F6 | Major | R3 | closed | base branch 변경 시 별도 rebaseline commit·재검수 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F7 | Major | R3 | closed | P2 전 단일 waiting cap 고정·같은 commit 상한 인상 금지 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F8 | Major | R3 | closed | provider module identity/path와 order-sensitive chain snapshot | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F9 | Major | R3 | closed | adapter JSX 허용 grammar·양성/음성 fixture | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F10 | Major | R3 | closed | 만료 평가 시각 분리·committer date +7일 제한 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F11 | Major | R3 | closed | JSON 장부 schema/checker·완료 round 전수·closing SHA | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F12 | Minor | R3 | closed | PRODUCT-OWNER 승인 목록·self-approval 금지 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F13 | Minor | R3 | closed | fixtureRef를 seed 선택 규칙으로 고정·bare UUID 거부 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F14 | Major | R3 | closed | heavy gate를 exact review SHA·protected pre-merge에 강제·긴급 면제 없음 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F15 | Minor | R3 | closed | 시험 합계를 기준 233 + 선언 증분의 N/N으로 기록 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F16 | Minor | R3 | closed | byte-normative 산출물 LF·BOM 없음·고정 순서·fixed point | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F17 | Minor | R3 | closed | 상태별 접근성 tree·스크린샷 hash·sentinel 렌더 증거 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F18 | Minor | R3 | closed | 개발 전용 catalog deep-link scheme와 production 부재 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R3-F19 | Minor | R3 | closed | P4 spike commit 단위·첫 sentinel/route/fixture부터 gate 활성 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` |
| R4-M1 | Major | R4 | closed | `specOnly` parity 자체를 catalog 부재 근거로 명시·축 fixture | `a02dec70b273e8db692f483b62bc5fbd18f9144b` |
| R4-M2 | Major | R4 | closed | `specOnly.states` 금지·prototype target 상태로 분리 | `a02dec70b273e8db692f483b62bc5fbd18f9144b` |
| R4-M3 | Major | R4 | closed | 긴급 commit의 approvers·baseline 상한 수정 금지 | `a02dec70b273e8db692f483b62bc5fbd18f9144b` |
| R4-M4 | Major | R4 | closed | migration backlog와 emergency divergence 상한 분리 | `a02dec70b273e8db692f483b62bc5fbd18f9144b` |
| R4-m1 | Minor | R4 | closed | fixtureKind별 fixtureRef 판별 합집합 | `a02dec70b273e8db692f483b62bc5fbd18f9144b` |
| R4-m2 | Minor | R4 | closed | selector 정확히 1건·0/복수 하드 실패 | `a02dec70b273e8db692f483b62bc5fbd18f9144b` |
| R4-m3 | Minor | R4 | closed | LF 규약을 텍스트 산출물로 한정·PNG `-text` | `a02dec70b273e8db692f483b62bc5fbd18f9144b` |
| R4-m4 | Minor | R4 | closed | 시각 캡처 renderer·OS·SDK 결속과 rebaseline trigger | `a02dec70b273e8db692f483b62bc5fbd18f9144b` |
| R4-m5 | Minor | R4 | closed | 기획안 최소 검수점에 P0 추가 | `a02dec70b273e8db692f483b62bc5fbd18f9144b` |
| R5-M1 | Major | R5 | closed | unsupported의 states 금지·route/fixture만 상태 렌더 의무·비어 있는 배열 거부 | `776e7141cb620222e8d7015c90b65d8a2cc795b3` |
| R5-m1 | Minor | R5 | closed | parity별 temporary divergence 허용 axes 행렬 | `776e7141cb620222e8d7015c90b65d8a2cc795b3` |
| R5-m2 | Minor | R5 | closed | registry `migrationPending`에서 생성하는 P3→P5 backlog projection | `776e7141cb620222e8d7015c90b65d8a2cc795b3` |
| R5-m3 | Minor | R5 | closed | 사람 선언 key가 README 정식 ID에 없는 고아 fixture | `776e7141cb620222e8d7015c90b65d8a2cc795b3` |
| R5-m4 | Minor | R5 | closed | PNG baseline `.gitattributes -text -diff`와 문서 계약 | `776e7141cb620222e8d7015c90b65d8a2cc795b3` |
| R5-m5 | Minor | R5 | closed | 만료 검사 commit-time/current-time 분리·revert remediation | `776e7141cb620222e8d7015c90b65d8a2cc795b3` |
| R5-m6 | Minor | R5 | closed | spike는 정적 diff, 첫 catalog artifact부터 heavy gate | `776e7141cb620222e8d7015c90b65d8a2cc795b3` |
| R5-m7 | Minor | R5 | closed | structure decision에 채택 구조별 production 강제 연결 절차 | `776e7141cb620222e8d7015c90b65d8a2cc795b3` |
| R6-F1 | Major | R6 | closed | 긴급 7일과 migration deadline 규칙 분리·각 음성 fixture | `6912a5ac7355237459126ffea41a1860e66f0d33` |
| R6-F2 | Minor | R6 | closed | 10회 전체 스위트 측정 SHA·runner·2330/2330 기록 | `6912a5ac7355237459126ffea41a1860e66f0d33` |
| R6-F3 | Minor | R6 | closed | 생성 5필드와 사람 선언 5필드 parity 계약·C/O 범례 | `6912a5ac7355237459126ffea41a1860e66f0d33` |
| R6-F4 | Minor | R6 | closed | 사람이 migrationPending 등록 후 기계 projection 생성 | `6912a5ac7355237459126ffea41a1860e66f0d33` |
| R7-F1 | Minor | R7 | closed | expoOnly를 README ID·route 존재 + prototype 부재로 고정 | `7fb0ec2d51e2722bdbc08ed33b449d49e5dfc19e` |
| R7-F2 | Minor | R7 | closed | P4 decision의 catalog/fixture root까지 역방향 import 금지 | `7fb0ec2d51e2722bdbc08ed33b449d49e5dfc19e` |
| R7-F3 | Minor | R7 | closed | 문서 상태줄·R7 target 추적 일치 | `7fb0ec2d51e2722bdbc08ed33b449d49e5dfc19e` |
| R8-F1 | Minor | R8 | closed | P5 aligned 차이에서 유효 temporary divergence 축만 제외 | `72821f4029fd564ec0d41024b8212065b13caf04` |
| R8-F2 | Minor | R8 | closed | byte 산출물 닫힌 manifest·advisory MD fixed-point/변조 시험 | `72821f4029fd564ec0d41024b8212065b13caf04` |

총 83건 · 완료 회차 9개 · 최종 자문 PASS
