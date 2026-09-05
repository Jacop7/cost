# Sol v0.5 전체 자문 결과

요청 모델: gpt-5.6-sol / ultra. 읽기 전용 독립 agent 1회.
이 문서는 실제 반환 내용을 정리한 기록이며 verbatim 원문으로 주장하지 않는다.
원응답은 현재 작업의 해당 agent 최종 응답에 남아 있다.
판정: CHANGES_REQUIRED. 실행 상태: BLOCKED_HOST_INTEGRATION_SCOPE_REQUIRED. formal gate 아님.
검토 commit: 625f9fa3fe66a2711ecabd9c176c543b22f57345.
입력 hash는 TEAM-SERVICE-FLOW-V05-SOL.input.json 참조.

1. SV05-01 차단: 계획 AC-17의 team-service-live.test.mjs와 catalog의 team-service.live.test.mjs 불일치.
   plan↔catalog 전체 파일 매핑 회귀 검사가 필요.
2. SV05-02 차단: 공통 entity identity의 run_generation과 세대 횡단 effect_key 유일성 모호.
   effect PK/UNIQUE=(task_id,effect_key), run_generation은 claim metadata로 분리 필요.
3. SV05-03 차단: 실제 host caller/receipt/fence 공백은 PH source hash와 구현에 의해 확인됨.
   source_endpoint_id는 CLI 입력 대조이며 record_delivery는 evidence_id로 scope를 닫는다.
   시계 승인만으로 해결되지 않으며 scoped UNAVAILABLE 판정은 타당.
4. SV05-04 조건: APP_QUEUED와 검증된 TARGET_ACK 분리, scope close는 후자에만 허용.
5. SV05-05 조건: root command_seq, authority issued_at/revoked_at/action/scope 및 CAS/replay 전이 구조화 필요.
6. SV05-06 조건: AC-23 정상 사용자 실제 read 성공 및 경로/SDDL/checker/principal/denial 증거 결속 누락.
7. SV05-07 조건: 새 양성 PH에는 새 scope와 exact requirements bundle/tool-catalog 원출력·조회 provenance 필요.
8. SV05-08 조건: 제공 plan-contract 단독은 9/9·AC 실행0. 명세 검사와 서비스 검사 구별,
   가용성/실행/증거 모드는 서로 다른 축으로 정의할 것.

## 주담당 보완과 미종결

v0.5.1 후보에 01/02/04/05/06/07/08을 반영했다. 독립 재확인을 수행하지 않았으므로 종결/PASS로 표기하지 않는다.
03은 문서 변경으로 해결할 수 없으며 별도 host integration 범위 결정이 필요하다.
기존 19/19는 baseline test 10개 + plan-contract test 9개의 합산이다.
당시 exact 명령/원출력/소스 hash는 TEAM-SERVICE-V05-LOCAL-CHECKS.json에 보존됐으나 Sol 제공 입력에는 포함되지 않았다.
현재는 두 파일 합산 21/21 (10+11)이며 서비스 AC 23개는 여전히 미실행이다.
Fable은 이번 회차 exact soft-cap 위험 승인이 없어 미호출. 유료검수/host 통합/신뢰 완화를 승인한 것으로 추정하지 않는다.
