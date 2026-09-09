/** 스킴 생략 입력은 HTTPS로 보완하고 외부 실행 가능한 웹 주소만 허용한다. */
export function normalizePurchaseUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw || /[\s\\]/.test(raw)) return null;
  const explicitHttp = /^https?:\/\//i.test(raw);
  // 다른 URI 스킴은 거절하되 도메인:포트는 허용한다.
  if (!explicitHttp && /^[a-z][a-z\d+.-]*:/i.test(raw) && !/^[^/:]+\.[^/:]+:\d+(?:[/?#]|$)/.test(raw)) return null;
  const normalized = explicitHttp ? raw : `https://${raw}`;
  try {
    const u = new URL(normalized);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname || u.username || u.password) return null;
    if (!explicitHttp && (!u.hostname.includes('.') || raw.startsWith('/'))) return null;
    return normalized;
  } catch { return null; }
}
