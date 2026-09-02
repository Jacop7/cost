import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  acquireCollaborationLock,
  acquireQueueLock,
  acquireTaskLock,
  activatePlanDocuments,
  advanceClock,
  appendCollaboration,
  appendDisposition,
  applyAddDisposition,
  applyLearning,
  approvePlanActivation,
  authorizeAction,
  classifyRequest,
  closeFinding,
  createSimulationState,
  demoteAutonomy,
  loadPlanDocuments,
  loadWorkQueue,
  markFindingReady,
  materializeDirectory,
  observeDispositionPrefix,
  proposeLearning,
  promoteAutonomy,
  recordCodexEvidence,
  recordDecision,
  recordDirectoryPreflight,
  recordEvidenceArtifact,
  recordFableRun,
  recordProtectedGate,
  recordRequestPair,
  registerReviewTask,
  registerTask,
  registerFinding,
  registerClosureSuccessor,
  releaseQueueLock,
  releaseTaskLock,
  renewOrTransferLease,
  runHappyPathSimulation,
  updateTask,
  validateDispositionChain,
  validateDocumentNetwork,
  validateLiveTaskLedger,
  validateTaskPacket,
  validateTrace,
  retireLearning,
  verifyFinding,
  verifyLearning,
} from './ai-plan-network-simulation.mjs';

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, `${code} 오류가 나야 합니다.`);
}

const digest = (value) => createHash('sha256').update(value).digest('hex');

function taskInput(taskId = 'TASK-1') {
  return {
    taskId,
    roleId: 'SOLAR-ORCH',
    route: 'R0-DOCS',
    reviewerRole: null,
    predecessorReview: null,
    requirementIds: ['REQ-TEST'],
    requestInputId: `REQUEST:${taskId}`,
    normalizedRequestId: `NORMALIZED:${taskId}`,
    objective: '테스트 범위',
    inScope: [`docs/${taskId}.md`],
    outOfScope: ['apps/**'],
    acceptanceCriteria: ['시험 통과'],
    roles: ['SOLAR', 'CODEX'],
    invariantIds: ['AGENTS:test'],
    humanDecisions: [],
    dependsOn: [],
    conversationRef: `${taskId}:conversation:1`,
    observedAt: '2026-09-02T10:00:00+09:00',
    lastVerifiedSha: 'a'.repeat(40),
    agentsMdBlobSha: 'b'.repeat(40),
    riskLevel: 'R0',
    riskBasis: '문서 변경만 수행한다.',
    assumptions: [{ assumption: 'fixture', verifier: 'CODEX', invalidation: 'fixture 변경' }],
    appliedLearningIds: [],
    excludedLearningIds: [],
    domainInvariants: ['fixture invariant'],
    artifactPaths: [`docs/${taskId}.md`],
    referencePaths: ['AGENTS.md'],
    evidencePaths: ['evidence.json'],
    excludedPaths: ['apps/**'],
    nextSafeAction: '시험 실행',
    stopConditions: ['stale SHA'],
    userOwnedChanges: [{ path: 'apps/**', disposition: 'EXCLUDE' }],
    leaseTtl: 5,
    activeBranch: 'codex/test',
    worktreeState: 'mixed',
    untrackedInScopePaths: [],
    requiredOutputs: ['fixture output'],
    requiredTestsEvidence: ['node:test'],
    knownRisks: ['fixture risk'],
    humanQuestions: [],
  };
}

function register(state, actor = 'chat-a', id = 'TASK-1') {
  const input = taskInput(id);
  recordRequestPair(state, input);
  acquireQueueLock(state, actor);
  acquireTaskLock(state, actor, id);
  registerTask(state, actor, input);
}

function requested(state, input) {
  recordRequestPair(state, input);
  return input;
}

function markTaskDone(state, actor = 'chat-a', taskId = 'TASK-1') {
  const task = state.tasks[taskId];
  if (state.queueLock !== actor) acquireQueueLock(state, actor);
  if (state.taskLocks[taskId]?.actor !== actor) acquireTaskLock(state, actor, taskId);
  if ((state.autonomy[task.route] ?? 'A0') === 'A0') {
    const decisionId = `DEC-A1:${taskId}`;
    recordDecision(state, {
      decisionId, type: 'AUTONOMY_PROMOTION', approver: 'human-owner',
      approvedAt: '2026-09-02T11:59:00+09:00', targetSha: task.lastVerifiedSha,
      subjectTaskId: taskId, route: task.route,
    });
    promoteAutonomy(state, task.route, {
      to: 'A1', decisionId, evidencePassed: true, escapeCount: 0, evaluationWindows: 1,
      sampleCount: 30,
    });
  }
  if (task.currentState === 'DEFINED') {
    updateTask(state, actor, taskId, { currentState: 'IMPLEMENTED' }, observeDispositionPrefix(state, taskId));
  }
  if (task.currentState === 'IMPLEMENTED') {
    updateTask(state, actor, taskId, { currentState: 'REVIEWING' }, observeDispositionPrefix(state, taskId));
  }
  updateTask(state, actor, taskId, { currentState: 'DONE' }, observeDispositionPrefix(state, taskId));
}

function fableRun(roundId, exactSha, auditScope, overrides = {}) {
  const digest = Buffer.from(`fable:${roundId}`).toString('hex').padEnd(64, '0').slice(0, 64);
  const reviewTaskId = overrides.reviewTaskId ?? `review-task:${roundId}`;
  return {
    roundId,
    terminalReason: 'completed',
    verdict: 'PASS',
    exactSha,
    subjectTaskId: 'TASK-1',
    auditScope,
    reviewerRole: 'FABLE-ARCH',
    evidenceRef: `run:${roundId}`,
    reviewerEngine: 'FABLE',
    reviewerModel: 'claude-fable-5',
    cliVersion: '2.1.250',
    sessionRef: `session:${roundId}`,
    roundBudgetUsd: 4,
    taskBudgetUsd: 4,
    reportedUsageUsd: 1,
    structuredResultSha256: digest,
    reviewTaskId,
    reviewMode: 'INITIAL',
    registryMode: 'INITIAL',
    predecessorReview: null,
    independentRequest: null,
    reviewRoute: 'MANDATORY_MUTUAL',
    authorRole: 'SOLAR-ORCH',
    snapshotMode: 'COMMIT',
    taskContractSha256: Buffer.from(`task:${reviewTaskId}`).toString('hex').padEnd(64, '0').slice(0, 64),
    reviewArtifactExists: true,
    ...overrides,
  };
}

function recordFable(state, run) {
  if (!state.reviewTasks[run.reviewTaskId]) {
    registerReviewTask(state, {
      reviewTaskId: run.reviewTaskId,
      subjectTaskId: run.subjectTaskId,
      exactSha: run.exactSha,
      auditScope: run.auditScope,
      reviewRoute: run.reviewRoute,
      authorRole: run.authorRole,
      reviewerRole: run.reviewerRole,
      reviewMode: run.reviewMode,
      snapshotMode: run.snapshotMode,
      independentRequest: run.independentRequest,
      taskBudgetUsd: run.taskBudgetUsd,
      taskContractSha256: run.taskContractSha256,
    });
  }
  return recordFableRun(state, run);
}

function finalFableRun(roundId, exactSha, auditScope, independentRequest) {
  return fableRun(roundId, exactSha, auditScope, {
    reviewerRole: 'FABLE-FINAL', reviewRoute: 'FINAL_INDEPENDENT',
    authorRole: 'AI-DEPUTY-ORCHESTRATOR', reviewMode: 'FINAL', snapshotMode: 'COMMIT',
    independentRequest,
  });
}

function codexEvidence(passId, exactSha, auditScope, overrides = {}) {
  const digest = Buffer.from(`codex:${passId}`).toString('hex').padEnd(64, '0').slice(0, 64);
  return {
    passId,
    exactSha,
    graphPassed: true,
    sabotagePassed: true,
    subjectTaskId: 'TASK-1',
    auditScope,
    evidenceRef: `evidence:${passId}`,
    reviewerSessionRef: `session:${passId}`,
    evidenceSha256: digest,
    ...overrides,
  };
}

function gateEvidence(exactSha, id) {
  return {
    exactSha, fullDbRequired: 'success', protectedGate: 'success',
    evidenceRef: `ci:${id}`, evidenceSha256: Buffer.from(`gate:${id}`).toString('hex').padEnd(64, '0').slice(0, 64),
  };
}

function recordGate(state, exactSha, id) {
  const gate = gateEvidence(exactSha, id);
  recordEvidenceArtifact(state, {
    evidenceRef: gate.evidenceRef, evidenceSha256: gate.evidenceSha256,
    kind: 'PROTECTED_GATE', exactSha,
  });
  recordProtectedGate(state, gate);
}

function preflightEvidence(id) {
  return Buffer.from(`preflight:${id}`).toString('hex').padEnd(64, '0').slice(0, 64);
}

function recordPreflightArtifact(state, exactSha, id, evidenceRef = `evidence:${id}`) {
  const evidenceSha256 = preflightEvidence(id);
  recordEvidenceArtifact(state, {
    evidenceRef, evidenceSha256, kind: 'DIRECTORY_PREFLIGHT', exactSha,
  });
  return { evidenceRef, evidenceSha256 };
}

function recordLearningArtifacts(state, exactSha, id, count = 2) {
  return Array.from({ length: count }, (_, index) => {
    const evidenceRef = `learning:${id}:${index + 1}`;
    const evidenceSha256 = Buffer.from(evidenceRef).toString('hex').padEnd(64, '0').slice(0, 64);
    recordEvidenceArtifact(state, {
      evidenceRef, evidenceSha256, kind: 'LEARNING_SOURCE', exactSha,
      sourceCaseId: `${id}:case:${index + 1}`,
    });
    return evidenceRef;
  });
}

