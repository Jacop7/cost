import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

export const PIN = Object.freeze({
  version: '1.3.2',
  sha256: 'c99b04f1d615fa716637efae457d5c554f32259f9d249375de0086e3cc1a1df5',
});
const MAX_BYTES = 65536;
/** @param {import('./contracts.js').ProbeFailure} reasonCode
 * @returns {import('./contracts.js').DeviceProbe} */
function failure(reasonCode) {
  return { state: reasonCode === 'QUERY_TIMEOUT' || reasonCode === 'QUERY_FAILED'
    || reasonCode === 'INVALID_RESPONSE' ? 'UNVERIFIED' : 'BLOCKED',
  reasonCode, deviceCount: null, toolVersion: null };
}

/** Never spread CLI output into a provider-visible response.
 * @param {string} output
 * @returns {import('./contracts.js').DeviceProbe} */
export function parseDeviceList(output) {
  try {
    if (Buffer.byteLength(output) > MAX_BYTES) return failure('INVALID_RESPONSE');
    const value = JSON.parse(output);
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== 1 || !Array.isArray(value.deviceList)
      || value.deviceList.length > 64
      || value.deviceList.some((/** @type {unknown} */ id) =>
        typeof id !== 'string' || !/^[a-zA-Z0-9-]{8,128}$/.test(id))
      || new Set(value.deviceList).size !== value.deviceList.length) return failure('INVALID_RESPONSE');
    return { state: 'READY', reasonCode: value.deviceList.length ? 'DEVICE_PRESENT' : 'NO_DEVICE',
      deviceCount: value.deviceList.length, toolVersion: PIN.version };
  } catch { return failure('INVALID_RESPONSE'); }
}

/** Isolate caller environment; no proxy, agent, Node/Python injection or secrets.
 * @param {NodeJS.ProcessEnv} source */
export function queryEnvironment(source) {
  /** @type {NodeJS.ProcessEnv} */
  const result = {};
  for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP']) {
    const value = Object.entries(source).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1];
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/** Local W01 CLI adapter only, not a gateway. No shell, generic command or retries.
 * @param {string} executable @param {'version'|'list'} command @returns {Promise<string>} */
export function runReadQuery(executable, command) {
  if (!isAbsolute(executable) || !['version', 'list'].includes(command))
    return Promise.reject(new Error('QUERY_FAILED'));
  return new Promise((resolve, reject) => {
    execFile(executable, [command], { windowsHide: true, shell: false, timeout: 10000,
      maxBuffer: MAX_BYTES, encoding: 'utf8', env: queryEnvironment(process.env) }, (error, stdout) => {
      // Error objects/stderr may include raw identifiers; never propagate them.
      if (error) reject(new Error(error.killed ? 'QUERY_TIMEOUT' : 'QUERY_FAILED'));
      else resolve(stdout);
    });
  });
}

/** @param {string} path */
async function fileHash(path) { return createHash('sha256').update(await readFile(path)).digest('hex'); }

/** Injectable local seams for deterministic tests, never exposed as MCP arguments.
 * @param {string} executable
 * @param {{platform?: string, hash?: (path: string) => Promise<string>, run?: typeof runReadQuery}} options
 * @returns {Promise<import('./contracts.js').DeviceProbe>} */
export async function probeDevices(executable, options = {}) {
  const { platform = process.platform, hash = fileHash, run = runReadQuery } = options;
  if (platform !== 'win32') return failure('HOST_UNSUPPORTED');
  if (!isAbsolute(executable)) return failure('TOOL_MISSING');
  try { if (await hash(executable) !== PIN.sha256) return failure('TOOL_HASH_MISMATCH'); }
  catch { return failure('TOOL_MISSING'); }
  const unchanged = async () => {
    try { return await hash(executable) === PIN.sha256; }
    catch { return false; }
  };
  try {
    const version = JSON.parse(await run(executable, 'version'));
    if (!version || version.version !== PIN.version || Object.keys(version).length !== 1)
      return failure('TOOL_VERSION_MISMATCH');
    // Recheck before each subprocess and after it. Same-user adversarial replacement is out of scope.
    if (!await unchanged()) return failure('TOOL_CHANGED');
    const result = parseDeviceList(await run(executable, 'list'));
    if (!await unchanged()) return failure('TOOL_CHANGED');
    return result;
  } catch (error) {
    return failure(error instanceof Error && error.message === 'QUERY_TIMEOUT' ? 'QUERY_TIMEOUT' : 'QUERY_FAILED');
  }
}

/** @param {import('./contracts.js').DeviceProbe} discovery
 * @returns {import('./contracts.js').Diagnosis} */
export function diagnosis(discovery) {
  return { schemaVersion: 1, phase: 'W01_M0A', discovery,
    control: { state: 'BLOCKED', reasonCode: 'BROKER_NOT_IMPLEMENTED' },
    capture: { state: 'UNVERIFIED', reasonCode: 'FOREGROUND_GUARD_NOT_IMPLEMENTED' },
    accessibility: { state: 'UNVERIFIED', reasonCode: 'FOREGROUND_GUARD_NOT_IMPLEMENTED' },
    environmentState: 'UNVERIFIED', outputPermission: 'METADATA_ONLY' };
}
