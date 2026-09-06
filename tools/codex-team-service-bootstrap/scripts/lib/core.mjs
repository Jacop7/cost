import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

export function canonicalJson(value, stack = new Set()) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value.normalize('NFC'));
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('UNSUPPORTED_CANONICAL_VALUE');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object' || stack.has(value)) fail('UNSUPPORTED_CANONICAL_VALUE');
  if (Object.getOwnPropertySymbols(value).length > 0) fail('UNSUPPORTED_CANONICAL_VALUE');
  stack.add(value);
  try {
    if (Array.isArray(value)) {
      const names = Object.getOwnPropertyNames(value);
      if (names.length !== value.length + 1 || !names.includes('length')) fail('UNSUPPORTED_CANONICAL_VALUE');
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) fail('UNSUPPORTED_CANONICAL_VALUE');
        items.push(canonicalJson(value[index], stack));
      }
      return `[${items.join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) fail('UNSUPPORTED_CANONICAL_VALUE');
    const normalizedKeys = new Set();
    const entries = [];
    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, 'value')) fail('UNSUPPORTED_CANONICAL_VALUE');
      const normalized = key.normalize('NFC');
      if (normalizedKeys.has(normalized)) fail('CANONICAL_KEY_COLLISION');
      normalizedKeys.add(normalized);
      entries.push([normalized, canonicalJson(descriptor.value, stack)]);
    }
    entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, encoded]) => `${JSON.stringify(key)}:${encoded}`).join(',')}}`;
  } finally {
    stack.delete(value);
  }
}

export const sha256Text = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
export const sha256Value = (value) => sha256Text(canonicalJson(value));
export const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
export const prettyJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function safeProjectRoot(path) {
  const root = resolve(path || '.');
  if (!existsSync(root) || !statSync(root).isDirectory()) fail('PROJECT_ROOT_NOT_FOUND', root);
  return root;
}

export function safeRelativePath(path) {
  if (typeof path !== 'string' || path.length === 0 || isAbsolute(path) || path.includes('\\') || path.includes(':')) {
    fail('UNSAFE_RELATIVE_PATH', String(path));
  }
  const parts = path.split('/');
  if (parts.some((part) => part === '..' || part === '')) fail('UNSAFE_RELATIVE_PATH', path);
  return parts.join('/');
}

export function resolveInside(root, path) {
  const safe = safeRelativePath(path);
  const target = resolve(root, ...safe.split('/'));
  const rel = relative(resolve(root), target);
  if (rel.startsWith('..') || isAbsolute(rel)) fail('PATH_ESCAPE', path);
  return target;
}

export function writeAtomicNoOverwrite(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    if (readFileSync(path, 'utf8') === text) return 'UNCHANGED';
    fail('EXISTING_FILE_CONFLICT', path);
  }
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, text, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
  return 'CREATE';
}

export function classifyFile(path, expectedText) {
  if (!existsSync(path)) return 'CREATE';
  return readFileSync(path, 'utf8') === expectedText ? 'UNCHANGED' : 'CONFLICT';
}

export function runtimeRoot(projectRoot) {
  const base = process.env.LOCALAPPDATA || process.env.XDG_STATE_HOME;
  if (!base) fail('USER_RUNTIME_BASE_UNAVAILABLE');
  return join(base, 'Codex', 'team-service-bootstrap', sha256Text(resolve(projectRoot).toLowerCase()).slice(0, 24));
}

export function listFiles(root, prefix = '') {
  if (!existsSync(root)) return [];
  const results = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) results.push(...listFiles(root, rel));
    else if (entry.isFile()) results.push(rel);
  }
  return results.sort();
}

export function expandRequiredEdges(profile) {
  const roles = new Set(profile.roles.map((role) => role.logical_chat_id));
  if (roles.size !== profile.roles.length) fail('DUPLICATE_ROLE_ID');
  const edges = [];
  for (const requirement of profile.edge_requirements) {
    const sources = profile.selectors[requirement.source_selector];
    const targets = profile.selectors[requirement.target_selector];
    if (!Array.isArray(sources) || !Array.isArray(targets)) fail('UNKNOWN_SELECTOR', requirement.requirement_id);
    for (const source of sources) for (const target of targets) {
      if (!roles.has(source) || !roles.has(target)) fail('UNKNOWN_ROLE', `${source}:${target}`);
      if (requirement.exclude_self && source === target) continue;
      edges.push({ requirement_id: requirement.requirement_id, source, target, kinds: [...requirement.kinds] });
    }
  }
  return edges;
}

