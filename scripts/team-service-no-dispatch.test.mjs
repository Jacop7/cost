import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { read, sha256, validateBundle, importsOf, verifyObservation } from './team-service-admission.mjs';
const bundlePath=process.env.AC24_BUNDLE_PATH ?? 'docs/team/service-flow-admission-bundle.json';
const bundle=JSON.parse(read(bundlePath));
const runId=process.env.AC24_RUN_ID ?? 'AC24-ADMISSION-LOCAL';
assert.match(runId,/^AC24-(ADMISSION|FIX-BUNDLE)-[A-Z0-9-]+$/);

test('AC-24 service contract',()=>{
  const sources=validateBundle(bundle);
  assert.equal(sources.size,bundle.modules.length,'AC-24-A1');
  const head=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});
  assert.equal(head.status,0); assert.equal(head.stdout.trim(),bundle.bundle_commit);
  const script=`import {runAdmission,read} from './scripts/team-service-admission.mjs'; console.log(JSON.stringify(await runAdmission(JSON.parse(read(${JSON.stringify(bundlePath)})))));`;
  const child=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',script],
    {encoding:'utf8',timeout:15000,env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH}});
  assert.equal(child.status,0,child.stderr);
  const result=JSON.parse(child.stdout);
  assert.equal(verifyObservation(result,bundle),true);
  for(const bad of [{...result,normal_dispatch_attempts:1},{...result,actual_provider_calls:1},
    {...result,negative_rejections:[]},{...result,host_cases:[]},{...result,scenario_ids:[]},
    {...result,import_closure:[]},{...result,normal:{...result.normal,revision:0}}]) {
    assert.throws(()=>verifyObservation(bad,bundle));
  }
  assert.ok(result.negative_fake_attempts===4 && result.actual_provider_calls===0,'AC-24-A2');
  assert.ok(result.normal_dispatch_attempts===0 && result.normal.revision===18 && result.normal.stop_status==='STOPPED','AC-24-A3');
  assert.ok(result.host_cases.length===5 && result.host_cases.every(c=>c.status==='BLOCKED_HOST') && !result.service_ready,'AC-24-A4');
  const assertions=[['AC-24-A1',{closure:result.import_closure}],['AC-24-A2',{rejections:result.negative_rejections,actual_provider_calls:result.actual_provider_calls}],
    ['AC-24-A3',{normal:result.normal,normal_dispatch_attempts:result.normal_dispatch_attempts}],['AC-24-A4',{host_cases:result.host_cases,service_ready:result.service_ready}]];
  console.log('AC24_OBSERVATION '+JSON.stringify({...result,snapshot:'WORKING_TREE_HASHED',allowlist_sha256:sha256(read(bundlePath)),
    assertion_observations:assertions.map(([assertion_id,observation])=>({assertion_id,case_id:'AC-24',run_id:runId,target_commit:bundle.bundle_commit,
      test_sha256:sha256(read('scripts/team-service-no-dispatch.test.mjs')),verifier_sha256:sha256(read('scripts/team-service-admission.mjs')),
      artifact_sha256:sha256(read(bundlePath)),observation,verification_result:'PASS'}))}));
});

test('AC24 rejects empty, omitted, extra, stale and dynamically imported target bundles',()=>{
  assert.throws(()=>validateBundle({...bundle,target_modules:[] }));
  assert.throws(()=>validateBundle({...bundle,scenario_ids:[] }));
  assert.throws(()=>validateBundle({...bundle,modules:bundle.modules.slice(1)}),/MISSING_IMPORT/);
  assert.throws(()=>validateBundle({...bundle,modules:[...bundle.modules,{path:'scripts/unused.mjs',sha256:'0'.repeat(64)}]}),/EXTRA_OR_MISSING/);
  assert.throws(()=>validateBundle(bundle,()=>Buffer.from('changed')),/SOURCE_DRIFT/);
  assert.throws(()=>validateBundle({...bundle,harness_files:bundle.harness_files.map((m,i)=>i===0?{...m,sha256:'0'.repeat(64)}:m)}),/HARNESS_DRIFT/);
  assert.throws(()=>importsOf('import value from name;'),/NON_LITERAL_IMPORT|INVALID_SYNTAX/);
  assert.throws(()=>importsOf("import('node:http')"),/DYNAMIC_IMPORT/);
  for(const specifier of ['node:http','node:child_process','./team-router-cli.mjs']) {
    const target=bundle.target_modules[0],bytes=Buffer.from(`import '${specifier}';`);
    const modified={...bundle,modules:bundle.modules.map(m=>m.path===target?{...m,sha256:sha256(bytes)}:m)};
    assert.throws(()=>validateBundle(modified,p=>p===target?bytes:read(p)),/FORBIDDEN_IMPORT|MISSING_IMPORT/);
  }
});

test('AC24 target-module negative fixture is denied in the same VM',()=>{
  const negativePath='scripts/team-service-admission-negative-fixture.mjs';
  const negative={...bundle,scenario:negativePath,negative_only:true,
    modules:[...bundle.modules.filter((m)=>m.path!==bundle.scenario),{path:negativePath,sha256:sha256(read(negativePath))}]};
  validateBundle(negative);
  const encoded=JSON.stringify(JSON.stringify(negative));
  const script=`import assert from 'node:assert/strict'; import {runAdmission} from './scripts/team-service-admission.mjs'; await assert.rejects(()=>runAdmission(JSON.parse(${encoded})),/NO_DISPATCH:fetch/); console.log('TARGET_NEGATIVE_DENIED');`;
  const child=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',script],
    {encoding:'utf8',timeout:15000,env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH}});
  assert.equal(child.status,0,child.stderr); assert.match(child.stdout,/TARGET_NEGATIVE_DENIED/);
});