function mutateLiveSimulationTask(text, mutate) {
  const pattern = /(## AI-ORCH-PLANS-SIM-1[^\n]*\n[\s\S]*?```yaml\n)([\s\S]*?)(\n```)/;
  assert.match(text, pattern);
  return text.replace(pattern, (_, prefix, block, suffix) => `${prefix}${mutate(block)}${suffix}`);
}

test('다섯 문서는 강연결 탐색망과 비순환 권위 DAG를 함께 가진다', () => {
  const result = validateDocumentNetwork(loadPlanDocuments());
  assert.equal(result.nodeCount, 5);
  assert.equal(result.referenceStronglyConnected, true);
  assert.equal(result.authorityAcyclic, true);
});

test('탐색 링크 하나를 끊으면 문서 네트워크 검사가 잡는다', () => {
  const docs = loadPlanDocuments();
  docs.team = docs.team.replaceAll('AI-품질-학습-자율성-평가기획안.md', 'REMOVED.md');
  assert.throws(() => validateDocumentNetwork(docs), /team (?:→ quality Markdown 참조|깨진 Markdown 링크)/);
});

test('권위 의존에 순환을 넣으면 DAG 검사가 잡는다', () => {
  const cycle = {
    team: ['quality'], ontology: ['team'], orchestration: ['ontology'], directory: ['orchestration'], quality: ['directory'],
  };
  assert.throws(() => validateDocumentNetwork(loadPlanDocuments(), cycle), /권위\/의존 그래프 순환/);
  const declaredCycle = loadPlanDocuments();
  declaredCycle.directory = declaredCycle.directory.replace('| team | [] |', '| team | [quality] |');
  assert.throws(() => validateDocumentNetwork(declaredCycle), /문서 권위 DAG 선언/);
});

test('중앙 권위 표에서 다섯 노드 소유권 하나를 빼면 잡는다', () => {
  const docs = loadPlanDocuments();
  docs.directory = docs.directory.replace('품질 평가·Learning 승격·강등·자율성 단계 | 평가 기획안', 'REMOVED | REMOVED');
  assert.throws(() => validateDocumentNetwork(docs), /directory 필수 계약 누락/);
});

test('중앙 권위 표에서 소유자를 바꾸거나 같은 주제를 복제하면 잡는다', () => {
  const wrongOwner = loadPlanDocuments();
  wrongOwner.directory = wrongOwner.directory.replace(
    '| 요청 수신·업무 정의·라우팅 | 오케스트레이션 기획안 |',
    '| 요청 수신·업무 정의·라우팅 | 팀 구성안 |',
  );
  assert.throws(() => validateDocumentNetwork(wrongOwner), /중앙 권위 불일치/);

  const duplicated = loadPlanDocuments();
  duplicated.directory = duplicated.directory.replace(
    '| 품질 평가·Learning 승격·강등·자율성 단계 | 평가 기획안 |',
    '| 품질 평가·Learning 승격·강등·자율성 단계 | 평가 기획안 |\n| 품질 평가·Learning 승격·강등·자율성 단계 | 평가 기획안 |',
  );
  assert.throws(() => validateDocumentNetwork(duplicated), /중앙 권위 주제가 중복/);
});

test('정상 업무는 요청→Task→Codex/Fable→사람 승인→배치→Learning으로 이어진다', () => {
  const state = runHappyPathSimulation();
  assert.equal(state.executionBoundary, 'VIRTUAL_SIMULATION');
  assert.equal(state.audit.find((entry) => entry.type === 'PLANS_ACTIVATED').virtualOnly, true);
  assert.equal(Object.keys(state.tasks).length, 2);
  assert.equal(state.tasks['AI-PLANS-PILOT-001'].requestDispositions.length, 4);
  assert.equal(state.planReviewRuns.length, 5);
  assert.equal(state.planReviewRuns[0].runState, 'RUN_FAILED');
  assert.equal(state.findings['FABLE-WORKFLOW-001'].reviewState, 'VERIFIED');
  assert.equal(state.directoryMaterialized, true);
  assert.equal(state.learning['LRN-AI-PLANS-001'].status, 'VERIFIED');
  assert.deepEqual(state.learning['LRN-AI-PLANS-001'].appliedTasks, ['AI-PLANS-SEPARATE-002']);
});

test('현재 시뮬레이션 Task는 실제 작업큐에서 복원 가능한 계약이다', () => {
  const result = validateLiveTaskLedger(loadWorkQueue());
  assert.equal(result.taskId, 'AI-ORCH-PLANS-SIM-1');
  assert.equal(result.dispositionCount, 1);
});

test('Task 필수 복원 필드나 risk 근거가 빠지면 환경 미검증이다', () => {
  const state = createSimulationState();
  register(state);
  delete state.tasks['TASK-1'].riskBasis;
  assert.throws(() => validateTaskPacket(state.tasks['TASK-1']), /riskBasis/);
});

test('Task는 존재하는 원 요청과 동일 payload의 정규화 요청에서만 만들어진다', () => {
  const state = createSimulationState();
  acquireQueueLock(state, 'chat-a');
  acquireTaskLock(state, 'chat-a', 'TASK-1');
  expectCode(() => registerTask(state, 'chat-a', taskInput('TASK-1')), 'NORMALIZED_REQUEST_REQUIRED');

  const changed = createSimulationState();
  const input = taskInput('TASK-1');
  recordRequestPair(changed, input);
  acquireQueueLock(changed, 'chat-a');
  acquireTaskLock(changed, 'chat-a', 'TASK-1');
  expectCode(() => registerTask(changed, 'chat-a', {
    ...input, objective: '정규화 뒤 몰래 바꾼 목표',
  }), 'NORMALIZED_REQUEST_REQUIRED');
});

test('Task별 disposition chain은 다른 Task와 seq를 공유하지 않는다', () => {
  const state = createSimulationState();
  register(state, 'chat-a', 'TASK-A');
  releaseTaskLock(state, 'chat-a', 'TASK-A');
  releaseQueueLock(state, 'chat-a');
  register(state, 'chat-b', 'TASK-B');
  assert.equal(state.tasks['TASK-A'].requestDispositions[0].seq, 1);
  assert.equal(state.tasks['TASK-B'].requestDispositions[0].seq, 1);
});

test('disposition enum 오탈자와 hash chain 손상을 잡는다', () => {
  const state = createSimulationState();
  register(state);
  expectCode(() => appendDisposition(state, 'chat-a', 'TASK-1', {
    kind: 'ADD_TO_EXISTING', evidenceConversationRef: 'x', observedAt: 'x', requiresHumanApproval: false,
  }), 'BAD_DISPOSITION');
  state.tasks['TASK-1'].requestDispositions[0].itemHash = 'tampered';
  assert.throws(() => validateDispositionChain(state.tasks['TASK-1']), /item hash/);
});

test('비소유 채팅 append는 disposition 외 Task 필드를 바꾸지 않는다', () => {
  const state = createSimulationState();
  register(state);
  releaseTaskLock(state, 'chat-a', 'TASK-1');
  releaseQueueLock(state, 'chat-a');
  const before = structuredClone(state.tasks['TASK-1']);
  acquireQueueLock(state, 'chat-b');
  appendDisposition(state, 'chat-b', 'TASK-1', {
    kind: 'STATUS_ONLY', evidenceConversationRef: 'b:1', observedAt: '2026-09-02T10:01:00+09:00', requiresHumanApproval: false,
  });
  const after = structuredClone(state.tasks['TASK-1']);
  assert.deepEqual({ ...after, requestDispositions: [] }, { ...before, requestDispositions: [] });
});

test('lease 소유자의 stale prefix 전체 쓰기는 다른 채팅 append를 지울 수 없다', () => {
  const state = createSimulationState();
  register(state);
  const stale = observeDispositionPrefix(state, 'TASK-1');
  releaseTaskLock(state, 'chat-a', 'TASK-1');
  releaseQueueLock(state, 'chat-a');
  acquireQueueLock(state, 'chat-b');
  appendDisposition(state, 'chat-b', 'TASK-1', {
    kind: 'ADD', evidenceConversationRef: 'b:2', observedAt: '2026-09-02T10:02:00+09:00', requiresHumanApproval: false,
    changePayload: { addInScope: [], addAcceptanceCriteria: ['추가 조건'], addArtifactPaths: [] },
  });
  releaseQueueLock(state, 'chat-b');
  acquireQueueLock(state, 'chat-a');
  acquireTaskLock(state, 'chat-a', 'TASK-1');
  assert.throws(() => updateTask(state, 'chat-a', 'TASK-1', { currentState: 'DONE' }, stale), /환경 미검증/);
});

test('Task lock 역순과 collaboration lock 중첩은 거부되고 정상 append는 가능하다', () => {
  const state = createSimulationState();
  expectCode(() => acquireTaskLock(state, 'chat-a', 'TASK-1'), 'LOCK_ORDER');
  register(state);
  expectCode(() => appendCollaboration(state, 'chat-a', 'TASK-1', 'SOLAR_RESPONSE'), 'LOCK_NEST');
  releaseTaskLock(state, 'chat-a', 'TASK-1');
  releaseQueueLock(state, 'chat-a');
  acquireCollaborationLock(state, 'chat-a', 'TASK-1');
  appendCollaboration(state, 'chat-a', 'TASK-1', 'SOLAR_RESPONSE');
  assert.equal(state.audit.at(-1).type, 'COLLABORATION_APPEND');
});

test('만료 lease는 사람 인계 Decision 없이 자동 인수되지 않는다', () => {
  const state = createSimulationState();
  register(state);
  releaseTaskLock(state, 'chat-a', 'TASK-1');
  releaseQueueLock(state, 'chat-a');
  advanceClock(state, 10);
  acquireQueueLock(state, 'chat-b');
  acquireTaskLock(state, 'chat-b', 'TASK-1');
  expectCode(() => renewOrTransferLease(state, 'chat-b', 'TASK-1'), 'HANDOFF_REQUIRED');
  assert.equal(state.tasks['TASK-1'].editOwner, 'chat-a');
});

test('Task 소유자·세션·lease 직접 변조는 새 작업자의 쓰기 전에 차단된다', () => {
  const state = createSimulationState();
  register(state);
  releaseTaskLock(state, 'chat-a', 'TASK-1');
  releaseQueueLock(state, 'chat-a');
  state.tasks['TASK-1'].editOwner = 'chat-b';
  state.tasks['TASK-1'].ownerSessionRef = 'session:chat-b';
  state.tasks['TASK-1'].leaseExpiresAt = state.clock + 100;
  acquireQueueLock(state, 'chat-b');
  acquireTaskLock(state, 'chat-b', 'TASK-1');
  expectCode(() => updateTask(state, 'chat-b', 'TASK-1', {
    currentState: 'IMPLEMENTED',
  }, observeDispositionPrefix(state, 'TASK-1')), 'LEASE_AUDIT_MISMATCH');
  expectCode(() => validateTrace(state), 'LEASE_AUDIT_MISMATCH');
});

test('Fable 실패는 보존되고 PASS·유효 회차로 합성되지 않는다', () => {
  const state = createSimulationState();
  register(state);
  recordFable(state, fableRun('r1', 'a'.repeat(40), 'WORKFLOW', {
    terminalReason: 'timeout', verdict: null,
  }));
  recordFable(state, fableRun('r2', 'a'.repeat(40), 'NETWORK'));
  assert.equal(state.planReviewRuns.length, 2);
  assert.equal(state.planReviewRuns[0].verdict, null);
  assert.equal(state.planReviewRuns[0].valid, false);
  state.planReviewRuns[0].verdict = 'PASS';
  assert.throws(() => validateTrace(state), /PASS로 합성/);
});

test('Finding은 같은 ID·최초 발견 역할·정확한 수정 SHA로만 VERIFIED가 된다', () => {
  const state = createSimulationState();
  const beforeSha = 'a'.repeat(40);
  const fixedSha = 'b'.repeat(40);
  register(state);
  registerFinding(state, {
    findingId: 'F-1', fingerprint: 'same-root-cause', discoveredByRole: 'FABLE-ARCH', exactSha: beforeSha,
    subjectTaskId: 'TASK-1', sourceRoundId: 'finding-source',
  });
  recordFable(state, fableRun('finding-source', beforeSha, 'WORKFLOW', {
    verdict: 'CHANGES_REQUIRED', requiredFindings: ['F-1'],
  }));
  expectCode(() => registerFinding(state, {
    findingId: 'F-NEW', fingerprint: 'same-root-cause', discoveredByRole: 'FABLE-ARCH', exactSha: beforeSha,
    subjectTaskId: 'TASK-1', sourceRoundId: 'finding-source',
  }), 'FINDING_ID_LAUNDERING');
  markFindingReady(state, { findingId: 'F-1', actorRole: 'SOLAR', fixSha: fixedSha });
  updateTask(state, 'chat-a', 'TASK-1', { lastVerifiedSha: fixedSha }, observeDispositionPrefix(state, 'TASK-1'));
  expectCode(() => verifyFinding(state, {
    findingId: 'F-1', reviewerRole: 'CODEX', exactSha: fixedSha,
  }), 'FINDING_REVIEWER_REQUIRED');
  expectCode(() => verifyFinding(state, {
    findingId: 'F-1', reviewerRole: 'FABLE-ARCH', exactSha: 'c'.repeat(40),
  }), 'FINDING_SHA_MISMATCH');
  expectCode(() => verifyFinding(state, {
    findingId: 'F-1', reviewerRole: 'FABLE-ARCH', exactSha: fixedSha, reviewRoundId: 'missing',
  }), 'FINDING_RECHECK_REQUIRED');
  recordFable(state, fableRun('finding-recheck', fixedSha, 'FINDING_RECHECK', {
    registryMode: 'RECHECK', predecessorReview: 'finding-source',
  }));
  verifyFinding(state, {
    findingId: 'F-1', reviewerRole: 'FABLE-ARCH', exactSha: fixedSha, reviewRoundId: 'finding-recheck',
  });
  assert.equal(state.findings['F-1'].reviewState, 'VERIFIED');
});

test('Finding CLOSED는 동일 발견 역할의 closure successor와 exact-SHA 보호 gate가 필요하다', () => {
  const state = createSimulationState();
  const exactSha = 'd'.repeat(40);
  register(state);
  registerFinding(state, {
    findingId: 'F-1', fingerprint: 'closure-contract', discoveredByRole: 'FABLE-ARCH', exactSha: 'a'.repeat(40),
    subjectTaskId: 'TASK-1', sourceRoundId: 'closure-source',
  });
  recordFable(state, fableRun('closure-source', 'a'.repeat(40), 'WORKFLOW', {
    verdict: 'CHANGES_REQUIRED', requiredFindings: ['F-1'],
  }));
  markFindingReady(state, { findingId: 'F-1', actorRole: 'SOLAR', fixSha: exactSha });
  updateTask(state, 'chat-a', 'TASK-1', { lastVerifiedSha: exactSha }, observeDispositionPrefix(state, 'TASK-1'));
  recordFable(state, fableRun('closure-recheck', exactSha, 'FINDING_RECHECK', {
    registryMode: 'RECHECK', predecessorReview: 'closure-source',
  }));
  verifyFinding(state, {
    findingId: 'F-1', reviewerRole: 'FABLE-ARCH', exactSha, reviewRoundId: 'closure-recheck',
  });
  recordFable(state, fableRun('closure-pass', exactSha, 'NETWORK_CLOSURE'));
  expectCode(() => closeFinding(state, {
    findingId: 'F-1', reviewerRole: 'FABLE-ARCH', successorId: 'CLOSE-1',
  }), 'CLOSURE_SUCCESSOR_REQUIRED');
  recordGate(state, 'e'.repeat(40), 'wrong');
  expectCode(() => registerClosureSuccessor(state, {
    successorId: 'CLOSE-1', reviewerRole: 'FABLE-ARCH', exactSha,
    findingIds: ['F-1'], evidenceRef: 'closure:1', sourceRoundId: 'closure-pass',
  }), 'PROTECTED_GATE_REQUIRED');
  recordGate(state, exactSha, 'closure');
  expectCode(() => registerClosureSuccessor(state, {
    successorId: 'CLOSE-GHOST', reviewerRole: 'FABLE-ARCH', exactSha,
    findingIds: ['F-1'], evidenceRef: 'closure:ghost', sourceRoundId: 'ghost-round',
  }), 'CLOSURE_SUCCESSOR_REQUIRED');
  registerClosureSuccessor(state, {
    successorId: 'CLOSE-1', reviewerRole: 'FABLE-ARCH', exactSha,
    findingIds: ['F-1'], evidenceRef: 'closure:1', sourceRoundId: 'closure-pass',
  });
  closeFinding(state, { findingId: 'F-1', reviewerRole: 'FABLE-ARCH', successorId: 'CLOSE-1' });
  assert.equal(state.findings['F-1'].reviewState, 'CLOSED');
});

test('열린 필수 Finding은 겉보기 PASS와 사람 활성화 결정을 모두 막는다', () => {
  const state = createSimulationState();
  const exactSha = 'a'.repeat(40);
  register(state);
  registerFinding(state, {
    findingId: 'F-OPEN', fingerprint: 'still-open', discoveredByRole: 'FABLE-ARCH', exactSha,
    subjectTaskId: 'TASK-1', sourceRoundId: 'f-open-source',
  });
  recordFable(state, fableRun('f-open-source', exactSha, 'DISCOVERY', {
    verdict: 'CHANGES_REQUIRED', requiredFindings: ['F-OPEN'],
  }));
  recordCodexEvidence(state, codexEvidence('c1', exactSha, 'CONTRACT_AUDIT'));
  recordCodexEvidence(state, codexEvidence('c2', exactSha, 'ADVERSARIAL_AUDIT'));
  recordFable(state, finalFableRun('f1', exactSha, 'WORKFLOW_FIDELITY', 'open-workflow'));
  recordFable(state, finalFableRun('f2', exactSha, 'NETWORK_CLOSURE', 'open-network'));
  assert.equal(state.planReviewRuns.find((run) => run.roundId === 'f-open-source').valid, false);
  assert.equal(state.planReviewRuns.filter((run) => ['f1', 'f2'].includes(run.roundId)).every((run) => run.valid), true);
  expectCode(() => approvePlanActivation(state, {
    decisionId: 'DEC-1', approver: 'human-owner', approvedAt: '2026-09-02T12:00:00+09:00',
    reviewTargetSha: exactSha, subjectTaskId: 'TASK-1',
  }), 'REQUIRED_FINDINGS_OPEN');
});

test('Codex 2회·Fable 2회 전에는 사람도 활성화 Decision을 만들 수 없다', () => {
  const state = createSimulationState();
  const exactSha = 'a'.repeat(40);
  register(state);
  recordCodexEvidence(state, codexEvidence('c1', exactSha, 'CONTRACT_AUDIT'));
  recordFable(state, finalFableRun('f1', exactSha, 'WORKFLOW_FIDELITY', 'partial-workflow'));
  expectCode(() => approvePlanActivation(state, {
    decisionId: 'DEC-1', approver: 'human-owner', approvedAt: '2026-09-02T12:00:00+09:00',
    reviewTargetSha: exactSha, subjectTaskId: 'TASK-1',
  }), 'FABLE_TWO_PASSES_REQUIRED');
  recordFable(state, finalFableRun('f2', exactSha, 'NETWORK_CLOSURE', 'partial-network'));
  expectCode(() => approvePlanActivation(state, {
    decisionId: 'DEC-1', approver: 'human-owner', approvedAt: '2026-09-02T12:00:00+09:00',
    reviewTargetSha: exactSha, subjectTaskId: 'TASK-1',
  }), 'CODEX_TWO_PASSES_REQUIRED');
});

test('Fable 2 PASS만으로 문서 ACTIVE나 디렉터리 생성을 선언할 수 없다', () => {
  const state = createSimulationState();
  const exactSha = 'a'.repeat(40);
  register(state);
  recordCodexEvidence(state, codexEvidence('c1', exactSha, 'CONTRACT_AUDIT'));
  recordCodexEvidence(state, codexEvidence('c2', exactSha, 'ADVERSARIAL_AUDIT'));
  recordFable(state, finalFableRun('f1', exactSha, 'WORKFLOW_FIDELITY', 'activation-workflow'));
  recordFable(state, finalFableRun('f2', exactSha, 'NETWORK_CLOSURE', 'activation-network'));
  markTaskDone(state);
  approvePlanActivation(state, {
    decisionId: 'DEC-1', approver: 'human-owner', approvedAt: '2026-09-02T12:00:00+09:00',
    reviewTargetSha: exactSha, subjectTaskId: 'TASK-1',
  });
  expectCode(() => activatePlanDocuments(state, {
    decisionId: 'DEC-1', activationCommitSha: 'b'.repeat(40), parentReviewSha: exactSha,
    changedPlanIds: ['ontology', 'orchestration', 'directory', 'quality'],
    agentsResponsibilitiesUpdated: false, decisionRecordedInCommit: true,
  }), 'ATOMIC_ACTIVATION_REQUIRED');
  expectCode(() => materializeDirectory(state, {
    decisionId: 'DEC-1', exactSha, preflightId: 'missing',
  }), 'ACTIVATION_DECISION_MISMATCH');
});

test('디렉터리 이동은 checker·path map·사용자 파일·옛 참조·exact SHA·보호 gate를 모두 확인한다', () => {
  const state = runHappyPathSimulation();
  const exactSha = state.activationCommitSha;
  state.directoryMaterialized = false;
  const userConflictEvidence = recordPreflightArtifact(state, exactSha, 'user-conflict', 'evidence:checker-user');
  expectCode(() => recordDirectoryPreflight(state, {
    preflightId: 'PREFLIGHT-USER-CONFLICT', exactSha, checkerEvidenceRef: userConflictEvidence.evidenceRef,
    pathMap: [{ from: 'docs/a.md', to: 'docs/b.md' }],
    userOwnedOverlap: ['apps/mobile/user.ts'], oldReferenceCount: 0,
    checkerEvidenceSha256: userConflictEvidence.evidenceSha256,
  }), 'USER_OR_REFERENCE_BLOCK');
  const badMapEvidence = recordPreflightArtifact(state, exactSha, 'bad-map', 'evidence:checker-bad-map');
  expectCode(() => recordDirectoryPreflight(state, {
    preflightId: 'PREFLIGHT-BAD-MAP', exactSha, checkerEvidenceRef: badMapEvidence.evidenceRef,
    pathMap: [{}], userOwnedOverlap: [], oldReferenceCount: 0,
    checkerEvidenceSha256: badMapEvidence.evidenceSha256,
  }), 'MIGRATION_PATH_UNSAFE');
  const staleEvidence = recordPreflightArtifact(state, 'e'.repeat(40), 'stale', 'evidence:checker-stale');
  recordDirectoryPreflight(state, {
    preflightId: 'PREFLIGHT-STALE', exactSha: 'e'.repeat(40), checkerEvidenceRef: staleEvidence.evidenceRef,
    pathMap: [{ from: 'docs/a.md', to: 'docs/b.md' }],
    userOwnedOverlap: [], oldReferenceCount: 0,
    checkerEvidenceSha256: staleEvidence.evidenceSha256,
  });
  expectCode(() => materializeDirectory(state, {
    decisionId: 'DEC-AI-PLANS-ACTIVE', exactSha: 'e'.repeat(40), preflightId: 'PREFLIGHT-STALE',
  }), 'STALE_SHA');
  state.protectedGates = [];
  expectCode(() => materializeDirectory(state, {
    decisionId: 'DEC-AI-PLANS-ACTIVE', exactSha, preflightId: 'PREFLIGHT-AI-PLANS-001',
  }), 'PROTECTED_GATE_REQUIRED');
});

test('Learning은 CANDIDATE·VERIFIED·RETIRED만 쓰고 검증·Decision·route 경계를 지킨다', () => {
  const state = createSimulationState();
  register(state, 'chat-a', 'TASK-1');
  releaseTaskLock(state, 'chat-a', 'TASK-1');
  releaseQueueLock(state, 'chat-a');
  acquireQueueLock(state, 'chat-b');
  acquireTaskLock(state, 'chat-b', 'TASK-2');
  registerTask(state, 'chat-b', requested(state, { ...taskInput('TASK-2'), appliedLearningIds: ['LRN-1'] }));
  const sourceSha = 'a'.repeat(40);
  const learningEvidence = recordLearningArtifacts(state, sourceSha, 'finding-1');
  proposeLearning(state, 'LRN-1', {
    evidenceRefs: learningEvidence, appliesTo: ['R0-DOCS'], excludes: ['SECURITY-FIRST'],
    conflictsWith: [], supersedes: [], reviewBy: '2027-02-28', invalidationCondition: 'fixture contract change',
    authorRole: 'SOLAR', laneOwnerRole: 'AI-DEPUTY-ORCHESTRATOR',
    sourceTaskId: 'TASK-1', sourceSha,
  });
  expectCode(() => applyLearning(state, 'LRN-1', { taskId: 'TASK-2', route: 'R0-DOCS' }), 'LEARNING_NOT_VERIFIED');
  recordDecision(state, {
    decisionId: 'DEC-LRN', type: 'LEARNING_VERIFIER', approver: 'human-owner',
    approvedAt: '2026-09-02T12:00:00+09:00', targetSha: sourceSha, verifierRole: 'CODEX',
  });
  expectCode(() => verifyLearning(state, 'LRN-1', {
    verifier: 'UNAPPOINTED-STRANGER', decisionId: 'DEC-LRN', independent: true,
  }), 'LEARNING_NOT_VERIFIED');
  expectCode(() => verifyLearning(state, 'LRN-1', {
    verifier: 'SOLAR', decisionId: 'DEC-LRN', independent: true,
  }), 'LEARNING_NOT_VERIFIED');
  expectCode(() => verifyLearning(state, 'LRN-1', {
    verifier: 'AI-DEPUTY-ORCHESTRATOR', decisionId: 'DEC-LRN', independent: true,
  }), 'LEARNING_NOT_VERIFIED');
  verifyLearning(state, 'LRN-1', { verifier: 'CODEX', decisionId: 'DEC-LRN', independent: true });
  expectCode(() => applyLearning(state, 'LRN-1', { taskId: 'TASK-2', route: 'SECURITY-FIRST' }), 'LEARNING_ROUTE_MISMATCH');
  expectCode(() => applyLearning(state, 'LRN-1', { taskId: 'TASK-2', route: 'FINAL_INDEPENDENT' }), 'LEARNING_ROUTE_MISMATCH');
  applyLearning(state, 'LRN-1', { taskId: 'TASK-2', route: 'R0-DOCS' });
  assert.equal(state.learning['LRN-1'].status, 'VERIFIED');
  retireLearning(state, 'LRN-1', '새 반례 발견');
  assert.deepEqual(
    state.audit.filter((entry) => entry.type.startsWith('LEARNING_')).map((entry) => entry.type),
    ['LEARNING_PROPOSED', 'LEARNING_VERIFIED', 'LEARNING_APPLIED', 'LEARNING_RETIRED'],
  );
  expectCode(() => applyLearning(state, 'LRN-1', { taskId: 'TASK-2', route: 'R0-DOCS' }), 'LEARNING_NOT_VERIFIED');
});

test('Learning 검토기한 만료와 감사 원본을 거스르는 상태 역행을 거부한다', () => {
  const expired = createSimulationState();
  register(expired, 'chat-a', 'TASK-1');
  releaseTaskLock(expired, 'chat-a', 'TASK-1');
  releaseQueueLock(expired, 'chat-a');
  acquireQueueLock(expired, 'chat-b');
  acquireTaskLock(expired, 'chat-b', 'TASK-2');
  registerTask(expired, 'chat-b', requested(expired, { ...taskInput('TASK-2'), appliedLearningIds: ['LRN-EXPIRED'] }));
  const sourceSha = 'a'.repeat(40);
  const evidenceRefs = recordLearningArtifacts(expired, sourceSha, 'expired-learning');
  proposeLearning(expired, 'LRN-EXPIRED', {
    evidenceRefs, appliesTo: ['R0-DOCS'], excludes: [], conflictsWith: [], supersedes: [],
    reviewBy: '2020-01-01', invalidationCondition: 'fixture contract change',
    authorRole: 'SOLAR', laneOwnerRole: 'AI-DEPUTY-ORCHESTRATOR', sourceTaskId: 'TASK-1', sourceSha,
  });
  recordDecision(expired, {
    decisionId: 'DEC-LRN-EXPIRED', type: 'LEARNING_VERIFIER', approver: 'human-owner',
    approvedAt: '2026-09-02T12:00:00+09:00', targetSha: sourceSha, verifierRole: 'CODEX',
  });
  verifyLearning(expired, 'LRN-EXPIRED', {
    verifier: 'CODEX', decisionId: 'DEC-LRN-EXPIRED', independent: true,
  });
  expectCode(() => applyLearning(expired, 'LRN-EXPIRED', {
    taskId: 'TASK-2', route: 'R0-DOCS',
  }), 'LEARNING_REVIEW_EXPIRED');

  const rollback = runHappyPathSimulation();
  rollback.learning['LRN-AI-PLANS-001'].status = 'CANDIDATE';
  assert.throws(() => validateTrace(rollback), /Learning 현재 상태/);
});

test('Learning 검증 Decision은 하나의 Learning에만 소비되고 승인자는 registry에 있어야 한다', () => {
  const forged = createSimulationState();
  expectCode(() => recordDecision(forged, {
    decisionId: 'DEC-FORGED', type: 'LEARNING_VERIFIER', approver: 'human-forged',
    approvedAt: '2026-09-02T12:00:00+09:00', targetSha: 'a'.repeat(40), verifierRole: 'CODEX',
  }), 'HUMAN_REQUIRED');

  const state = createSimulationState();
  register(state);
  const sourceSha = 'a'.repeat(40);
  for (const id of ['LRN-A', 'LRN-B']) {
    proposeLearning(state, id, {
      evidenceRefs: recordLearningArtifacts(state, sourceSha, id), appliesTo: ['R0-DOCS'],
      excludes: [], conflictsWith: [], supersedes: [], reviewBy: '2027-02-28',
      invalidationCondition: 'fixture contract change', authorRole: 'SOLAR',
      laneOwnerRole: 'AI-DEPUTY-ORCHESTRATOR', sourceTaskId: 'TASK-1', sourceSha,
    });
  }
  recordDecision(state, {
    decisionId: 'DEC-LRN-ONCE', type: 'LEARNING_VERIFIER', approver: 'human-owner',
    approvedAt: '2026-09-02T12:00:00+09:00', targetSha: sourceSha, verifierRole: 'CODEX',
  });
  verifyLearning(state, 'LRN-A', { verifier: 'CODEX', decisionId: 'DEC-LRN-ONCE', independent: true });
  expectCode(() => verifyLearning(state, 'LRN-B', {
    verifier: 'CODEX', decisionId: 'DEC-LRN-ONCE', independent: true,
  }), 'LEARNING_NOT_VERIFIED');
  validateTrace(state);
});

test('품질 사고 자동 강등은 A3에서 A2로 정확히 한 단계만 내린다', () => {
  const state = createSimulationState();
  state.autonomy['database-change'] = 'A3';
  demoteAutonomy(state, 'database-change', 'stale SHA');
  assert.equal(state.autonomy['database-change'], 'A2');
  assert.equal(state.audit.at(-1).type, 'AUTONOMY_DEMOTED');
  assert.equal(state.audit.at(-1).from, 'A3');
  assert.equal(state.audit.at(-1).to, 'A2');
});

test('protected gate가 다른 SHA면 디렉터리 물질화에 쓸 수 없다', () => {
  const state = runHappyPathSimulation();
  state.directoryMaterialized = false;
  state.protectedGates = [];
  recordGate(state, 'f'.repeat(40), 'other-sha');
  expectCode(() => materializeDirectory(state, {
    decisionId: 'DEC-AI-PLANS-ACTIVE', exactSha: state.activationCommitSha,
    preflightId: 'PREFLIGHT-AI-PLANS-001',
  }), 'PROTECTED_GATE_REQUIRED');
});

test('요청 의미 분류는 상태 확인보다 취소·결과 변경을 우선하고 새 Task 경계를 가른다', () => {
  assert.equal(classifyRequest({ statusOnly: true }), 'STATUS_ONLY');
  assert.equal(classifyRequest({ statusOnly: true, cancelsWork: true }), 'SUPERSEDE_PROPOSAL');
  assert.equal(classifyRequest({ changesOutcome: true }), 'SUPERSEDE_PROPOSAL');
  assert.equal(classifyRequest({ sameArtifact: false }), 'NEW_TASK');
  assert.equal(classifyRequest({ sameRisk: false }), 'NEW_TASK');
  assert.equal(classifyRequest({ sameReleaseCycle: false }), 'NEW_TASK');
  assert.equal(classifyRequest({}), 'ADD');
});

test('같은 작업자도 겹치는 artifact lease를 두 Task에 가질 수 없고 update로 우회할 수 없다', () => {
  const state = createSimulationState();
  register(state, 'chat-a', 'TASK-A');
  releaseTaskLock(state, 'chat-a', 'TASK-A');
  releaseQueueLock(state, 'chat-a');
  acquireQueueLock(state, 'chat-a');
  acquireTaskLock(state, 'chat-a', 'TASK-B');
  expectCode(() => registerTask(state, 'chat-a', requested(state, {
    ...taskInput('TASK-B'), artifactPaths: ['docs/TASK-A.md/nested.md'],
  })), 'ARTIFACT_LEASE_CONFLICT');

  const other = createSimulationState();
  register(other);
  expectCode(() => updateTask(other, 'chat-a', 'TASK-1', {
    artifactPaths: ['docs/other.md'],
  }, observeDispositionPrefix(other, 'TASK-1')), 'TASK_CONTROL_FIELD');
});

test('목표·범위 변경은 Task와 SHA에 결속된 사람 SUPERSEDE Decision 뒤에만 적용된다', () => {
  const state = createSimulationState();
  register(state);
  const observed = observeDispositionPrefix(state, 'TASK-1');
  expectCode(() => updateTask(state, 'chat-a', 'TASK-1', {
    objective: '승인 없는 새 목표',
  }, observed), 'SUPERSEDE_DECISION_REQUIRED');
  recordDecision(state, {
    decisionId: 'DEC-SUPERSEDE', type: 'SUPERSEDE', approver: 'human-owner',
    approvedAt: '2026-09-02T12:00:00+09:00', targetSha: 'a'.repeat(40), subjectTaskId: 'TASK-1',
    beforeContractSha256: state.tasks['TASK-1'].contractSha256,
    approvedPayloadSha256: digest(JSON.stringify({ objective: '승인된 새 목표' })),
  });
  updateTask(state, 'chat-a', 'TASK-1', {
    objective: '승인된 새 목표', supersedeDecisionId: 'DEC-SUPERSEDE',
  }, observed);
  assert.equal(state.tasks['TASK-1'].objective, '승인된 새 목표');
  expectCode(() => updateTask(state, 'chat-a', 'TASK-1', {
    objective: 'Decision 재사용 목표', supersedeDecisionId: 'DEC-SUPERSEDE',
  }, observeDispositionPrefix(state, 'TASK-1')), 'SUPERSEDE_DECISION_REQUIRED');
});

test('ADD와 SUPERSEDE는 승인 payload를 바꿀 수 없고 R0에 DB·운영 범위를 섞지 못한다', () => {
  const state = createSimulationState();
  register(state);
  const declared = {
    addInScope: ['docs/allowed.md'], addAcceptanceCriteria: ['문서 조건'], addArtifactPaths: ['docs/allowed.md'],
  };
  const disposition = appendDisposition(state, 'chat-a', 'TASK-1', {
    kind: 'ADD', evidenceConversationRef: 'conversation:add', observedAt: '2026-09-02T12:20:00+09:00',
    requiresHumanApproval: false, changePayload: declared,
  });
  expectCode(() => applyAddDisposition(state, 'chat-a', 'TASK-1', {
    dispositionSeq: disposition.seq, observedPrefix: observeDispositionPrefix(state, 'TASK-1'),
    addInScope: ['packages/db'], addAcceptanceCriteria: ['change DB policy'],
    addArtifactPaths: ['packages/db/supabase/migrations/unsafe.sql'],
  }), 'DISPOSITION_PAYLOAD_MISMATCH');

  const dbPayload = {
    addInScope: ['packages/db'], addAcceptanceCriteria: ['change DB policy'],
    addArtifactPaths: ['packages/db/supabase/migrations/unsafe.sql'],
  };
  const dbDisposition = appendDisposition(state, 'chat-a', 'TASK-1', {
    kind: 'ADD', evidenceConversationRef: 'conversation:add-db', observedAt: '2026-09-02T12:21:00+09:00',
    requiresHumanApproval: false, changePayload: dbPayload,
  });
  expectCode(() => applyAddDisposition(state, 'chat-a', 'TASK-1', {
    dispositionSeq: dbDisposition.seq, observedPrefix: observeDispositionPrefix(state, 'TASK-1'), ...dbPayload,
  }), 'RISK_RECLASSIFICATION_REQUIRED');

  recordDecision(state, {
    decisionId: 'DEC-SUPERSEDE-PAYLOAD', type: 'SUPERSEDE', approver: 'human-owner',
    approvedAt: '2026-09-02T12:22:00+09:00', targetSha: 'a'.repeat(40), subjectTaskId: 'TASK-1',
    beforeContractSha256: state.tasks['TASK-1'].contractSha256,
    approvedPayloadSha256: digest(JSON.stringify({ objective: '문서 목표' })),
  });
  expectCode(() => updateTask(state, 'chat-a', 'TASK-1', {
    objective: 'alter production data', supersedeDecisionId: 'DEC-SUPERSEDE-PAYLOAD',
  }, observeDispositionPrefix(state, 'TASK-1')), 'SUPERSEDE_PAYLOAD_MISMATCH');
});

test('Task 상태 전이와 depends_on은 임의 건너뛰기·없는 선행 Task를 거부한다', () => {
  const state = createSimulationState();
  register(state);
  expectCode(() => updateTask(state, 'chat-a', 'TASK-1', {
    currentState: 'DONE',
  }, observeDispositionPrefix(state, 'TASK-1')), 'TASK_STATE_TRANSITION');

  const missing = createSimulationState();
  acquireQueueLock(missing, 'chat-a');
  acquireTaskLock(missing, 'chat-a', 'TASK-2');
  expectCode(() => registerTask(missing, 'chat-a', requested(missing, {
    ...taskInput('TASK-2'), dependsOn: ['GHOST-TASK'],
  })), 'TASK_DEPENDENCY_MISSING');
});

test('만료 lease 인계 Decision은 Task·이전 소유자·새 소유자에 정확히 결속된다', () => {
  const state = createSimulationState();
  register(state);
  releaseTaskLock(state, 'chat-a', 'TASK-1');
  releaseQueueLock(state, 'chat-a');
  advanceClock(state, 10);
  recordDecision(state, {
    decisionId: 'DEC-WRONG-HANDOFF', type: 'HANDOFF', approver: 'human-owner',
    approvedAt: '2026-09-02T12:00:00+09:00', targetSha: 'a'.repeat(40),
    subjectTaskId: 'TASK-1', fromActor: 'chat-a', toActor: 'chat-c',
  });
  acquireQueueLock(state, 'chat-b');
  acquireTaskLock(state, 'chat-b', 'TASK-1');
  expectCode(() => renewOrTransferLease(state, 'chat-b', 'TASK-1', {
    handoffDecisionId: 'DEC-WRONG-HANDOFF',
  }), 'HANDOFF_REQUIRED');
  recordDecision(state, {
    decisionId: 'DEC-HANDOFF', type: 'HANDOFF', approver: 'human-owner',
    approvedAt: '2026-09-02T12:01:00+09:00', targetSha: 'a'.repeat(40),
    subjectTaskId: 'TASK-1', fromActor: 'chat-a', toActor: 'chat-b',
  });
  renewOrTransferLease(state, 'chat-b', 'TASK-1', { handoffDecisionId: 'DEC-HANDOFF' });
  assert.equal(state.tasks['TASK-1'].editOwner, 'chat-b');
});

test('SUPERSEDE disposition은 사람 승인 표식 없이 장부에 들어갈 수 없다', () => {
  const state = createSimulationState();
  register(state);
  assert.throws(() => appendDisposition(state, 'chat-a', 'TASK-1', {
    kind: 'SUPERSEDE_PROPOSAL', evidenceConversationRef: 'conversation:change',
    observedAt: '2026-09-02T12:00:00+09:00', requiresHumanApproval: false,
    changePayload: { objective: '변경 목표' },
  }), /사람 승인이 필요/);
});

test('Fable 증거는 공식 엔진·모델·Task SHA·독립 Task·세션·hash·누적 예산을 모두 지킨다', () => {
  const state = createSimulationState();
  register(state);
  expectCode(() => recordFable(state, fableRun('opus', 'a'.repeat(40), 'WORKFLOW_FIDELITY', {
    reviewerEngine: 'OPUS', reviewerRole: 'OPUS_DIRECT_ADVISORY',
  })), 'FABLE_PROVENANCE_REQUIRED');
  expectCode(() => recordFable(state, fableRun('stale', 'b'.repeat(40), 'WORKFLOW_FIDELITY')),
    'REVIEW_TASK_CONTRACT_INVALID');
  recordFable(state, fableRun('f-budget-1', 'a'.repeat(40), 'WORKFLOW_FIDELITY', {
    reviewerRole: 'FABLE-STRATEGY', reviewTaskId: 'FABLE-BUDGET-TASK', reportedUsageUsd: 3,
  }));
  expectCode(() => recordFable(state, fableRun('f-budget-2', 'a'.repeat(40), 'WORKFLOW_FIDELITY', {
    reviewerRole: 'FABLE-STRATEGY', reviewTaskId: 'FABLE-BUDGET-TASK', reportedUsageUsd: 2,
  })), 'FABLE_TASK_BUDGET_EXCEEDED');
  expectCode(() => recordFable(state, fableRun('f-reuse', 'a'.repeat(40), 'NETWORK_CLOSURE', {
    evidenceRef: 'run:f-budget-1',
  })), 'REVIEW_EVIDENCE_REUSED');
});

test('Codex 검수도 pass·세션·증거 hash를 재포장할 수 없다', () => {
  const state = createSimulationState();
  register(state);
  recordCodexEvidence(state, codexEvidence('c1', 'a'.repeat(40), 'CONTRACT_AUDIT'));
  expectCode(() => recordCodexEvidence(state, {
    ...codexEvidence('c2', 'a'.repeat(40), 'ADVERSARIAL_AUDIT'), evidenceRef: 'evidence:c1',
  }), 'REVIEW_EVIDENCE_REUSED');
  expectCode(() => recordCodexEvidence(state, codexEvidence('stale', 'b'.repeat(40), 'ADVERSARIAL_AUDIT')),
    'REVIEW_TASK_SHA_MISMATCH');
});

test('검수 배열을 변조하거나 삭제해도 append-only 감사 장부가 승인 전에 잡는다', () => {
  const changed = createSimulationState();
  register(changed);
  recordFable(changed, fableRun('f1', 'a'.repeat(40), 'WORKFLOW_FIDELITY', { reviewerRole: 'FABLE-STRATEGY' }));
  changed.planReviewRuns[0].reportedUsageUsd = 0;
  assert.throws(() => validateTrace(changed), /원본이 감사 사건과 어긋/);

  const deleted = createSimulationState();
  register(deleted);
  recordCodexEvidence(deleted, codexEvidence('c1', 'a'.repeat(40), 'CONTRACT_AUDIT'));
  deleted.codexEvidence.pop();
  assert.throws(() => validateTrace(deleted), /감사 사건 수가 어긋/);
});

test('다른 Task의 열린 Finding은 현재 Task 승인을 막지 않되 원본 회차 결속은 유지한다', () => {
  const state = createSimulationState();
  register(state, 'chat-a', 'TASK-1');
  releaseTaskLock(state, 'chat-a', 'TASK-1');
  releaseQueueLock(state, 'chat-a');
  register(state, 'chat-b', 'TASK-2');
  releaseTaskLock(state, 'chat-b', 'TASK-2');
  releaseQueueLock(state, 'chat-b');
  registerFinding(state, {
    findingId: 'F-TASK-2', fingerprint: 'task-2-only', discoveredByRole: 'FABLE-ARCH',
    exactSha: 'a'.repeat(40), subjectTaskId: 'TASK-2', sourceRoundId: 'f-task-2',
  });
  recordFable(state, fableRun('f-task-2', 'a'.repeat(40), 'NETWORK_CLOSURE', {
    subjectTaskId: 'TASK-2', verdict: 'CHANGES_REQUIRED', requiredFindings: ['F-TASK-2'],
  }));
  recordCodexEvidence(state, codexEvidence('c1', 'a'.repeat(40), 'CONTRACT_AUDIT'));
  recordCodexEvidence(state, codexEvidence('c2', 'a'.repeat(40), 'ADVERSARIAL_AUDIT'));
  recordFable(state, finalFableRun('f1', 'a'.repeat(40), 'WORKFLOW_FIDELITY', 'task-one-workflow'));
  recordFable(state, finalFableRun('f2', 'a'.repeat(40), 'NETWORK_CLOSURE', 'task-one-network'));
  markTaskDone(state, 'chat-a', 'TASK-1');
  approvePlanActivation(state, {
    decisionId: 'DEC-TASK-1', approver: 'human-owner', approvedAt: '2026-09-02T13:00:00+09:00',
    reviewTargetSha: 'a'.repeat(40), subjectTaskId: 'TASK-1',
  });
  assert.equal(state.decisions['DEC-TASK-1'].subjectTaskId, 'TASK-1');
});

test('독립 종합 감사와 최초 보안 Task에는 caller가 route를 속여도 Learning을 주입하지 못한다', () => {
  const state = createSimulationState();
  register(state, 'chat-a', 'TASK-1');
  releaseTaskLock(state, 'chat-a', 'TASK-1');
  releaseQueueLock(state, 'chat-a');
  acquireQueueLock(state, 'chat-b');
  acquireTaskLock(state, 'chat-b', 'FINAL-TASK');
  registerTask(state, 'chat-b', requested(state, {
    ...taskInput('FINAL-TASK'), route: 'FINAL_INDEPENDENT', reviewerRole: 'FABLE-FINAL',
  }));
  const finalLearningEvidence = recordLearningArtifacts(state, 'a'.repeat(40), 'final');
  proposeLearning(state, 'LRN-FINAL', {
    evidenceRefs: finalLearningEvidence, appliesTo: ['FINAL_INDEPENDENT', 'R0-DOCS'], excludes: [],
    conflictsWith: [], supersedes: [], reviewBy: '2027-02-28', invalidationCondition: 'audit route change',
    authorRole: 'SOLAR', laneOwnerRole: 'AI-DEPUTY-ORCHESTRATOR',
    sourceTaskId: 'TASK-1', sourceSha: 'a'.repeat(40),
  });
  recordDecision(state, {
    decisionId: 'DEC-LRN-FINAL', type: 'LEARNING_VERIFIER', approver: 'human-owner',
    approvedAt: '2026-09-02T13:00:00+09:00', targetSha: 'a'.repeat(40), verifierRole: 'CODEX',
  });
  verifyLearning(state, 'LRN-FINAL', { verifier: 'CODEX', decisionId: 'DEC-LRN-FINAL', independent: true });
  expectCode(() => applyLearning(state, 'LRN-FINAL', {
    taskId: 'FINAL-TASK', route: 'R0-DOCS',
  }), 'LEARNING_ROUTE_MISMATCH');
  expectCode(() => applyLearning(state, 'LRN-FINAL', {
    taskId: 'FINAL-TASK', route: 'FINAL_INDEPENDENT',
  }), 'LEARNING_ROUTE_EXCLUDED');
});

test('자율성은 A0 읽기부터 한 단계씩만 승격되고 운영 실행은 항상 사람 전용이다', () => {
  const state = createSimulationState();
  register(state);
  assert.equal(authorizeAction(state, 'R0-DOCS', 'READ_ONLY'), true);
  expectCode(() => authorizeAction(state, 'R0-DOCS', 'DOC_ASSIST'), 'AUTONOMY_INSUFFICIENT');
  expectCode(() => authorizeAction(state, 'R0-DOCS', 'PRODUCTION_EXECUTION'), 'HUMAN_ONLY_ACTION');
  recordDecision(state, {
    decisionId: 'DEC-AUTONOMY-1', type: 'AUTONOMY_PROMOTION', approver: 'human-owner',
    approvedAt: '2026-09-02T13:00:00+09:00', targetSha: 'a'.repeat(40),
    subjectTaskId: 'TASK-1', route: 'R0-DOCS',
  });
  promoteAutonomy(state, 'R0-DOCS', {
    to: 'A1', decisionId: 'DEC-AUTONOMY-1', evidencePassed: true, escapeCount: 0, evaluationWindows: 1,
    sampleCount: 30,
  });
  assert.equal(authorizeAction(state, 'R0-DOCS', 'DOC_ASSIST'), true);
  expectCode(() => promoteAutonomy(state, 'R0-DOCS', {
    to: 'A2', decisionId: 'DEC-AUTONOMY-1', evidencePassed: true, escapeCount: 0, evaluationWindows: 2,
  }), 'AUTONOMY_PROMOTION_BLOCKED');
});

test('실제 작업큐 Task heading과 YAML ID가 갈리면 재개를 거부한다', () => {
  const tampered = loadWorkQueue().replace('task_id: AI-ORCH-PLANS-SIM-1', 'task_id: OTHER-TASK');
  assert.throws(() => validateLiveTaskLedger(tampered), /Task heading과 YAML task_id/);
  const staleSha = loadWorkQueue().replace(
    'last_verified_sha: 8ab364e3330bbd7205572279fb5a4d6b969e2a51',
    `last_verified_sha: ${'f'.repeat(40)}`,
  );
  assert.throws(() => validateLiveTaskLedger(staleSha), /유효한 조상이 아닙니다/);
  const wrongBranch = loadWorkQueue().replaceAll(
    'active_branch: codex/ai-team-knowledge-orchestration-plans', 'active_branch: codex/fake-branch',
  );
  assert.throws(() => validateLiveTaskLedger(wrongBranch), /실제 브랜치와 어긋/);
  const expired = mutateLiveSimulationTask(loadWorkQueue(), (block) => block.replace(
    /lease_expires_at: .+/, 'lease_expires_at: 2020-01-01T00:00:00+09:00',
  ));
  assert.throws(() => validateLiveTaskLedger(expired), /lease가 만료/);
});

test('문서 관계 방향과 Finding 권위 경로를 되돌리면 문서 그래프 검사가 잡는다', () => {
  const wrongDirection = loadPlanDocuments();
  wrongDirection.directory = wrongDirection.directory.replace(
    'NORMALIZED_REQUEST ─ROUTES_TO→ TASK', 'TASK ─ROUTES_TO→ NORMALIZED_REQUEST',
  );
  assert.throws(() => validateDocumentNetwork(wrongDirection), /directory 필수 계약 누락/);

  const inventedRegistry = loadPlanDocuments();
  inventedRegistry.ontology = inventedRegistry.ontology.replace(
    'rounds/rNNN/review.json', 'rounds/rNNN/finding_registry.json',
  );
  assert.throws(() => validateDocumentNetwork(inventedRegistry), /ontology 필수 계약 누락/);
});

test('코드 블록이나 HTML 주석에 숨긴 가짜 링크는 문서 네트워크 참조로 인정하지 않는다', () => {
  const docs = loadPlanDocuments();
  docs.team = docs.team.replace(
    '[`AI-품질-학습-자율성-평가기획안.md`](./AI-품질-학습-자율성-평가기획안.md)',
    '`AI-품질-학습-자율성-평가기획안.md`',
  );
  docs.team += '\n```md\n[가짜](./AI-품질-학습-자율성-평가기획안.md)\n```\n';
  assert.throws(() => validateDocumentNetwork(docs), /team → quality Markdown 참조/);
});

test('artifact lease와 Task 경로는 Windows 대소문자·역슬래시·상위 경로 우회를 막는다', () => {
  const state = createSimulationState();
  register(state);
  releaseTaskLock(state, 'chat-a', 'TASK-1');
  releaseQueueLock(state, 'chat-a');
  acquireQueueLock(state, 'chat-b');
  acquireTaskLock(state, 'chat-b', 'TASK-2');
  expectCode(() => registerTask(state, 'chat-b', requested(state, {
    ...taskInput('TASK-2'), artifactPaths: ['Docs\\TASK-1.MD'], inScope: ['Docs\\TASK-1.MD'],
  })), 'ARTIFACT_LEASE_CONFLICT');

  const unsafe = createSimulationState();
  acquireQueueLock(unsafe, 'chat-a');
  acquireTaskLock(unsafe, 'chat-a', 'TASK-X');
  assert.throws(() => registerTask(unsafe, 'chat-a', requested(unsafe, {
    ...taskInput('TASK-X'), artifactPaths: ['../outside.md'], inScope: ['../outside.md'],
  })), /저장소 상대 안전 경로/);
  assert.equal(unsafe.tasks['TASK-X'], undefined);
});

test('A0 Task는 구현할 수 없고 DONE은 같은 SHA의 Codex·Fable 2+2 검수가 필요하다', () => {
  const state = createSimulationState();
  register(state);
  expectCode(() => updateTask(state, 'chat-a', 'TASK-1', {
    currentState: 'IMPLEMENTED',
  }, observeDispositionPrefix(state, 'TASK-1')), 'AUTONOMY_INSUFFICIENT');
  recordDecision(state, {
    decisionId: 'DEC-A1-TASK-1', type: 'AUTONOMY_PROMOTION', approver: 'human-owner',
    approvedAt: '2026-09-02T14:00:00+09:00', targetSha: 'a'.repeat(40),
    subjectTaskId: 'TASK-1', route: 'R0-DOCS',
  });
  promoteAutonomy(state, 'R0-DOCS', {
    to: 'A1', decisionId: 'DEC-A1-TASK-1', evidencePassed: true, escapeCount: 0, evaluationWindows: 1,
    sampleCount: 30,
  });
  updateTask(state, 'chat-a', 'TASK-1', { currentState: 'IMPLEMENTED' }, observeDispositionPrefix(state, 'TASK-1'));
  updateTask(state, 'chat-a', 'TASK-1', { currentState: 'REVIEWING' }, observeDispositionPrefix(state, 'TASK-1'));
  expectCode(() => updateTask(state, 'chat-a', 'TASK-1', {
    currentState: 'DONE',
  }, observeDispositionPrefix(state, 'TASK-1')), 'TASK_REVIEW_QUORUM_REQUIRED');
  recordCodexEvidence(state, codexEvidence('done-c1', 'a'.repeat(40), 'CONTRACT_AUDIT'));
  recordCodexEvidence(state, codexEvidence('done-c2', 'a'.repeat(40), 'ADVERSARIAL_AUDIT'));
  recordFable(state, finalFableRun('done-f1', 'a'.repeat(40), 'WORKFLOW_FIDELITY', 'done-workflow'));
  recordFable(state, finalFableRun('done-f2', 'a'.repeat(40), 'NETWORK_CLOSURE', 'done-network'));
  updateTask(state, 'chat-a', 'TASK-1', { currentState: 'DONE' }, observeDispositionPrefix(state, 'TASK-1'));
  assert.equal(state.tasks['TASK-1'].currentState, 'DONE');
});

test('lease TTL은 양의 정수이고 자율성 Decision은 임의의 첫 Task가 아니라 지정 Task에 결속된다', () => {
  const state = createSimulationState();
  register(state);
  expectCode(() => renewOrTransferLease(state, 'chat-a', 'TASK-1', { ttl: -1 }), 'LEASE_TTL_INVALID');
  releaseTaskLock(state, 'chat-a', 'TASK-1');
  releaseQueueLock(state, 'chat-a');
  acquireQueueLock(state, 'chat-b');
  acquireTaskLock(state, 'chat-b', 'TASK-2');
  registerTask(state, 'chat-b', requested(state, { ...taskInput('TASK-2'), lastVerifiedSha: 'b'.repeat(40) }));
  recordDecision(state, {
    decisionId: 'DEC-A1-TASK-2', type: 'AUTONOMY_PROMOTION', approver: 'human-owner',
    approvedAt: '2026-09-02T14:05:00+09:00', targetSha: 'b'.repeat(40),
    subjectTaskId: 'TASK-2', route: 'R0-DOCS',
  });
  promoteAutonomy(state, 'R0-DOCS', {
    to: 'A1', decisionId: 'DEC-A1-TASK-2', evidencePassed: true, escapeCount: 0, evaluationWindows: 1,
    sampleCount: 30,
  });
  assert.equal(state.autonomy['R0-DOCS'], 'A1');
});

test('디렉터리 물질화는 실제 활성화 Decision·등록 증거·안전한 비순환 경로에만 결속된다', () => {
  const state = runHappyPathSimulation();
  recordDecision(state, {
    decisionId: 'DEC-ALT-ACTIVATION', type: 'PLAN_ACTIVATION', approver: 'human-owner',
    approvedAt: '2026-09-02T14:10:00+09:00', targetSha: 'c'.repeat(40), subjectTaskId: 'AI-PLANS-PILOT-001',
  });
  expectCode(() => materializeDirectory(state, {
    decisionId: 'DEC-ALT-ACTIVATION', exactSha: state.activationCommitSha,
    preflightId: 'PREFLIGHT-AI-PLANS-001',
  }), 'ACTIVATION_DECISION_MISMATCH');

  const exactSha = state.activationCommitSha;
  const traversal = recordPreflightArtifact(state, exactSha, 'traversal', 'evidence:traversal');
  expectCode(() => recordDirectoryPreflight(state, {
    preflightId: 'PREFLIGHT-TRAVERSAL', exactSha, checkerEvidenceRef: traversal.evidenceRef,
    pathMap: [{ from: '../outside.md', to: 'docs/new.md' }], userOwnedOverlap: [], oldReferenceCount: 0,
    checkerEvidenceSha256: traversal.evidenceSha256,
  }), 'MIGRATION_PATH_UNSAFE');
  const cycle = recordPreflightArtifact(state, exactSha, 'cycle', 'evidence:cycle');
  expectCode(() => recordDirectoryPreflight(state, {
    preflightId: 'PREFLIGHT-CYCLE', exactSha, checkerEvidenceRef: cycle.evidenceRef,
    pathMap: [{ from: 'docs/a.md', to: 'docs/b.md' }, { from: 'docs/b.md', to: 'docs/a.md' }],
    userOwnedOverlap: [], oldReferenceCount: 0, checkerEvidenceSha256: cycle.evidenceSha256,
  }), 'MIGRATION_PATH_CYCLE');
  expectCode(() => recordProtectedGate(state, gateEvidence('f'.repeat(40), 'unregistered')), 'GATE_EVIDENCE_REQUIRED');
});

test('Learning은 같은 Task·SHA의 등록 증거가 두 번 이상 재현돼야 CANDIDATE가 된다', () => {
  const state = createSimulationState();
  register(state);
  expectCode(() => proposeLearning(state, 'LRN-NONE', {
    evidenceRefs: [], appliesTo: ['R0-DOCS'], excludes: [], conflictsWith: [], supersedes: [],
    reviewBy: '2027-02-28', invalidationCondition: 'fixture contract change', authorRole: 'SOLAR',
    laneOwnerRole: 'AI-DEPUTY-ORCHESTRATOR', sourceTaskId: 'TASK-1', sourceSha: 'a'.repeat(40),
  }), 'LEARNING_EVIDENCE_REQUIRED');
  const once = recordLearningArtifacts(state, 'a'.repeat(40), 'once', 1);
  expectCode(() => proposeLearning(state, 'LRN-ONCE', {
    evidenceRefs: once, appliesTo: ['R0-DOCS'], excludes: [], conflictsWith: [], supersedes: [],
    reviewBy: '2027-02-28', invalidationCondition: 'fixture contract change', authorRole: 'SOLAR',
    laneOwnerRole: 'AI-DEPUTY-ORCHESTRATOR', sourceTaskId: 'TASK-1', sourceSha: 'a'.repeat(40),
  }), 'LEARNING_EVIDENCE_REQUIRED');
});

test('문서 metadata는 수명주기·검증자·재검토 계약을 실제 front matter에서 강제한다', () => {
  const missing = loadPlanDocuments();
  missing.ontology = missing.ontology.replace('supersedes: []\n', '');
  assert.throws(() => validateDocumentNetwork(missing), /metadata 필드 집합/);

  const ghost = loadPlanDocuments();
  ghost.ontology = ghost.ontology.replace('verified_by: []', 'verified_by: [GHOST-REVIEWER]');
  assert.throws(() => validateDocumentNetwork(ghost), /verified_by 역할/);

  const mismatch = loadPlanDocuments();
  mismatch.ontology = mismatch.ontology.replace('depends_on: [team]', 'depends_on: []');
  assert.throws(() => validateDocumentNetwork(mismatch), /metadata 의존성/);

  const duplicate = loadPlanDocuments();
  duplicate.ontology += '\n---\ndoc_id: ontology\n---\n';
  assert.throws(() => validateDocumentNetwork(duplicate), /metadata는 정확히 하나/);
});

test('네 후속 기획안은 metadata·본문을 함께 바꾼 원자적 ACTIVE만 허용한다', () => {
  const active = loadPlanDocuments();
  for (const id of ['ontology', 'orchestration', 'directory', 'quality']) {
    active[id] = active[id]
      .replace('status: DRAFT', 'status: ACTIVE')
      .replace('verified_by: []', 'verified_by: [CODEX-QA]')
      .replace(/^> 상태:.*$/m, '> 상태: ACTIVE');
  }
  assert.equal(validateDocumentNetwork(active).planMetadata.quality.status, 'ACTIVE');

  const partial = loadPlanDocuments();
  partial.ontology = partial.ontology
    .replace('status: DRAFT', 'status: ACTIVE')
    .replace('verified_by: []', 'verified_by: [CODEX-QA]')
    .replace(/^> 상태:.*$/m, '> 상태: ACTIVE');
  assert.throws(() => validateDocumentNetwork(partial), /네 후보 기획안 상태/);
});

test('최초 활성화 뒤 권위별 수명주기는 독립적이고 supersedes는 같은 doc_id의 이전 판본만 가리킨다', () => {
  const active = loadPlanDocuments();
  for (const id of ['ontology', 'orchestration', 'directory', 'quality']) {
    active[id] = active[id]
      .replace('status: DRAFT', 'status: ACTIVE')
      .replace('verified_by: []', 'verified_by: [CODEX-QA]')
      .replace(/^> 상태:.*$/m, '> 상태: ACTIVE');
  }
  const independentlyRetired = structuredClone(active);
  independentlyRetired.ontology = independentlyRetired.ontology
    .replace('status: ACTIVE', 'status: RETIRED')
    .replace(/^> 상태:.*$/m, '> 상태: RETIRED');
  assert.equal(validateDocumentNetwork(independentlyRetired).planMetadata.ontology.status, 'RETIRED');

  const replacement = structuredClone(active);
  replacement.ontology = replacement.ontology
    .replace('version: 0.1', 'version: 0.2')
    .replace('supersedes: []', 'supersedes: [ontology@0.1]');
  assert.deepEqual(validateDocumentNetwork(replacement).planMetadata.ontology.supersedes, ['ontology@0.1']);

  const crossAuthority = structuredClone(active);
  crossAuthority.ontology = crossAuthority.ontology.replace('supersedes: []', 'supersedes: [orchestration@0.1]');
  assert.throws(() => validateDocumentNetwork(crossAuthority), /같은 권위/);
  const selfVersion = structuredClone(active);
  selfVersion.ontology = selfVersion.ontology.replace('supersedes: []', 'supersedes: [ontology@0.1]');
  assert.throws(() => validateDocumentNetwork(selfVersion), /현재 판본/);
});

test('필수 계약·소유 위임·중앙 권위를 코드 블록과 HTML 주석으로 위조할 수 없다', () => {
  const clause = loadPlanDocuments();
  clause.team = clause.team.replace('## 1. 운영 모델 요약', '## REMOVED')
    .concat('\n```md\n## 1. 운영 모델 요약\n```\n');
  assert.throws(() => validateDocumentNetwork(clause), /team 필수 계약 누락/);

  const bridge = loadPlanDocuments();
  bridge.team = bridge.team.replace(/평가 기획안\s*§8이 정의하는 route별 현재 자율성 단계/g, 'REMOVED-BRIDGE')
    .concat('\n<!-- 평가 기획안 §8이 정의하는 route별 현재 자율성 단계 -->\n');
  assert.throws(() => validateDocumentNetwork(bridge), /team의 단일 소유 위임/);

  const authority = loadPlanDocuments();
  authority.directory = authority.directory.replace(
    '| 역할별 실행 manifest | `docs/team/roles/*.md` |',
    '| REMOVED-ROLE-MANIFEST | REMOVED |',
  ).concat('\n```md\n| 역할별 실행 manifest | `docs/team/roles/*.md` |\n```\n');
  assert.throws(() => validateDocumentNetwork(authority), /directory 필수 계약 누락/);
});

test('Markdown 탐색 링크는 저장소 밖 경로와 존재하지 않는 anchor를 거부한다', () => {
  const traversal = loadPlanDocuments();
  traversal.team += '\n[탐색](../../../../../Windows)\n';
  assert.throws(() => validateDocumentNetwork(traversal), /저장소 밖/);

  const deadAnchor = loadPlanDocuments();
  deadAnchor.team += '\n[탐색](.\/팀구성_상세기획안.md#does-not-exist)\n';
  assert.throws(() => validateDocumentNetwork(deadAnchor), /존재하지 않는 Markdown anchor/);

  const windowsAbsolute = loadPlanDocuments();
  windowsAbsolute.team += '\n[탐색](C:/Windows/System32)\n';
  assert.throws(() => validateDocumentNetwork(windowsAbsolute), /절대 경로/);
});

test('실제 Task 장부는 등록 역할·edit owner·완료된 의존성을 같이 검증한다', () => {
  const ghost = loadWorkQueue().replace('role_id: SOLAR-AI-DEPUTY', 'role_id: GHOST-ROLE');
  assert.throws(() => validateLiveTaskLedger(ghost), /role_id가 등록되지/);
  const ownerMismatch = loadWorkQueue().replace('edit_owner: SOLAR-AI-DEPUTY', 'edit_owner: SOLAR-ORCH');
  assert.throws(() => validateLiveTaskLedger(ownerMismatch), /role_id와 edit_owner/);
  const blockedDependency = mutateLiveSimulationTask(loadWorkQueue(), (block) => (
    block.replace('depends_on: []', 'depends_on: [AI-ORCH-PLANS-1]')
  ));
  assert.throws(() => validateLiveTaskLedger(blockedDependency), /미완료 선행 Task/);
  const missingEvidence = mutateLiveSimulationTask(loadWorkQueue(), (block) => (
    block.replace(
      'evidence_paths:\n  - docs/ai-review/evidence/AI-PLANS-SIM-CODEX-R1.md',
      'evidence_paths:\n  - docs/ai-review/evidence/DOES-NOT-EXIST.md',
    )
  ));
  assert.throws(() => validateLiveTaskLedger(missingEvidence), /evidence path/);
  const unrelatedDuplicateEvidence = mutateLiveSimulationTask(loadWorkQueue(), (block) => (
    block.replace(
      /evidence_paths:\n(?:  - .+\n)+excluded_paths:/,
      'evidence_paths:\n  - AGENTS.md\n  - AGENTS.md\n  - AGENTS.md\nexcluded_paths:',
    )
  ));
  assert.throws(() => validateLiveTaskLedger(unrelatedDuplicateEvidence), /evidence_paths|evidence path/);
  const staleManifest = mutateLiveSimulationTask(loadWorkQueue(), (block) => (
    block.replace(/^candidate_manifest_sha256:.*$/m, `candidate_manifest_sha256: ${'0'.repeat(64)}`)
  ));
  assert.throws(() => validateLiveTaskLedger(staleManifest), /manifest/);
  const falseDone = mutateLiveSimulationTask(loadWorkQueue(), (block) => (
    block.replace(/^current_state:.*$/m, 'current_state: DONE')
  ));
  assert.throws(() => validateLiveTaskLedger(falseDone), /보호 gate/);
});

test('Learning·자율성 현재 상태는 append-only 감사 원본을 벗어나 변조될 수 없다', () => {
  const learningTamper = runHappyPathSimulation();
  learningTamper.learning['LRN-AI-PLANS-001'].appliesTo = ['R3-PROD'];
  assert.throws(() => validateTrace(learningTamper), /Learning appliesTo/);

  const autonomyTamper = runHappyPathSimulation();
  autonomyTamper.autonomy.UNAPPROVED = 'A4';
  assert.throws(() => validateTrace(autonomyTamper), /자율성 상태에 대응하는 감사 사건/);

  const boundaryTamper = runHappyPathSimulation();
  boundaryTamper.executionBoundary = 'PRODUCTION';
  assert.throws(() => validateTrace(boundaryTamper), /외부 운영 증거/);

  for (const mutate of [
    (task) => { task.route = 'SECURITY'; },
    (task) => { task.reviewerRole = 'UNREGISTERED-REVIEWER'; },
    (task) => { task.appliedLearningIds = []; },
  ]) {
    const taskTamper = runHappyPathSimulation();
    mutate(taskTamper.tasks['AI-PLANS-SEPARATE-002']);
    assert.throws(() => validateTrace(taskTamper), /Task contract|등록되지 않은/);
  }
});

test('Task·Decision·Finding registry의 후행 삭제는 append-only 감사 원본이 역방향으로 잡는다', () => {
  for (const mutate of [
    (state) => { delete state.tasks['AI-PLANS-PILOT-001']; },
    (state) => { delete state.tasks['AI-PLANS-SEPARATE-002']; },
    (state) => { delete state.decisions['DEC-AI-PLANS-ACTIVE']; },
    (state) => { delete state.decisions['DEC-AUTONOMY-A1']; },
    (state) => { delete state.decisions['DEC-LRN-001']; },
    (state) => { delete state.findings['FABLE-WORKFLOW-001']; },
  ]) {
    const state = runHappyPathSimulation();
    mutate(state);
    assert.throws(() => validateTrace(state));
  }
});

test('중대 경계 사고는 한 단계가 아니라 A0·중단·사람 호출로 강등한다', () => {
  const state = createSimulationState();
  state.autonomy['database-change'] = 'A3';
  demoteAutonomy(state, 'database-change', '매장 간 데이터 경계 위반', { criticalBoundaryBreach: true });
  assert.equal(state.autonomy['database-change'], 'A0');
  assert.equal(state.audit.at(-1).automationStopped, true);
  assert.equal(state.audit.at(-1).humanEscalated, true);
});

test('자율성 승격은 A1 최소 30개 표본을 boolean 하나로 우회할 수 없다', () => {
  const state = createSimulationState();
  register(state);
  recordDecision(state, {
    decisionId: 'DEC-A1-SAMPLES', type: 'AUTONOMY_PROMOTION', approver: 'human-owner',
    approvedAt: '2026-09-02T15:00:00+09:00', targetSha: 'a'.repeat(40),
    subjectTaskId: 'TASK-1', route: 'R0-DOCS',
  });
  expectCode(() => promoteAutonomy(state, 'R0-DOCS', {
    to: 'A1', decisionId: 'DEC-A1-SAMPLES', evidencePassed: true, escapeCount: 0,
    evaluationWindows: 2, sampleCount: 29,
  }), 'AUTONOMY_PROMOTION_BLOCKED');
});
