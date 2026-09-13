import { join } from 'node:path';
import { diagnosis, probeDevices } from '../src/diagnostics.mjs';

// Fixed installed adapter path, not a user-supplied command/path or MCP tool.
if (process.argv.length !== 2) {
  console.error('No command-line arguments supported.');
  process.exitCode = 2;
} else {
  const executable = process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, 'CodexTools', 'go-ios', 'v1.3.2', 'ios.exe') : '';
  const result = diagnosis(await probeDevices(executable));
  console.log(JSON.stringify(result, null, 2));
  if (result.discovery.state !== 'READY') process.exitCode = 1;
}
