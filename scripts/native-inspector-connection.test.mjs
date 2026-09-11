import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectInspector } from './native-touch-runtime-audit.mjs';

function fake(pages) {
  const instances = [];
  class Socket {
    constructor(url) { this.page = pages.find(p => p.id === url); this.listeners = new Set(); instances.push(this);
      queueMicrotask(() => { if (this.page.connectError) this.onerror?.(); else if (!this.page.neverOpen) this.onopen?.(); }); }
    addEventListener(_type, listener) { this.listeners.add(listener); }
    removeEventListener(_type, listener) { this.listeners.delete(listener); }
    close() { this.closed = true; }
    send(text) { if (this.page.stale) return; const request = JSON.parse(text);
      const value = request.params.expression.includes('getFiberRoots') ? (this.page.roots ?? 1) : this.page.platform;
      queueMicrotask(() => { for (const listener of this.listeners) listener({ data: JSON.stringify({ id: request.id, result: { result: { value } } }) }); }); }
  }
  return { instances, deps: { timeoutMs: 10, WebSocketImpl: Socket,
    fetchImpl: async () => ({ ok: true, json: async () => pages.map(p => ({ id: p.id, webSocketDebuggerUrl: p.id })) }) } };
}

test('배경 iPhone/낡은 page가 응답하지 않아도 실제 Android 런타임을 찾는다', async () => {
  const f = fake([{ id: 'android', platform: 'android' }, { id: 'stale', stale: true }]);
  const result = await connectInspector('http://localhost', 'android', f.deps);
  assert.equal(result.page.id, 'android');
  assert.equal(f.instances[0].closed, true);
  assert.equal(f.instances[0].listeners.size, 0);
  assert.equal(f.instances[1].closed, undefined);
  result.socket.close();
});
test('연결 오류/연결 timeout을 닫고 다음 page를 검사한다', async () => {
  const f = fake([{ id: 'good', platform: 'android' }, { id: 'pending', neverOpen: true }, { id: 'bad', connectError: true }]);
  const result = await connectInspector('http://localhost', 'android', f.deps);
  assert.equal(result.page.id, 'good');
  assert.ok(f.instances.slice(0, 2).every(s => s.closed));
  result.socket.close();
});
test('page 이름 대신 실제 플랫폼과 React root를 검증한다', async () => {
  const f = fake([{ id: 'valid', platform: 'android' }, { id: 'no-root', platform: 'android', roots: 0 }, { id: 'android-in-name', platform: 'ios' }]);
  const result = await connectInspector('http://localhost', 'android', f.deps);
  assert.equal(result.page.id, 'valid');
  assert.ok(f.instances.slice(0, 2).every(s => s.closed));
  result.socket.close();
});
test('사용 가능한 요청 플랫폼이 없으면 실패하고 모든 socket을 닫는다', async () => {
  const f = fake([{ id: 'ios', platform: 'ios' }, { id: 'stale', stale: true }]);
  await assert.rejects(connectInspector('http://localhost', 'android', f.deps), /android Hermes inspector/);
  assert.ok(f.instances.every(s => s.closed));
});
test('목록 조회 실패는 통과로 바꾸지 않는다', async () => {
  await assert.rejects(connectInspector('http://localhost', 'android', { fetchImpl: async () => ({ ok: false, status: 503 }) }), /HTTP 503/);
});
