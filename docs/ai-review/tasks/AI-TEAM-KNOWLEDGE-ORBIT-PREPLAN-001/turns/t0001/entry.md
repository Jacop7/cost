
## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `b587c7b325651334522a5e859c7726332611cf66f6b6d5d2f58fd46d619d0684`
- target_commit_sha: `933262b1f193d1b4cacbb7c2fb08564592cdf419`
- changed_artifact_paths: `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md`
- resulting_input_files_sha256: `r002 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md, sha256: 8d1139312bf2ede3e2e08abb657890c5bef98d5f47edbb214b3903f36330eb86, change_type: ADDED }]`

### ORBIT-PREPLAN-DOCPLANE-001

- disposition: `APPLIED`
- 적용 위치: §10 제안하는 최소 문서 제어면
- 적용 내용: 팀 구성안 §11의 기존 `docs/team/` 권위 구조를 원문대로 먼저 적고, `_shared` 신규 권위 파일군을 제거했다. current/task·decision·release는 기존 작업큐·DECISIONS·RELEASE_GATE에서 다시 만드는 생성 view 후보로 한정했으며 최종 구조 소유자를 팀 구성안 §11과 디렉터리 기획안 개정 Task로 고정했다.
- 실행한 테스트: 문서 네트워크 시뮬레이션 59/59, `git diff --check`
- 필요한 재검수: 중복 권위와 역할별 추적 문서 신설 위험이 제거됐는지 확인

### ORBIT-PREPLAN-HANDOFF-002

- disposition: `APPLIED`
- 적용 위치: §7.1 체크포인트 필수 필드
- 적용 내용: 복원 필드 단일 권위를 팀 구성안 §11로 선언하고 초안 필드의 1:1 정규화 표를 추가했다. HANDOFF YAML을 §11 권위 이름으로 바꾸고 risk·edit owner/session/lease·request dispositions·stop conditions·agents blob·사용자 변경·경로 역할 필드를 모두 보존했다.
- 실행한 테스트: 기존 오케스트레이션 §4.3 YAML 수동 대조, 문서 네트워크 시뮬레이션 59/59
- 필요한 재검수: 경쟁 복원 계약과 필수 필드 유실이 해소됐는지 확인

### ORBIT-PREPLAN-ONTOLOGY-003

- disposition: `APPLIED`
- 적용 위치: §8.1 노드 대응, §8.2 관계 대응
- 적용 내용: 패킷 어휘를 온톨로지 §3·§4와 동일·분해·신규 후보로 매핑했다. 포괄 ARTIFACT, BLOCKS, DECIDED_BY, OWNED_BY, ANNOUNCED_IN은 새 권위로 만들지 않고 기존 어휘를 사용하도록 했다. HANDOFF·역할 컨텍스트·Release·TOUCHES·HANDOFF_TO는 온톨로지 개정 전까지 후보로만 남겼다.
- 실행한 테스트: 온톨로지 권위 표 수동 대조, 문서 네트워크 시뮬레이션 59/59
- 필요한 재검수: typed provenance 어휘가 온톨로지 단일 출처로 수렴했는지 확인

### ORBIT-PREPLAN-QUALITY-004

- disposition: `APPLIED`
- 적용 위치: §3.2 부서 그룹, §4.1 팀
- 적용 내용: Quality 소유를 출시 게이트 증거와 판정 보고로 한정하고 Go/No-Go·운영 승인은 사람 소유로 명시했다. 상설 Quality 채팅은 조정 전용이며 실제 Codex·Fable 검증은 회차별 전용·클린 컨텍스트에서 수행하도록 분리했다.
- 실행한 테스트: 팀 구성안 §1.1 권한 대조
- 필요한 재검수: 사람 승인 권위와 독립 검수 컨텍스트가 보존되는지 확인

### ORBIT-PREPLAN-STATE-005

- disposition: `APPLIED`
- 적용 위치: §6.2 초기 전환 신호, §6.3 전환 권한
- 적용 내용: 상태명을 `HANDOFF_READY 진입`으로 통일하고 `CONTEXT_ROLLOVER_REQUIRED`는 상태가 아니라 전이를 요청하는 신호로 정의했다. 기존 lease 오류 코드 `HANDOFF_REQUIRED`와 이름·의미를 공유하지 않도록 했다.
- 실행한 테스트: 문서·시뮬레이션 식별자 검색, 문서 네트워크 시뮬레이션 59/59
- 필요한 재검수: 상태·신호·기존 오류 코드 의미 충돌이 제거됐는지 확인

### ORBIT-PREPLAN-ROLE-006

- disposition: `APPLIED`
- 적용 위치: §4.1.1 기존 역할표와 팀 그룹 대응, §4.3 Context & Token Steward
- 적용 내용: 5개 팀 그룹을 팀 구성안 §1.1 기존 역할·엔진과 매핑하고 각 독립성을 적었다. 공식 이름을 `Server · Supabase · Operations`로 통일했다. Steward는 신설 후보로 명시하고 AI 부 O의 상태 복원·컨텍스트 조립 소유와 분리했으며 Quality/Fable 표본 감사 대상으로 뒀다.
- 실행한 테스트: 팀 구성안 §1.1·§3과 오케스트레이션 §2 수동 대조
- 필요한 재검수: 새 그룹이 기존 역할 승인 체계를 대체하지 않는지 확인

### ORBIT-PREPLAN-METRIC-007

- disposition: `APPLIED`
- 적용 위치: §12 측정과 학습, §13 단계별 도입 후보, §16 사람 결정 후보
- 적용 내용: 지표마다 수집 위치·계산 방법·초기 실패 후보를 추가했다. §13 검사기 범위에 컨텍스트 압력 상태와 HANDOFF 필수 필드를 추가하고, 임계값은 파일럿 전 사람 결정으로 확정하도록 §16에 연결했다.
- 실행한 테스트: 평가 기획안 §5.3·§5.4 대조, 문서 네트워크 시뮬레이션 59/59
- 필요한 재검수: 파일럿 성공·실패가 측정 가능한 계약인지 확인

- next_review_request: `CODEX_EVIDENCE`
