import { createHash } from 'node:crypto';

/** DS 텍스트 증거의 단일 해시 계약: UTF-8 BOM을 제거하고 CRLF를 LF로 바꾼 뒤 SHA-256. */
export const normalizedTextBytes = (input) => {
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : String(input);
  return Buffer.from(text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'), 'utf8');
};

export const textSha256 = (input) => createHash('sha256').update(normalizedTextBytes(input)).digest('hex');
