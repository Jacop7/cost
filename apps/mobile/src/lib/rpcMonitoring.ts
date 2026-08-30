/**
 * RPC 오류 운영 보고의 앱 경계.
 *
 * 정확한 오류율을 계산하지 않는다. 서버가 정상 업무 거절을 다시 걸러 내고, 예상 밖 오류만
 * 5분 버킷으로 합친다. 오류 문구와 사용자 입력은 전송하지 않는다.
 */
export type RpcFailureShape = {
  code?: string | null;
  details?: string | null;
};

export type RpcFailureReport = {
  p_code: string;
  p_detail: string;
  p_client_platform: string;
};

export type RpcFailureReporter = (payload: RpcFailureReport) => PromiseLike<unknown>;

/** 보고 실패가 원래 화면 오류를 덮지 않도록 fire-and-forget으로 끝낸다. */
export function reportRpcFailure(
  reporter: RpcFailureReporter,
  error: RpcFailureShape,
  platform: string,
): void {
  const code = error.code && /^[A-Z0-9]{3,10}$/.test(error.code) ? error.code : error.code ? 'BADCODE' : 'NOCODE';
  const detail = error.details && /^[A-Z0-9_]{1,80}$/.test(error.details)
    ? error.details
    : error.details
      ? 'UNSTRUCTURED'
      : 'NONE';
  try {
    void Promise.resolve(reporter({
      p_code: code,
      p_detail: detail,
      p_client_platform: platform,
    })).catch(() => undefined);
  } catch {
    // 보고기가 동기적으로 실패해도 원래 RPC 오류 흐름은 그대로 돌려준다.
  }
}
