# Evidence applicability for infrastructure changes

2026-11-24 · Focused source audit and prototype evaluation

## Result

A saved plan's integrity, the freshness of its inputs and state, and the scope of the approval are separate checks. Atlantis already implements saved-plan integrity and documents controls for stale pull-request approvals. OpenTaco Layer-0 handles state access and coordination. in-toto specifies artifact relationships and verification against trusted functionaries. The proposed contribution is a small diagnostic that reports which supplied claims still refer to the same operation. Its incremental value in a real workflow remains a hypothesis.

## Artifact inspection

The referenced ChatGPT transcript lists `ziggity_infrastructure_research_report.md` and `evidence-applicability-cli.zip` as sandbox download links. The chat reader returned zero attachments and did not expose the files behind the links. No matching downloads were found in the workspace or the Downloads root. Prior claims about the archive contents, 11 tests and commit `ff49244` remain unverified. This repository contains a fresh implementation in Node.js 24, which was already executable locally.

## Verified source findings

| Tool and audited revision | Observed behavior and scope |
| --- | --- |
| Ziggity, commit `82ea6ea9a855e4d34d4c8ccec4fa0b0bffa92df6` | The README describes a keyboard-driven Git interface that uses the installed Git. The Git wrapper calls the subprocess API. This establishes the Git execution model in the sampled files. [README](https://github.com/simoarpe/ziggity/blob/82ea6ea9a855e4d34d4c8ccec4fa0b0bffa92df6/README.md#L40-L70) · [Git wrapper](https://github.com/simoarpe/ziggity/blob/82ea6ea9a855e4d34d4c8ccec4fa0b0bffa92df6/src/git.zig#L100-L131) |
| Atlantis v0.49.0, commit `5718f12b631cd5bc490a380325737d42a5400fa5` | The plan stage computes a convention-file hash and returns it with the plan result. The apply path loads the plan, sets the recorded expected hash, and handles older statuses or custom workflows separately. The approval documentation describes VCS PR approval, latest reviewer decisions and the optional discard-on-plan mitigation. PR approval is separate from the saved-plan hash. [Plan source](https://github.com/runatlantis/atlantis/blob/5718f12b631cd5bc490a380325737d42a5400fa5/server/events/project_command_runner.go#L902-L940) · [Apply source](https://github.com/runatlantis/atlantis/blob/5718f12b631cd5bc490a380325737d42a5400fa5/server/events/project_command_runner.go#L995-L1031) · [Approval documentation](https://github.com/runatlantis/atlantis/blob/5718f12b631cd5bc490a380325737d42a5400fa5/runatlantis.io/docs/command-requirements.md#approved) · [Release notes](https://github.com/runatlantis/atlantis/releases/tag/v0.49.0) |
| OpenTaco Layer-0 in Digger, commit `3dc1c51eb94ca04398496a2cd27673901a6f7d22` | The pinned Layer-0 README describes state CRUD, locks and HTTP backend proxying. Remote runs and PR automation are discussed separately from this layer. The backend handler dispatches lock and unlock operations. This scope covers the `taco/` subsystem. It leaves wider Digger workflows and hosted behavior unassessed. [Layer-0 scope](https://github.com/diggerhq/digger/blob/3dc1c51eb94ca04398496a2cd27673901a6f7d22/taco/README.md#L1-L23) · [Backend implementation](https://github.com/diggerhq/digger/blob/3dc1c51eb94ca04398496a2cd27673901a6f7d22/taco/internal/backend/handler.go#L182-L205) |
| in-toto specification v1.0, commit `926031f40be8db78f992f02f3e50e97a09db5320` | Layout and link verification can associate artifact identities with declared steps and functionaries. This is prior art for binding hashes to workflow evidence and provides a candidate foundation for authenticated collection. [Verification example](https://github.com/in-toto/specification/blob/926031f40be8db78f992f02f3e50e97a09db5320/in-toto-spec.md#L438-L523) |

The audit sampled pinned files from GitHub. It did not exercise upstream products or exhaustively survey policy engines, orchestration platforms or attestation systems.

## Hypotheses and validation protocol

**H1.** A cross-tool, read-only comparison helps reviewers diagnose which claim became stale. Measure this in disposable, pinned workflows using a local provider-free fixture and a test repository. Record plan bytes, expected plan digest, Git revision, state lineage and serial, input snapshot, approval time and target scope as distinct observations. Compare the CLI's output against the native workflow decision for each scenario.

**H2.** Binding a decision to both its operation scope and the exact plan offers diagnostic value beyond PR-level review. Use a benign replan on the same commit, then record whether the native workflow keeps or clears approval under each configured policy. Include a fully matching control, a replan with fresh approval, a different scope, a missing observation, and a legitimate state change between observations. Do not infer a defect from a policy difference. Avoid live infrastructure and production artifacts.

**H3.** Authenticated, independently collected manifests could make the comparison useful for a decision service. Validate issuer policy, signature, freshness, replay resistance and the execution-time boundary with a future trusted collector. A passing equality check currently provides no evidence for H3.

## Verification and release criteria

The synthetic Node suite exercises matching claims, six mismatch dimensions, missing evidence, precedence, malformed input and committed examples. It checks that the result stays unverified and cannot authorize execution. The suite measures the implemented comparison semantics. Upstream behavior and real-world novelty remain untested.

Before publishing a version, require passing checks on the exact PR revision, independent maintainer review and a reproducible workflow comparison with recorded observations. Keep this advisory prototype separate from any production enforcement. A production claim would additionally require independently verified provenance and an execution-time freshness control.
