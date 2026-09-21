// Read-only catalog probe. Never creates a thread, turn, message or model invocation.
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const cli = 'C:/Users/jacop/AppData/Roaming/npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe';
const output = new URL('./TEAM-SERVICE-MODEL-CATALOG-20260906-001.json', import.meta.url);
if (existsSync(output)) throw Error('Immutable output already exists');
const sha = b => createHash('sha256').update(b).digest('hex');
const version = execFileSync(cli, ['--version'], { encoding:'utf8', windowsHide:true }).trim();
const child = spawn(cli, ['app-server', '--listen', 'stdio://'], { windowsHide:true, shell:false, stdio:['pipe','pipe','pipe'] });
const lines = createInterface({ input:child.stdout });
const requests = [], responses = [];
let done = false, pages = 0, stderr = '';
child.stderr.on('data', c => { if (stderr.length < 100000) stderr += c.toString(); });
function send(message) {
  if (!['initialize','initialized','model/list'].includes(message.method)) throw Error('Forbidden method');
  requests.push(message); child.stdin.write(JSON.stringify(message)+'\n');
}
function finish(status, reason = null) {
  if (done) return; done = true; clearTimeout(timer);
  const data = responses.flatMap(r => r.result?.data ?? []);
  const selected = data.find(m => m.model === 'gpt-6-astra');
  const matched = !!selected?.supportedReasoningEfforts?.some(e => e.reasoningEffort === 'high');
  const record = {kind:'LOCAL_CLI_MODEL_LIST_OBSERVATION_NOT_PROVIDER_ATTESTATION', observed_at:new Date().toISOString(),
    documentation:'https://learn.chatgpt.com/docs/app-server', cli, cli_version:version, cli_sha256:sha(readFileSync(cli)),
    requests, responses, status, reason, target:{model:'gpt-6-astra',reasoning_effort:'high',catalog_matched:matched},
    account_scope:'owner-primary', account_scope_source:'existing project declaration; no account credentials queried',
    scope:'Local CLI app-server listing, not the desktop process or paid inference, and not host caller/receipt evidence',
    model_invocations:0, threads_created:0, configuration_writes:0, stderr_sha256:sha(stderr)};
  writeFileSync(output, JSON.stringify(record,null,2)+'\n', {flag:'wx'});
  console.log(JSON.stringify({status,reason,matched,model_count:data.length,output:output.pathname}));
  lines.close(); child.stdin.end(); child.kill(); process.exitCode = status === 'COMPLETE' && matched ? 0 : 2;
}
const timer = setTimeout(() => finish('INCOMPLETE','TIMEOUT_45_SECONDS'),45000);
child.on('error', () => finish('INCOMPLETE','PROCESS_ERROR'));
child.on('exit', () => { if (!done) finish('INCOMPLETE','PROCESS_EXIT_BEFORE_COMPLETE'); });
lines.on('line', raw => {
  let msg; try { msg=JSON.parse(raw); } catch { return finish('INCOMPLETE','NON_JSON_OUTPUT'); }
  if (msg.id === 0) {
    if (msg.error) return finish('INCOMPLETE','INITIALIZE_ERROR');
    send({method:'initialized',params:{}});
    send({method:'model/list',id:1,params:{limit:100,includeHidden:false}});
  } else if (Number.isInteger(msg.id) && msg.id > 0) {
    responses.push(msg); if (msg.error) return finish('INCOMPLETE','MODEL_LIST_ERROR');
    if (!Array.isArray(msg.result?.data)) return finish('INCOMPLETE','INVALID_MODEL_LIST');
    if (msg.result.nextCursor) {
      if (++pages >= 4) return finish('INCOMPLETE','PAGINATION_LIMIT');
      send({method:'model/list',id:msg.id+1,params:{limit:100,includeHidden:false,cursor:msg.result.nextCursor}});
    } else finish('COMPLETE');
  }
});
send({method:'initialize',id:0,params:{clientInfo:{name:'margincook_model_catalog_audit',version:'0.1.0'}}});
