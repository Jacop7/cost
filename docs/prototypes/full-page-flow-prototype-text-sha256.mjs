import { createHash } from 'node:crypto';

/** DS 텍스트 증거의 단일 해시 계약: UTF-8로 읽고 CRLF를 LF로 바꾼 뒤 SHA-256. */
export const normalizedTextBytes = (input) => Buffer.from(
  Buffer.isBuffer(input) ? input.toString('utf8').replace(/\r\n/g, '\n') : String(input).replace(/\r\n/g, '\n'),
  'utf8',
);

export const textSha256 = (input) => createHash('sha256').update(normalizedTextBytes(input)).digest('hex');
