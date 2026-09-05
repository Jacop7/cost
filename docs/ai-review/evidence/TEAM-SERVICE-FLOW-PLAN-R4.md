# Sol ultra v0.4 Finding 재확인 R4

날짜: 2026-09-05. 동일 검수자 gpt-5.6-sol / ultra, R3 Finding 변경부 재확인.
아래는 실제 반환 응답 원문이다. formal gate가 아니다.

v0.4 재확인 판정: **7개 모두 PLAN_SATISFIED**. 변경부에서 새 blocking 충돌은 찾지 못했습니다.

- `SF-R3-01`: 상태 소유자·roll-up 계약과 P2/AC-18 gate 추가됨. 계획 `187-195, 303, 317, 360`; state contract `12-134`.
- `SF-R3-02`: effect claim·STOP 동일 root lock, `run_generation` fence/receipt 결속, 양방향 경합 시험 추가됨. 계획 `162-184`; state `102-132`; AC-09.
- `SF-R3-03`: 만료/폐기 전이, safety capability, 늦은 receipt 구분, 권한 revision/기간 fence, trusted UTC가 반영됨. 계획 `110-114, 162-163, 242, 263`; state `102-120`; AC-07/13/18.
- `SF-R3-04`: PH의 세 terminal outcome과 후속 허용 범위, phase dependency가 고정되고 P1A 명칭이 제거됨. 계획 `255-265`; acceptance `448-596, 618-655`.
- `SF-R3-05`: assertion ID·관측 증거 계약, AC-10 보강, 단계 재배치, CEO 직접 관여·peer 협업·10역할 보고의 양성 AC-19~21이 추가됨. 계획 `331-365`; acceptance `176-199, 357-431, 434-596`.
- `SF-R3-06`: ACK-only AC-16과 P9 AC-17이 분리되고 P8은 `PROBE_ONLY`로 제한됨. 계획 `397-400`; acceptance `304-355, 557-596, 705-714`.
- `SF-R3-07`: candidate manifest→typed formal receipt→사람 Decision→activation envelope의 비순환 hash 체계와 Sol/timeout 거부가 명시됨. 계획 `386-393`; acceptance `658-703`; CURRENT `76-83`.

따라서 정확한 v0.4 bytes와 이 재확인 결과를 보존하고 CURRENT에서 R3를 종결한 뒤에는 **PH-FEASIBILITY 읽기 전용 조사를 착수해도 된다**. 다만 `FEASIBLE_STATIC` 전에는 P2에 진입할 수 없고, P2도 exact model profile 부재로 여전히 차단돼 있다. P2b 이후 코드 구현, 실제 전송, 활성화, 서비스 준비 승인은 모두 불가하다.

검토 SHA:

- plan: `29cea3da0dccdf085e6603f1aacfe69149826407a7a9de0fed0884e3ac850820`
- acceptance: `3ee86cacdae35ee2e4abd0ecbf3c534142ffd4b422350c00476b277c1f0aaa43`
- state contract: `47112e4c6b82a2c2dfb441271a64fd75030bc20fd61becccaa89170084254302`
- CURRENT(재확인 전): `692c625ff6efb68abfa767595d9d27b2bd01b9138e67568b3ae83182b381d97f`

`16/16`은 baseline·명세 형식 검사일 뿐이다. AC-01~21, assertion verifier, PH, host 신뢰, formal review, live probe, 전체 verify는 여전히 미실행/미통과다.
