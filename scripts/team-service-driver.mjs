const requireValue = (condition, code) => {
  if (!condition) throw new Error(code);
};

const clone = (value) => structuredClone(value);

export function createForegroundDriver({ store, transport, maxTransientRetries = 1 } = {}) {
  requireValue(store && typeof store.snapshot === 'function', 'LOCAL_STORE_REQUIRED');
  requireValue(transport?.kind === 'IN_PROCESS_FAKE_ONLY', 'REAL_TRANSPORT_FORBIDDEN');
  requireValue(typeof transport.send === 'function', 'FAKE_TRANSPORT_SEND_REQUIRED');
  requireValue(Number.isSafeInteger(maxTransientRetries) && maxTransientRetries >= 0 && maxTransientRetries <= 3, 'INVALID_RETRY_LIMIT');
  let fakeAttempts = 0;

  const currentFence = (request) => ({
    expectedRevision: store.snapshot().revision,
    expectedDagRevision: request.expectedDagRevision,
    rootTaskId: request.rootTaskId,
    runGeneration: request.runGeneration,
    stopEpoch: request.stopEpoch,
  });

  const assertFence = (request) => store.assertDispatchFence(currentFence(request));

  function record(intentKey, nextState, attemptIncrement = 0) {
    const revision = store.snapshot().revision;
    store.recordDelivery({
      eventId: `EVENT-${nextState}-${revision + 1}`,
      expectedRevision: revision,
      intentKey,
      nextState,
      attemptIncrement,
    });
  }

  async function sendPrepared(request) {
    requireValue(request && typeof request === 'object', 'INVALID_DRIVER_REQUEST');
    const intent = store.getIntent(request.intentKey);
    requireValue(intent, 'INTENT_NOT_FOUND');
    requireValue(['PREPARED', 'RETRY_READY'].includes(intent.state), 'INTENT_NOT_SENDABLE');
    assertFence(request);

    let transientRetries = 0;
    while (true) {
      assertFence(request);
      record(request.intentKey, 'SEND_ATTEMPTED', 1);
      if (typeof transport.beforeSend === 'function') await transport.beforeSend(clone(request), store);
      // The second check closes the STOP/generation window immediately before
      // the only permitted (in-process fake) effect boundary.
      assertFence(request);
      fakeAttempts += 1;
      try {
        const result = await transport.send({
          intent_key: request.intentKey,
          route_id: intent.route_id,
          delivery_token: intent.delivery_token,
          payload: clone(intent.payload),
        });
        requireValue(result && typeof result === 'object', 'INVALID_FAKE_TRANSPORT_RESULT');
        if (result.status === 'REJECTED') {
          record(request.intentKey, 'REJECTED');
          return { status: 'REJECTED', terminal: true };
        }
        if (result.status === 'UNKNOWN_DELIVERY') {
          record(request.intentKey, 'UNKNOWN_DELIVERY');
          return { status: 'UNKNOWN_DELIVERY', retry_allowed: false };
        }
        requireValue(['SENT', 'ACKNOWLEDGED'].includes(result.status), 'INVALID_FAKE_TRANSPORT_STATUS');
        record(request.intentKey, result.status);
        return { status: result.status, completed: false };
      } catch (error) {
        if (error?.delivery_unknown === true) {
          record(request.intentKey, 'UNKNOWN_DELIVERY');
          return { status: 'UNKNOWN_DELIVERY', retry_allowed: false };
        }
        if (error?.transient === true && error?.delivery_committed !== true && transientRetries < maxTransientRetries) {
          transientRetries += 1;
          record(request.intentKey, 'RETRY_READY');
          continue;
        }
        if (error?.transient === true && error?.delivery_committed !== true) {
          record(request.intentKey, 'REJECTED');
          return { status: 'REJECTED', terminal: true, retry_limit_reached: true };
        }
        throw error;
      }
    }
  }

  async function reconcileUnknown(request) {
    requireValue(typeof transport.reconcile === 'function', 'RECONCILIATION_REQUIRED');
    const intent = store.getIntent(request.intentKey);
    requireValue(['UNKNOWN_DELIVERY', 'SEND_ATTEMPTED'].includes(intent?.state), 'UNKNOWN_DELIVERY_REQUIRED');
    assertFence(request);
    const result = await transport.reconcile({
      intent_key: request.intentKey,
      route_id: intent.route_id,
      delivery_token: intent.delivery_token,
    });
    requireValue(['DELIVERED', 'NOT_DELIVERED', 'STILL_UNKNOWN'].includes(result?.status), 'INVALID_RECONCILIATION_RESULT');
    if (result.status === 'DELIVERED') {
      record(request.intentKey, 'SENT');
      return { status: 'SENT', retry_allowed: false };
    }
    if (result.status === 'STILL_UNKNOWN') return { status: 'UNKNOWN_DELIVERY', retry_allowed: false };
    record(request.intentKey, 'RETRY_READY');
    return { status: 'RETRY_READY', retry_allowed: true };
  }

  return Object.freeze({
    mode: 'FOREGROUND_ONLY',
    sendPrepared,
    reconcileUnknown,
    metrics: () => ({
      fake_transport_attempts: fakeAttempts,
      actual_provider_calls: 0,
      real_transport_available: false,
      background_service_claimed: false,
    }),
  });
}