function resolvePointer(document, fragment) {
  if (!fragment || fragment === '#') return document;
  if (!fragment.startsWith('#/')) fail('UNSUPPORTED_SCHEMA_REF', fragment);
  return fragment.slice(2).split('/').reduce((value, token) => {
    const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!value || !Object.hasOwn(value, key)) fail('UNRESOLVED_SCHEMA_REF', fragment);
    return value[key];
  }, document);
}

export function createSchemaRegistry(schemas) {
  const registry = new Map();
  for (const schema of schemas) {
    if (!schema?.$id) fail('SCHEMA_ID_REQUIRED');
    if (registry.has(schema.$id)) fail('DUPLICATE_SCHEMA_ID', schema.$id);
    registry.set(schema.$id, schema);
  }
  return registry;
}

function resolveRef(ref, current, registry) {
  if (ref.startsWith('#')) return resolvePointer(current, ref);
  const index = ref.indexOf('#');
  const id = index < 0 ? ref : ref.slice(0, index);
  const fragment = index < 0 ? '' : ref.slice(index);
  const target = registry.get(id);
  if (!target) fail('UNRESOLVED_SCHEMA_REF', ref);
  return resolvePointer(target, fragment);
}

const same = (left, right) => canonicalJson(left) === canonicalJson(right);

export function validateSchema(instance, schema, registry, current = schema, path = '$') {
  if (schema.$ref) return validateSchema(instance, resolveRef(schema.$ref, current, registry), registry,
    schema.$ref.startsWith('#') ? current : registry.get(schema.$ref.split('#')[0]), path);
  if (schema.anyOf) {
    const matches = schema.anyOf.filter((candidate) => {
      try { validateSchema(instance, candidate, registry, current, path); return true; } catch { return false; }
    });
    if (matches.length === 0) fail('SCHEMA_ANY_OF_FAILED', path);
    return true;
  }
  if (Object.hasOwn(schema, 'const') && !same(instance, schema.const)) fail('SCHEMA_CONST_FAILED', path);
  if (schema.enum && !schema.enum.some((item) => same(item, instance))) fail('SCHEMA_ENUM_FAILED', path);
  if (schema.type) {
    const valid = schema.type === 'null' ? instance === null
      : schema.type === 'object' ? instance !== null && typeof instance === 'object' && !Array.isArray(instance)
      : schema.type === 'array' ? Array.isArray(instance)
        : schema.type === 'integer' ? Number.isInteger(instance)
          : typeof instance === schema.type;
    if (!valid) fail('SCHEMA_TYPE_FAILED', `${path}:${schema.type}`);
  }
  if (typeof instance === 'string') {
    if (schema.minLength && instance.length < schema.minLength) fail('SCHEMA_MIN_LENGTH_FAILED', path);
    if (schema.pattern && !(new RegExp(schema.pattern, 'u')).test(instance)) fail('SCHEMA_PATTERN_FAILED', path);
  }
  if (Array.isArray(instance)) {
    if (schema.minItems && instance.length < schema.minItems) fail('SCHEMA_MIN_ITEMS_FAILED', path);
    if (schema.uniqueItems && new Set(instance.map((item) => canonicalJson(item))).size !== instance.length) fail('SCHEMA_UNIQUE_FAILED', path);
    if (schema.items) instance.forEach((item, index) => validateSchema(item, schema.items, registry, current, `${path}/${index}`));
  }
  if (instance !== null && typeof instance === 'object' && !Array.isArray(instance)) {
    for (const required of schema.required || []) if (!Object.hasOwn(instance, required)) fail('SCHEMA_REQUIRED_FAILED', `${path}/${required}`);
    const properties = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(instance)) if (!Object.hasOwn(properties, key)) fail('SCHEMA_ADDITIONAL_PROPERTY', `${path}/${key}`);
    }
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(instance, key)) validateSchema(instance[key], child, registry, current, `${path}/${key}`);
    }
  }
  return true;
}

export function versionInSupportedNodeRange(version = process.versions.node) {
  const [major, minor, patch] = version.split('.').map(Number);
  return major === 24 && (minor > 15 || (minor === 15 && patch >= 0));
}

export function portablePath(path, root) {
  return relative(root, path).split(sep).join('/');
}
