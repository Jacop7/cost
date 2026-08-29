
<!-- fable-review:r001 sha256=6435a2107c28c24aac36e553d0225c056274ce4dc83be003c23ed2f7a27e96ab -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `6435a2107c28c24aac36e553d0225c056274ce4dc83be003c23ed2f7a27e96ab`
- target_commit_sha: `325c3a477c6d529e928cd25996f7b3c5d8b3f362`
- input_files_sha256: `4d676da9eca27733d1a6937b6330e8bac72635aae555a90b17f5e01821442f9a`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: P05-0135-HOSTED-ROLE-CHAIN-PRECHECK-001
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

P0-5-0135-ANON-SWITCH-001 r001의 Finding 3건을 같은 ID로 재검수했다.

코드(0135 l.137-161): 이전 라운드의 구조(전환을 서브블록 밖에서 수행 → `current_user='anon'` 사후조건 → 서브블록 안 `perform` → `set local role %I` 명시 복원 → 복원 사후조건 → `v_ok` 검사)는 유지됐고, 새로 l.148-151이 잡힌 42501의 `sqlerrm`에 `purge_entity_changes`가 없으면 원문을 포함한 자체 예외로 중단한다. 함수 EXECUTE 거부 메시지(`permission denied for function purge_entity_changes`)만 통과하고 스키마 USAGE 거부(`permission denied for schema public`)는 걸러진다. 핸들러 안의 `raise exception`은 서브블록 밖으로 전파돼 DO 블록과 migration 트랜잭션 전체를 중단시키므로 fail-closed다. anon에 EXECUTE가 있으면 l.127-129 정적 검사가 먼저 막고, 도달하더라도 `v_ok=false`로 l.161에서 예외가 나 삭제는 롤백된다. anon·PUBLIC 회수(l.74-75, 82-85, 108-109)와 authenticated·service_role 실행 계약(l.77, 110, 133-135, 172-179)은 변경 없음. 0136(참조)과의 충돌 없음.

증거(문서 l.140-181): 기준 9559b3b·첫 분리 03cd363·최종 구현 bb1ecc5, 0135 blob OID `034a47fb…`·SHA-256 `009190fa…`가 명시됐고, 이 값은 이번 스냅샷 input_files의 0135 blob OID·SHA-256과 정확히 일치한다. 정상 체인 4단계 관측값(l.157-162), 사보타주 `42501: permission denied to set role "anon"`(l.166-168), 스키마 USAGE 사보타주의 자체 오류(l.173-176), 재확인 시각(l.142), 두 SHA 사이 diff 주장(l.150), 절 범위 명시(l.180-181)가 모두 채워져 SHA-BINDING-001의 수용 기준 4개를 충족한다 → VERIFIED. DENIAL-SOURCE-PIN-001도 제안 편집과 동일하게 구현되고 요구한 사보타주 시험이 기록돼 VERIFIED. HOSTED-ROLE-CHAIN-PRECHECK-001은 SOLAR가 스테이징 적용 직전 관측 항목으로 유지한다고 답해 아직 수행되지 않았으므로 OPEN(Improvement, 비차단).

한계: (1) 참조 `P0-5-RPC-LEAST-PRIVILEGE-006/r002/candidate-review.json`은 이번에도 스냅샷에 실체화되지 않았다. (2) 스냅샷에는 0135·0136만 있어 "기준 이후 migration 변경 0135 하나"와 verify 6/6은 문서·장부 진술이며, 증거 절의 최종 구현 commit(bb1ecc5)과 검수 target(325c3a4)이 다르므로 Codex가 bb1ecc5..325c3a4 사이에도 migration 변경이 없고 0135 blob이 `034a47fb…`인지 확인해야 한다. (3) evidence_paths가 비어 있어 Codex 실행 증거는 별도 게이트에서 결속돼야 한다. 필수 등급의 미해결 Finding이 없어 PASS이나, 외부 게이트·스테이징 적용 승인은 열려 있다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
