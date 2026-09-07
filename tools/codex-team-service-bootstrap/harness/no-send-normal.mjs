import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export default function run() {
  const payload = readFileSync('fixture:payload', 'utf8');
  return {
    digest: createHash('sha256').update(payload).digest('hex'),
    joined: join('fixture', 'payload'),
  };
}
