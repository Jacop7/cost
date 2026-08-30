import { describe, expect, it, vi } from 'vitest';
import { reportRpcFailure } from '@/lib/rpcMonitoring';

describe('reportRpcFailure', () => {
  it('코드·안정 detail·플랫폼만 보내고 오류 문구는 보내지 않는다', async () => {
    const reporter = vi.fn(async () => ({ data: { reported: true }, error: null }));

    reportRpcFailure(reporter, {
      code: 'XX001',
      details: 'INTERNAL_FAILURE',
      message: '사용자 입력이나 DB 문구가 섞일 수 있는 값',
    } as { code: string; details: string; message: string }, 'android');

    await vi.waitFor(() => expect(reporter).toHaveBeenCalledTimes(1));
    expect(reporter).toHaveBeenCalledWith({
      p_code: 'XX001',
      p_detail: 'INTERNAL_FAILURE',
      p_client_platform: 'android',
    });
    expect(JSON.stringify(reporter.mock.calls)).not.toContain('사용자 입력');
  });

  it('코드·detail이 없는 네트워크 오류는 안정된 대체값으로 보낸다', async () => {
    const reporter = vi.fn(async () => ({ data: null, error: null }));
    reportRpcFailure(reporter, {}, 'web');
    await vi.waitFor(() => expect(reporter).toHaveBeenCalledWith({
      p_code: 'NOCODE',
      p_detail: 'NONE',
      p_client_platform: 'web',
    }));
  });

  it('구조화되지 않은 코드·detail은 원문을 보내지 않는다', async () => {
    const reporter = vi.fn(async () => ({ data: null, error: null }));
    reportRpcFailure(reporter, { code: 'bad code!', details: 'Key (name)=(홍길동)' }, 'web');
    await vi.waitFor(() => expect(reporter).toHaveBeenCalledWith({
      p_code: 'BADCODE',
      p_detail: 'UNSTRUCTURED',
      p_client_platform: 'web',
    }));
    expect(JSON.stringify(reporter.mock.calls)).not.toContain('홍길동');
  });

  it('운영 보고 실패가 처리되지 않은 Promise 오류가 되지 않는다', async () => {
    const reporter = vi.fn(async () => { throw new Error('monitor unavailable'); });
    reportRpcFailure(reporter, { code: '08006', details: null }, 'ios');
    await vi.waitFor(() => expect(reporter).toHaveBeenCalledTimes(1));
  });

  it('보고기가 동기적으로 실패해도 원래 오류 처리를 가로막지 않는다', () => {
    const reporter = vi.fn(() => { throw new Error('sync monitor failure'); });
    expect(() => reportRpcFailure(reporter, { code: '08006' }, 'web')).not.toThrow();
    expect(reporter).toHaveBeenCalledTimes(1);
  });
});
