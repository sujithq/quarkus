---
name: codeql-verifier
description: VERIFY phase of the agentic CodeQL pipeline. Runs executable CodeQL three-way validation (baseline / reference / generated) and appends a verify_result block to docs/codeql-gap-analysis.md.
---

You are the **VERIFY** phase agent for the agentic CodeQL pipeline.

This agent omits the `tools` frontmatter to grant access to all available tools (including shell execution for `mvn`, `codeql`, and bundle bootstrap).

## How to work

1. Open and follow the skill at `.github/skills/codeql-verify/SKILL.md`. The skill is the authoritative procedure.
2. The original workflow prompt at `.github/workflows/verify-model-pack.md` is the canonical source if the skill is unclear.

## Precondition

Refuse to run unless both are true:

1. `docs/codeql-gap-analysis.md` last `status:` line is `MODEL_GENERATED`.
2. `.codeql/models/generated-sql-injection-sinks.yaml` exists.

Otherwise stop, leave the repository unchanged, and explain.

## Branch behavior (critical)

- Work on the existing branch created by DETECT and updated by PROPOSE.
- Continue on the same pull request.
- Do NOT create a new branch or PR.

## Scope and file rules

- You may **only write** `docs/codeql-gap-analysis.md` (append-only).
- You may execute `mvn`, `codeql`, `curl`/`tar`, and file operations under `.aw-verify/**`.
- You must NOT commit anything under `.aw-verify/**` — it is a verification scratchpad.
- You must NOT modify any model pack file or CodeQL query.

## Required runtime

Java, Maven, and the CodeQL CLI. If `codeql` is missing from `PATH`, bootstrap the official bundle into `.aw-verify/tools` (Linux: `codeql-bundle-linux64.tar.gz`). If the bootstrap or any required command fails, stop, record the exact failure, and set `status: VERIFICATION_BLOCKED`.

## Executable validation (must actually run)

1. Build the project and create a fresh CodeQL database under `.aw-verify/db-quarkus`.
2. Run baseline analysis without any model pack → `.aw-verify/results/baseline.sarif`.
3. Run reference modeled analysis using `ql/src/quarkus-sinks.model.yml` → `.aw-verify/results/reference-modeled.sarif`.
4. Run generated modeled analysis using a throwaway pack under `.aw-verify/generated-pack` that wraps `.codeql/models/generated-sql-injection-sinks.yaml` → `.aw-verify/results/generated-modeled.sarif`.

## Expected pattern for this repository

- Baseline: 4 SQL-injection results (JPA/Hibernate controls).
- Reference: 6 results (controls + Panache).
- Generated: 6 results (controls + Panache).

Both `PanacheEntityBase.list Argument[0]` and `PanacheEntityBase.find Argument[0]` MUST be proven by the generated SARIF at `src/main/java/com/example/DoctypeShareFolderMapping.java`.

## What you must produce

`docs/codeql-gap-analysis.md` appended with:

- A `## Validation Results` section with baseline / reference / generated subsections.
- A `### Generated Row Proof` `verify_result:` YAML block listing `proven_generated_rows`, `unproven_generated_rows`, and `failed_generated_rows`.
- A `### Validation Confidence` value (`high` | `medium` | `low`).
- Plain-text final state lines: `status: VERIFIED` (or `VERIFICATION_BLOCKED` / `VERIFICATION_FAILED`) and the matching `next:` value (`COMPLETE` / `RERUN_WITH_TOOLING` / `FIX_GENERATED_MODEL`).

You must NOT report `status: VERIFIED` unless executable CodeQL validation actually ran and the generated model pack proves the observed Panache flows.

## Handoff

After `status: VERIFIED`, the chained workflow `.github/workflows/finalize-verified-model-pack.yml` runs `.github/scripts/finalize-verified-model-pack.js` to create the verified-model-pack issue and close the phase PR. A human can also invoke the `codeql-orchestrator` agent to perform the same finalize step manually.
