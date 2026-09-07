import { createHash } from 'node:crypto';

const requireValue = (condition, code) => {
  if (!condition) throw new Error(code);
};

export function canonicalJson(value, stack = new Set()) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value.normalize('NFC'));
  if (typeof value === 'number') {
    requireValue(Number.isFinite(value), 'UNSUPPORTED_CANONICAL_VALUE');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  requireValue(typeof value === 'object', 'UNSUPPORTED_CANONICAL_VALUE');
  requireValue(!stack.has(value), 'CYCLIC_CANONICAL_VALUE');
  requireValue(Object.getOwnPropertySymbols(value).length === 0, 'UNSUPPORTED_CANONICAL_VALUE');
  stack.add(value);
  try {
    if (Array.isArray(value)) {
      const names = Object.getOwnPropertyNames(value);
      requireValue(names.length === value.length + 1 && names.includes('length'), 'UNSUPPORTED_CANONICAL_VALUE');
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        requireValue(Object.hasOwn(value, index), 'UNSUPPORTED_CANONICAL_VALUE');
        items.push(canonicalJson(value[index], stack));
      }
      return `[${items.join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    requireValue(prototype === Object.prototype || prototype === null, 'UNSUPPORTED_CANONICAL_VALUE');
    const entries = [];
    const normalizedKeys = new Set();
    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      requireValue(descriptor?.enumerable === true && Object.hasOwn(descriptor, 'value'), 'UNSUPPORTED_CANONICAL_VALUE');
      const normalizedKey = key.normalize('NFC');
      requireValue(!normalizedKeys.has(normalizedKey), 'CANONICAL_KEY_COLLISION');
      normalizedKeys.add(normalizedKey);
      entries.push([normalizedKey, canonicalJson(descriptor.value, stack)]);
    }
    entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, encoded]) => `${JSON.stringify(key)}:${encoded}`).join(',')}}`;
  } finally {
    stack.delete(value);
  }
}

export const canonicalHash = (value) => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
