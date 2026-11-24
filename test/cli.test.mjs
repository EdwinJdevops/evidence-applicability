import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const cli = fileURLToPath(new URL('../evidence-applicability.mjs', import.meta.url));
const baseline = JSON.parse(readFileSync(new URL('../examples/evidence.json', import.meta.url)));
const target = JSON.parse(readFileSync(new URL('../examples/target.json', import.meta.url)));

function run(t, evidence, operation = target) {
  const directory = mkdtempSync(join(tmpdir(), 'evidence-test-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const evidencePath = join(directory, 'evidence.json');
  const targetPath = join(directory, 'target.json');
  writeFileSync(evidencePath, typeof evidence === 'string' ? evidence : JSON.stringify(evidence));
  writeFileSync(targetPath, JSON.stringify(operation));
  const result = spawnSync(process.execPath, [cli, evidencePath, targetPath], { encoding: 'utf8' });
  assert.ifError(result.error);
  return { ...result, report: result.stdout ? JSON.parse(result.stdout) : null };
}

test('matching assertions never authorize deployment', t => {
  const { status, report, stdout } = run(t, baseline);
  assert.equal(status, 0);
  assert.equal(report.comparison, 'PASS');
  assert.equal(report.provenance, 'UNVERIFIED');
  assert.equal(report.authorized, false);
  assert.equal(Object.keys(report.checks).length, 6);
  assert.ok(Object.values(report.checks).every(result => result === 'PASS'));
  assert.ok(!stdout.includes(baseline.scope));
});

for (const [key, value, check] of [
  ['scope', 'other/repo:prod:default:apply', 'scope'],
  ['commit', 'b'.repeat(40), 'commit'],
  ['plan_sha256', '4'.repeat(64), 'plan_sha256'],
  ['inputs_sha256', '4'.repeat(64), 'inputs_sha256'],
  ['state_sha256', '4'.repeat(64), 'state_sha256'],
  ['approved_plan_sha256', '4'.repeat(64), 'approval_binding'],
]) {
  test(`detects ${check} mismatch`, t => {
    const { status, report } = run(t, { ...baseline, [key]: value });
    assert.equal(status, 1);
    assert.equal(report.checks[check], 'FAIL');
  });
}

test('missing evidence returns unknown', t => {
  const { status, report } = run(t, { ...baseline, state_sha256: null });
  assert.equal(status, 2);
  assert.equal(report.checks.state_sha256, 'UNKNOWN');
});

test('known mismatch takes precedence over missing evidence', t => {
  const { status, report } = run(t, { ...baseline, state_sha256: null }, { ...target, scope: 'other' });
  assert.equal(status, 1);
  assert.equal(report.checks.state_sha256, 'UNKNOWN');
  assert.equal(report.checks.scope, 'FAIL');
});

for (const [label, malformed] of [
  ['malformed JSON', '{'],
  ['duplicate keys', '{"scope":"one","\\u0073cope":"two"}'],
  ['unrecognized fields', { ...baseline, authorized: true }],
  ['invalid digest', { ...baseline, plan_sha256: 'a'.repeat(64) + '\n' }],
  ['non-object input', []],
  ['oversized file', ' '.repeat(65537)],
]) {
  test(`rejects ${label}`, t => {
    const { status, report, stderr } = run(t, malformed);
    assert.equal(status, 3);
    assert.equal(report, null);
    assert.match(stderr, /^Invalid input\./);
  });
}

test('a missing file returns an input error', () => {
  const result = spawnSync(process.execPath, [cli, cli + '.missing', cli], { encoding: 'utf8' });
  assert.equal(result.status, 3);
  assert.equal(result.stdout, '');
});

test('the committed examples match', t => {
  const fixture = name => fileURLToPath(new URL(`../examples/${name}.json`, import.meta.url));
  const result = spawnSync(process.execPath, [cli, fixture('evidence'), fixture('target')], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).comparison, 'PASS');
});
