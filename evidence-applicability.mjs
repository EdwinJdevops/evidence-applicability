import { constants, openSync, fstatSync, readSync, closeSync } from 'node:fs';

const LIMIT = 64 * 1024;
const HASH = /^[0-9a-f]{64}$/u;
const COMMIT = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const SCOPE = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,255}$/u;
const fields = {
  scope: SCOPE,
  commit: COMMIT,
  plan_sha256: HASH,
  inputs_sha256: HASH,
  state_sha256: HASH,
};

function parseManifest(path) {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    if (!fstatSync(descriptor).isFile()) throw new Error('Expected a regular file');
    const buffer = Buffer.alloc(LIMIT + 1);
    let position = 0;
    while (position < buffer.length) {
      const received = readSync(descriptor, buffer, position, buffer.length - position, null);
      if (received === 0) break;
      position += received;
    }
    if (position > LIMIT) throw new Error('Input too large');
    const source = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, position));
    const value = JSON.parse(source);
    // A string token followed by a colon is an object key in well-formed JSON.
    // JSON.parse discards duplicates, so compare source and parsed key counts.
    const tokens = source.match(/"(?:[^"\\]|\\[\s\S])*"\s*:?/gu) ?? [];
    const keysInSource = tokens.filter(token => token.endsWith(':')).length;
    if (keysInSource !== countKeys(value)) throw new Error('Duplicate member');
    return value;
  } finally {
    closeSync(descriptor);
  }
}

function countKeys(value) {
  if (value === null || typeof value !== 'object') return 0;
  if (Array.isArray(value)) return value.reduce((total, child) => total + countKeys(child), 0);
  return Object.entries(value).reduce((total, [, child]) => total + 1 + countKeys(child), 0);
}

function validate(record, schema) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Expected an object');
  }
  for (const [key, value] of Object.entries(record)) {
    if (!Object.hasOwn(schema, key)) throw new Error('Unexpected field');
    if (value !== null && (typeof value !== 'string' || !schema[key].test(value) || /\s/u.test(value))) {
      throw new Error('Invalid field');
    }
  }
}

function compare(actual, expected) {
  if (actual == null || expected == null) return 'UNKNOWN';
  return actual === expected ? 'PASS' : 'FAIL';
}

function evaluate(evidence, target) {
  validate(evidence, { ...fields, approved_plan_sha256: HASH });
  validate(target, fields);
  const checks = Object.fromEntries(
    Object.keys(fields).map(key => [key, compare(evidence[key], target[key])]),
  );
  checks.approval_binding = compare(evidence.approved_plan_sha256, target.plan_sha256);
  const results = Object.values(checks);
  const comparison = results.includes('FAIL') ? 'FAIL' : results.includes('UNKNOWN') ? 'UNKNOWN' : 'PASS';
  return { comparison, checks, provenance: 'UNVERIFIED', authorized: false };
}

function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node evidence-applicability.mjs <evidence.json> <target.json>');
    return 0;
  }
  if (args.length !== 2) {
    console.error('Expected an evidence manifest and a target manifest. See --help.');
    return 3;
  }
  try {
    const result = evaluate(parseManifest(args[0]), parseManifest(args[1]));
    console.log(JSON.stringify(result, null, 2));
    return { PASS: 0, FAIL: 1, UNKNOWN: 2 }[result.comparison];
  } catch {
    console.error('Invalid input. Supply two readable UTF-8 JSON manifests conforming to the README.');
    return 3;
  }
}

process.exitCode = main(process.argv.slice(2));
