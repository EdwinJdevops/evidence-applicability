# Evidence Applicability

An offline research CLI that compares evidence claims against a proposed infrastructure operation. Use Node.js 24. The CLI has zero package dependencies.

```sh
node evidence-applicability.mjs examples/evidence.json examples/target.json
node --test
```

Pass two UTF-8 JSON objects, each at most 64 KiB. Evidence and target accept the following keys. Missing or null values mean unknown.

| Key | Meaning |
| --- | --- |
| `scope` | Caller-defined canonical operation identifier that includes repository, environment, workspace and operation. Use 1–256 ASCII letters, digits or `._:/-`, starting with a letter or digit. |
| `commit` | Full Git object ID in lowercase hexadecimal, 40 or 64 characters. |
| `plan_sha256` | Lowercase 64-character SHA-256 digest of the exact saved plan bytes. |
| `inputs_sha256` | Lowercase SHA-256 digest of the caller-defined input snapshot. |
| `state_sha256` | Lowercase SHA-256 digest of the caller-defined state snapshot. |
| `approved_plan_sha256` | Evidence only. Claimed digest of the plan that was approved. |

Use identical snapshot conventions for both manifests. Keep the target independently sourced. The CLI rejects unknown fields, duplicate keys and malformed values. Output gives one result per comparison. A mismatch takes precedence over missing evidence.

| Exit | Meaning |
| --- | --- |
| 0 | `PASS`, all supplied claims required by the schema agree |
| 1 | `FAIL`, at least one mismatch |
| 2 | `UNKNOWN`, required claims absent and no known mismatch |
| 3 | Invalid invocation or input |

Every result includes `provenance: UNVERIFIED` and `authorized: false`. Exit 0 is a data-comparison result only. See [security boundaries](SECURITY.md) and the [research report](RESEARCH.md).
