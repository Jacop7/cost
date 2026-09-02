# AI 컨텍스트 롤오버·미션 연속성 Opus 검수 r1

> 상태: `OPUS_DIRECT_ADVISORY`
> 판정: `CHANGES_REQUIRED`
> 실행일: 2026-09-02
> 모델 요청: `opus`
> Claude Code CLI: `2.1.250`
> 세션: `1fcbb25b-2e28-4fc1-8c29-9df1490846a1`
> 대상 commit: `022840a`
> CLI 보고 사용량: `$1.016388`
> 소요 시간: `441482ms`
> 권위 제한: 이 자문은 공식 Fable 완료 검수나 보호 원격 게이트를 대체하지 않는다.

## 1. 검수 범위

Claude Opus에 1차안 전문을 직접 제공하고 파일·도구 접근을 차단했다. 다음 축을 공격 관점에서
검토하도록 요청했다.

- A→B→C 반복 롤오버의 미션 연속성
- 최소 Context Capsule 조립
- 비동기·부분 성공 가능한 실제 Codex 채팅 생성
- 복원 검증 handshake와 lease 인계
- 봉인 중 새 사용자 입력
- 과거 사건 수집·Learning 승격·감사 독립성·비밀 보호
- 다섯 기존 권위 문서의 단일 소유

## 2. 필수 Finding

### RC-01 · Critical · 복원 검증자 순환

현재안은 컨텍스트가 고갈된 predecessor가 Capsule과 Restore Receipt를 의미 비교할 수 있다. 비교 도중
추가 compaction이 일어나거나 predecessor가 종료되면 자기판정 또는 영구 교착으로 이어진다.

필수 수정:

- 비교자는 채팅 밖 결정적 순수 함수로 고정한다.
- Activation Receipt는 그 비교자만 생성한다.
- `next_safe_action`을 동사·대상·전제 hash·예상 후조건으로 구조화한다.
- 기계 판정 불가 항목은 `RESTORE_NEEDS_ADJUDICATION`으로 중단한다.

수용 시험: predecessor를 생성 직후 종료해도 같은 PASS/REJECT가 나오고 필수 필드 단독 변조를 전부
정확한 mismatch로 거부한다.

### RC-02 · Critical · lease 이중 소유 구간

`LEASE_TRANSFERRED → SUCCESSOR_ACTIVE → PREDECESSOR_SEALED` 순서와 “successor 무응답 시 이전 lease
유지”가 충돌한다. 실제 공유 트랜잭션·fencing이 없어 두 Session이 모두 writer라고 믿을 수 있다.

필수 수정:

- lease에 holder·단조 fencing token·heartbeat·TTL을 둔다.
- 모든 쓰기 전에 최신 fencing token을 재확인한다.
- 이전은 `PREDECESSOR_LEASE_REVOKED → NO_OWNER → SUCCESSOR_LEASE_GRANTED`로 수행한다.
- 실패 시 자동 복귀하지 않고 `NO_OWNER`에서 명시적 재부여를 요구한다.

수용 시험: revoke 뒤 predecessor 쓰기와 grant 전 successor 쓰기가 도구 수준에서 차단된다.

### RC-03 · Critical · 생성 write-ahead와 표면 능력 부재

thread 생성은 성공했지만 응답 전에 predecessor가 죽으면 성공 receipt가 없어 고아 successor를 찾을 수
없다. title은 수정 가능해 식별자로 쓸 수 없으며, list/read/wait가 없는 표면에서는 생성 성공 자체를
검증할 수 없다.

필수 수정:

- create 호출 전에 `CREATE_ATTEMPT`와 배정 successor ref를 append·durable write한다.
- idempotency key와 successor ref를 첫 prompt에 심고 Restore Receipt가 echo한다.
- 미확정 호출을 `ROLLOVER_INDETERMINATE`, 발견된 고아를 `SEALED_ORPHAN`으로 관리한다.
- 생성 전에 create/list/read-first-turn/wait/send/cancel/token-introspection 능력을 probe한다.
- 회수 능력이 없으면 자동 생성을 시도하지 않는다.

