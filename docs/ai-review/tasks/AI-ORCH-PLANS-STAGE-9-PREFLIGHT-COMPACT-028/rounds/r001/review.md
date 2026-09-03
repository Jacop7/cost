# AI-ORCH-PLANS-STAGE-9-PREFLIGHT-COMPACT-028 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `d5aa2617966ed246b92c1e67e201c1804bca9b97`

## 요약

봉인 입력 정적 감사 결과 PASS. (1) Task027 실패 보존: run.json이 run_state RUN_FAILED·terminal_reason budget_exhausted·review_sha256/candidate null로 판정 없이 원본 보존됐고, 이번 Task는 이를 PASS나 Finding으로 재사용하지 않았다. (2) 19개 A0 등록: ROLE_CONTEXTS 레지스트리에 정확히 19개 context가 모두 autonomy_stage A0, decision_id DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027, 품질 기획안 policy_hash(66883bb4…), version 1·64hex context_hash로 결속됐으며, 역할 5개 manifest의 context_refs 19개가 레지스트리 hash와 문자열 단위로 1:1 일치한다. 기존 레인 표·Task Packet·재사용 측정 원문과 TEAM_LEARNING v1 장부 4개 항목의 ID·상태·본문은 보존됐다. (3) Learning 4:4 이관: VERIFIED 3건은 LEGACY_READ_ONLY+verifier_decision_id null로 사람 Decision을 소급 생성하지 않았고 CANDIDATE 1건은 CANDIDATE_UNASSIGNED이며, checker가 1:1 대응·중복·VERIFIED/CANDIDATE 계약을 실패 폐쇄로 강제한다. (4) 비권위 manifest: 역할 5·팀 6 manifest 모두 chat_is_approval_authority false이고 FORBIDDEN_MANIFEST_FIELDS 검사로 현재 Task·플러그인 상태·토큰 임계값 복제를 차단하며 정책 본문 복제가 없다. (5) checker 판별력: planned DRAFT tree와 ACTIVE tree 통과, manifest 누락, authority 중복, 미등록 context 참조(hash 불일치 경로), 채팅 권한 위조, 무권위 RISKS 생성, 플러그인 상태 복제의 8개 시험이 존재하고 CLI는 오류 시 exit 1로 실패 폐쇄한다. (6) RISKS.md는 부재하며 README가 권위 미수렴을 명시하고 checker가 UNOWNED_RISKS/MISSING_RISKS 양방향을 강제한다. package/verify 연결·제품·DB·배포·통합 플러그인 변경은 artifact에 없다. (7) 차단성 Finding 없음 → PASS. Improvement 2건만 기록: 레지스트리 내부 context_hash 재계산 실패 경로(CONTEXT_HASH_MISMATCH)의 직접 사보타주 시험 부재, parseRegistry의 route/policy_hash 형식 미검증 및 Learning 이관의 RETIRED/CANDIDATE decision 필드 미제약. 유의: planned-tree PASS(contextCount 19)·사보타주 8/8의 실행 증거는 공동 장부의 SOLAR 주장으로, 코드 정합성은 정적으로 확인했으나 실행 재현은 CODEX-FUNCTION-QA 검증 단계가 확인해야 한다. 본 PASS는 외부 게이트를 닫지 않으며 activation commit·채팅 생성·배포를 승인하지 않는다.

## Findings

### ARCH-028-REGISTRY-HASH-TAMPER-TEST-GAP — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 레지스트리 내부 hash 재계산 검증이 회귀로 약화되어도 현재 시험 8개가 이를 잡지 못해, 위조된 context_hash가 planned-tree/activation 검사를 통과할 수 있는 잠재 회귀 공백이 남는다. 현재 코드 경로는 올바르므로 차단성은 아니다.
- 근거: scripts/docs-graph-check.mjs:190, scripts/docs-graph-check.test.mjs:158
- 완료 조건: 레지스트리 항목의 context_hash만 변조한 fixture가 /ROLE_CONTEXT hash가 내용과 다릅니다/ 실패를 유발하는 사보타주 시험 추가 / 기존 8개 시험과 함께 전체 시험 통과
- 필요한 테스트: docs-graph-check.test.mjs에 CONTEXT_HASH_MISMATCH 직접 변조 부정 시험 1건

