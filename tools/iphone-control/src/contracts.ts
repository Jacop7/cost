/** W01 metadata only. Neither capability readiness nor discovery grants control. */
export type CapabilityState = 'READY' | 'DEGRADED' | 'BLOCKED' | 'UNVERIFIED';
export type ProbeFailure = 'TOOL_MISSING' | 'TOOL_HASH_MISMATCH' | 'TOOL_CHANGED'
  | 'TOOL_VERSION_MISMATCH' | 'QUERY_TIMEOUT' | 'QUERY_FAILED'
  | 'INVALID_RESPONSE' | 'HOST_UNSUPPORTED';
export type DeviceProbe =
  | { state: 'READY'; reasonCode: 'DEVICE_PRESENT' | 'NO_DEVICE'; deviceCount: number; toolVersion: '1.3.2' }
  | { state: 'BLOCKED' | 'UNVERIFIED'; reasonCode: ProbeFailure; deviceCount: null; toolVersion: null };
export interface Diagnosis {
  schemaVersion: 1;
  phase: 'W01_M0A';
  discovery: DeviceProbe;
  control: { state: 'BLOCKED'; reasonCode: 'BROKER_NOT_IMPLEMENTED' };
  capture: { state: 'UNVERIFIED'; reasonCode: 'FOREGROUND_GUARD_NOT_IMPLEMENTED' };
  accessibility: { state: 'UNVERIFIED'; reasonCode: 'FOREGROUND_GUARD_NOT_IMPLEMENTED' };
  environmentState: 'UNVERIFIED';
  outputPermission: 'METADATA_ONLY';
}
