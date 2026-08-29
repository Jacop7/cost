import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalRuleset } from './github-ruleset.mjs';

const config = JSON.parse(readFileSync(new URL('../.github/rulesets/main-required.json', import.meta.url), 'utf8'));
const canonical = canonicalRuleset(config);
assert.equal(canonical.name, 'main-required-gates');
assert.equal(canonical.enforcement, 'active');
assert.deepEqual(canonical.bypass_actors, []);
assert.deepEqual(canonical.conditions.ref_name, { include: ['refs/heads/main'], exclude: [] });
assert.deepEqual(canonical.rules.map((rule) => rule.type), ['deletion', 'non_fast_forward', 'required_status_checks']);
assert.deepEqual(canonical.rules.at(-1).parameters.required_status_checks, [{ context: 'protected-gate' }]);
assert.equal(canonical.rules.at(-1).parameters.strict_required_status_checks_policy, true);
assert.equal(canonical.rules.at(-1).parameters.do_not_enforce_on_create, false);
assert.equal(JSON.stringify(canonicalRuleset({
  ...config,
  conditions: { ref_name: { exclude: [], include: ['refs/heads/main'] } },
})), JSON.stringify(canonical), 'GitHub가 JSON 키 순서를 바꿔도 같은 선언이다.');
console.log('GitHub ruleset 선언 계약 통과');