### ARCH-028-CONTEXT-BINDING-VALIDATION-LOOSE — Improvement / OPEN

- 범주: CODE
- 영향: 현재 실제 레지스트리와 장부는 모두 유효한 값을 가지므로 즉시 위험은 없으나, 향후 항목 추가 시 route/policy_hash 형식 위조나 RETIRED 이관 상태 누락이 실패 폐쇄되지 않는 검증 공백이 있다.
- 근거: scripts/docs-graph-check.mjs:183, scripts/docs-graph-check.mjs:227
- 완료 조건: parseRegistry가 route 비어 있지 않은 문자열과 policy_hash 64hex를 실패 폐쇄로 검증 / Learning 이관에서 RETIRED 상태의 contract_state 제약을 정의하거나 미정의 상태를 실패 폐쇄
- 필요한 테스트: route 빈 문자열 또는 policy_hash 비hex fixture의 부정 시험 / RETIRED Learning 이관 상태 부정 시험

## 공동 편집 제안

### EDIT-028-HASH-TAMPER-SABOTAGE-TEST — ADD

- 대상: `scripts/docs-graph-check.test.mjs`
- 위치: test('소유권 미수렴 RISKS 파일 생성을 잡는다', () => withFixture((root) => {
- 연결 Finding: ARCH-028-REGISTRY-HASH-TAMPER-TEST-GAP
- 이유: 앵커 시험 앞에 삽입. 레지스트리 내부 context_hash 위조가 CONTEXT_HASH_MISMATCH로 실패 폐쇄되는지 직접 검증하는 사보타주를 추가한다.

    test('레지스트리 항목의 context_hash 변조를 잡는다', () => withFixture((root) => {
      const hashAlgorithm = 'sha256(context_id|version|route|autonomy_stage|decision_id|policy_hash)';
      const tampered = [{
        context_id: 'CTX-ORCH',
        version: 1,
        route: 'NORMAL',
        autonomy_stage: 'A0',
        decision_id: 'DEC-ACTIVATION-001',
        policy_hash: 'b'.repeat(64),
        context_hash: 'c'.repeat(64),
      }];
      put(root, 'docs/team/ROLE_CONTEXTS.md', `# Contexts\n\n<!-- role-context-registry:v1 -->\n\`\`\`json\n${JSON.stringify({ schema_version: '1.0', hash_algorithm: hashAlgorithm, contexts: tampered }, null, 2)}\n\`\`\`\n<!-- /role-context-registry:v1 -->\n`);
      assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /ROLE_CONTEXT hash가 내용과 다릅니다/);
    }));
    

### EDIT-028-REGISTRY-BINDING-VALIDATION — ADD

- 대상: `scripts/docs-graph-check.mjs`
- 위치:     if (context.autonomy_stage !== 'A0') fail('UNAPPROVED_AUTONOMY', `승인 없는 route는 A0이어야 합니다: ${context.context_id}`);
- 연결 Finding: ARCH-028-CONTEXT-BINDING-VALIDATION-LOOSE
- 이유: 앵커 줄 앞에 삽입. route 비어 있지 않은 문자열과 policy_hash 64hex를 실패 폐쇄로 강제해 정책 hash 결속의 형식적 무력화를 막는다.

        if (typeof context.route !== 'string' || !context.route || !/^[0-9a-f]{64}$/.test(context.policy_hash ?? '')) {
          fail('INVALID_CONTEXT_BINDING', `ROLE_CONTEXT route/policy_hash 결속이 잘못됐습니다: ${context.context_id}`);
        }
    

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