수용 시험: create 응답 직전 kill을 반복해도 고아를 정확히 회수하고 중복 successor를 만들지 않는다.

### RC-04 · Critical · 거부된 옛 채팅의 재활성화

거부된 successor가 사이드바에 살아 있으면 사용자가 나중에 “계속”이라고 했을 때 낡은 Capsule로 다시
쓸 수 있다. 현재 유일성은 같은 predecessor/version에만 걸려 Mission 전체 활성 Session 하나를
보장하지 않는다.

필수 수정:

- Mission별 `ACTIVE` Session은 정확히 하나라는 ledger 유일 제약을 둔다.
- `RESTORE_REJECTED`를 `SEALED_REJECTED` 터미널 상태로 만든다.
- 봉인된 채팅에는 후속 Session 안내와 쓰기 금지를 남긴다.
- 모든 쓰기 전 `latest_active_session_ref`와 fencing token을 확인한다.

수용 시험: 거부된 옛 채팅에 새 지시를 보내도 파일 변경 0건이고 현재 successor만 안내한다.

### RC-05 · Critical · 봉인 중 사용자 입력 유실

Checkpoint 봉인 뒤 사용자가 범위 변경·취소를 보내면 Capsule이 stale해지거나 지시가 누락된다.

필수 수정:

- 봉인 뒤 predecessor는 `INTAKE_ONLY`로 전환해 입력을 실행하지 않고 접수 사건으로 append한다.
- `pending_user_inputs`를 Capsule 필수 필드로 둔다.
- 범위·완료 조건·제외 경로 변경은 기존 Capsule을 supersede하고 더 높은 판본으로 재봉인한다.
- successor는 pending 입력을 처리한 뒤에만 다음 행동을 수행한다.
- 반복 재봉인 상한 뒤 사람에게 범위 확정을 요청한다.

수용 시험: 봉인 중 상태 질문·범위 변경·취소 입력에서 손실 0, 필요한 경우 판본 1 증가, successor의
첫 실행 전에 입력 처리가 증명된다.

### RC-06 · Major · worktree drift와 canonical hash 부재

`worktree_fingerprint`의 범위가 없어 임시 파일 하나로 영구 거부되거나 대상 파일 변조를 놓칠 수 있다.
CRLF/LF, 경로 구분자, YAML 키 순서, 한글 Unicode 정규화가 다르면 같은 상태의 hash도 달라진다.

필수 수정:

- fingerprint를 branch·HEAD·upstream relation·범위별 blob digest로 분리한다.
- `artifact_paths ∪ user_owned_changes ∪ evidence_paths`와 `volatile_paths`를 명시한다.
- drift를 `RE_VERIFY | REJECT | ACCEPT_AND_RECORD`로 판정한다.
- UTF-8·NFC·LF·POSIX 상대 경로·정렬 키의 canonical serialization을 고정한다.
- 로케일 의존 문자열이 아니라 Git의 결정적 명령 결과를 사용한다.

수용 시험: Windows와 Linux가 같은 hash를 만들고 범위 밖·안쪽 변경을 서로 다르게 판정한다.

### RC-07 · Major · 재귀 생성 권한 전달 불완전

B가 C를 만들려면 chain ledger 위치, 자신의 배정 ref, 자동 생성 권한, 직전 chain hash, 정책 내용 hash가
필요하지만 1차 Capsule에 없다. Activation Receipt schema도 없다.

필수 수정:

- session ref는 생성자가 `CREATE_ATTEMPT` 전에 단독 발행한다.
- Capsule에 successor ref·ledger ref·chain head·생성 권한·rollover policy hash를 넣는다.
- Activation Receipt schema를 정의한다.
- successor는 상속한 policy hash가 현재 정책과 일치할 때만 다음 판본을 생성한다.

수용 시험: A→B→C에서 세션당 ref 하나, 정책 hash 연속성, 변조 ref 거부를 확인한다.

### RC-08 · Major · 감사 독립성·비밀·폐기 Learning 오염

