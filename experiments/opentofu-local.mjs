import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [tofu] = process.argv.slice(2);
assert.ok(tofu, 'Pass the absolute path to a verified OpenTofu 1.13.9 executable.');
const dir = mkdtempSync(join(tmpdir(), 'evidence-tofu-'));
const cli = fileURLToPath(new URL('../evidence-applicability.mjs', import.meta.url));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(TF_|TOFU_)/i.test(key),
));
env.TF_IN_AUTOMATION = '1';
env.TF_CLI_CONFIG_FILE = join(dir, 'empty.tfrc');
env.CHECKPOINT_DISABLE = '1';

function execute(binary, args, expected = 0) {
  const result = spawnSync(binary, args, { cwd: dir, env, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result;
}

const config = value => `resource "terraform_data" "example" {
  input = "${value}"
}

output "observed" {
  value = terraform_data.example.output
}
`;
const write = (name, value) => writeFileSync(join(dir, name), value);
const digest = name => createHash('sha256').update(readFileSync(join(dir, name))).digest('hex');
const state = () => JSON.parse(readFileSync(join(dir, 'terraform.tfstate'), 'utf8'));
const plan = name => execute(tofu, ['plan', '-no-color', '-input=false', '-out=' + name]);
const apply = (name, expected) => execute(tofu, ['apply', '-no-color', '-input=false', name], expected);
const assertion = (planName, commit) => ({
  scope: 'local/fixture:isolated:default:apply',
  commit,
  plan_sha256: digest(planName),
  inputs_sha256: digest('main.tf'),
  state_sha256: digest('terraform.tfstate'),
});

function compare(evidence, target, exit) {
  write('evidence.json', JSON.stringify(evidence));
  write('target.json', JSON.stringify(target));
  const { stdout } = execute(process.execPath, [cli, 'evidence.json', 'target.json'], exit);
  const result = JSON.parse(stdout);
  assert.equal(result.authorized, false);
  assert.equal(result.provenance, 'UNVERIFIED');
  return result;
}

try {
  write('empty.tfrc', '');
  const version = execute(tofu, ['version']).stdout.trim().split(/\r?\n/)[0];
  assert.equal(version, 'OpenTofu v1.13.9');
  write('main.tf', config('seed'));
  execute(tofu, ['init', '-no-color', '-input=false']);
  plan('seed.plan');
  apply('seed.plan');
  const baselineState = state();

  write('main.tf', config('reviewed'));
  execute('git', ['init', '-q']);
  execute('git', ['add', 'main.tf']);
  execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Evidence fixture']);
  const commit = execute('git', ['rev-parse', 'HEAD']).stdout.trim();
  plan('reviewed.plan');
  const reviewed = assertion('reviewed.plan', commit);
  const evidence = { ...reviewed, approved_plan_sha256: reviewed.plan_sha256 };
  const control = compare(evidence, reviewed, 0);

  write('main.tf', config('replanned'));
  plan('replanned.plan');
  const replanned = assertion('replanned.plan', commit);
  const replan = compare(evidence, replanned, 1);
  assert.equal(replan.checks.commit, 'PASS');
  for (const field of ['plan_sha256', 'inputs_sha256', 'approval_binding']) {
    assert.equal(replan.checks[field], 'FAIL');
  }
  assert.equal(replan.checks.state_sha256, 'PASS');

  // A saved plan can carry earlier configuration. Applying it advances the local state.
  const changedInputs = compare(evidence, assertion('reviewed.plan', commit), 1);
  assert.equal(changedInputs.checks.inputs_sha256, 'FAIL');
  assert.equal(changedInputs.checks.approval_binding, 'PASS');
  apply('reviewed.plan');
  const after = state();
  assert.equal(after.outputs.observed.value, 'reviewed');
  assert.equal(after.lineage, baselineState.lineage);
  assert.ok(after.serial > baselineState.serial);

  const stale = apply('replanned.plan', 1);
  assert.match(stale.stderr, /Saved plan is stale/i);
  const stateChange = compare({ ...replanned, approved_plan_sha256: replanned.plan_sha256 },
    assertion('replanned.plan', commit), 1);
  assert.equal(stateChange.checks.state_sha256, 'FAIL');
  assert.ok(Object.entries(stateChange.checks).every(([key, value]) =>
    key === 'state_sha256' || value === 'PASS',
  ));

  console.log(JSON.stringify({
    version,
    baseline: control.checks,
    sameCommitReplan: replan.checks,
    changedLocalInputs: changedInputs.checks,
    nativeOldPlan: { exit: 0, output: after.outputs.observed.value },
    nativeStalePlan: { exit: 1, diagnostic: 'Saved plan is stale' },
    stateSerial: [baselineState.serial, after.serial],
    stateChange: stateChange.checks,
  }, null, 2));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