독립 감사 successor에도 기존 Finding·Learning이 전달될 수 있고 자유 서술 명령에 비밀이 들어갈 수
있다. Capsule 발행 뒤 RETIRED가 된 Learning도 B→C로 계속 전파될 수 있다.

필수 수정:

- `EXECUTION | INDEPENDENT_AUDIT` 격리 등급을 둔다.
- 독립 감사에는 기존 결론 본문을 넣지 않고 허용된 증거 원본만 제공한다.
- Capsule 원본은 Git 외부 보호 장부, Git에는 redacted manifest만 둔다.
- 봉인 전 secret/redaction gate를 통과시킨다.
- 명령은 해석값 대신 argv template과 환경변수 참조만 기록한다.
- Learning registry hash를 넣고 복원 시 상태를 다시 읽어 RETIRED 적용을 중단한다.

수용 시험: 독립 감사 결론 오염 0, 비밀 주입 Capsule 생성 차단, 폐기 Learning 자동 제외를 확인한다.

## 3. Minor·Improvement

- `EMERGENCY_CAPSULE` 축소 schema와 `RECOVERY_ONLY` 후속 Session이 필요하다.
- 컨텍스트 상태 전이에 hysteresis·단조 latch가 없어 WATCH↔PREPARE 진동 가능성이 있다.
- fork/resume과 Session·handoff_version 의미를 구분해야 한다.
- Mission 사건 hash chain에 단일 기록자와 compare-and-append가 필요하다.
- rollover 기동 비용을 포함한 `projected_startup_cost`가 없으면 compaction보다 비쌀 수 있다.
- 자기진단 probe를 단독 hard trigger로 쓰지 않고 외부 신호와 결합해야 한다.
- L4 원시 탐색은 고갈된 predecessor가 아니라 `RECOVERY_ONLY` successor가 수행해야 한다.
- 복원 시도와 성공의 지표 분모, 기계 시간과 사람 대기 시간을 분리해야 한다.
- 자동화 대상 “저위험 Task”를 판정 가능한 계약으로 정의해야 한다.
- 실제 E2E 전 시험 Session 명명·격리·봉인·정리 규칙을 먼저 확정해야 한다.

## 4. 권위 배치 자문

| 계약 | 권장 단일 소유 |
|---|---|
| 실행 역할·권한·사전 자동 생성 승인 | 팀 구성안 |
| Capsule·Receipt·Session Chain·검색 schema | 온톨로지 |
| 상태 기계·lease·idempotency·복구·능력 매트릭스 | 오케스트레이션 |
| 물리 경로·Git 포함 경계·redacted manifest·보존 | 디렉터리 기획안 |
| 임계·hysteresis·지표·Learning 승격/폐기·활성화 게이트 | 품질 평가안 |

검수자는 이 1차안도 채택 뒤 그림자 권위가 되지 않게 각 절을 `ADOPTED`, `NOT_ADOPTED` 또는
`SUPERSEDED_BY`로 disposition하라고 권고했다.

## 5. 권고 반영 순서

1. RC-07 식별자·재귀 필드 + RC-03 write-ahead·능력 매트릭스
2. RC-04 Mission 전역 활성 Session 유일성
3. RC-02 revoke→NO_OWNER→grant와 fencing lease
4. RC-06 canonical serialization과 drift policy
5. RC-01 외부 결정적 Restore Verifier
6. RC-05 봉인 중 `INTAKE_ONLY`
7. RC-08 격리·redaction·Learning 재검증
8. Minor 일괄 반영

Opus는 적어도 1~5번이 반영되기 전 실제 A→B→C 파일럿을 실행하지 말라고 판정했다.

## 6. 결론

`CHANGES_REQUIRED`. 1차안은 필요한 상태·불변식·지표를 열거했지만, 핵심 속성 일부가 결정적 강제
장치가 아니라 채팅의 자율 준수에 머물렀다. 2차안은 외부 제어 평면, write-ahead 생성, Mission 전역
단일 활성 Session, fencing lease, canonical hash, 비-LLM 복원 비교를 먼저 확정해야 한다.
