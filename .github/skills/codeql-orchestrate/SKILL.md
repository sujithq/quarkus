---
name: codeql-orchestrate
description: Drive the DETECT → PROPOSE → VERIFY → Finalize state machine end-to-end, locally or via dispatched CI workflows. Mirrors `.github/workflows/chain-agentic-phases.yml` and `.github/scripts/finalize-verified-model-pack.js`.
---

# Skill: codeql-orchestrate

Canonical sources:

- [.github/workflows/chain-agentic-phases.yml](../../workflows/chain-agentic-phases.yml)
- [.github/scripts/finalize-verified-model-pack.js](../../scripts/finalize-verified-model-pack.js)

## When to use

When asked to "run the agentic CodeQL flow", "reconcile open agentic PRs", or "finalize the verified model pack".

## State machine

Read the last `status:` and `next:` lines in `docs/codeql-gap-analysis.md`:

| status               | next             | Action                                  |
| -------------------- | ---------------- | --------------------------------------- |
| _missing or NO_GAP_  | _missing/STOP_   | Run **codeql-detect** skill             |
| GAP_DETECTED         | PROPOSE_MODEL    | Run **codeql-propose** skill            |
| MODEL_GENERATED      | VERIFY           | Run **codeql-verify** skill             |
| VERIFIED             | COMPLETE         | Run **Finalize** step (below)           |
| VERIFICATION_BLOCKED | RERUN_WITH_TOOLING | Re-bootstrap CodeQL CLI, re-run verify |
| VERIFICATION_FAILED  | FIX_GENERATED_MODEL | Hand back to **codeql-propose**        |

## Operating modes

### Local mode

Run the phase skills sequentially in chat. Each skill works on `docs/codeql-gap-analysis.md` on the current working branch (do NOT branch between phases — phases share one branch / one PR).

### CI mode

Dispatch the gh-aw workflows and let `chain-agentic-phases.yml` sequence them:

```pwsh
gh workflow run detect-codeql-gap.lock.yml --ref main
# chain-agentic-phases.yml will dispatch PROPOSE, then VERIFY automatically.
gh run watch <run-id> --exit-status
```

## Finalize step (after VERIFIED)

Delegate to the existing script — it is idempotent and the source of truth for issue body shape, labels, and PR closure:

```pwsh
$env:GH_TOKEN = (gh auth token)
$env:GITHUB_REPOSITORY = "sujithq/quarkus"
# Optional: $env:DRY_RUN = "true"
node .github/scripts/finalize-verified-model-pack.js
```

What it does:

1. Finds the verified PR (head branch contains `.codeql/models/generated-sql-injection-sinks.yaml` AND analysis with `status: VERIFIED`/`next: COMPLETE`).
2. Creates or updates the issue (idempotent via SHA-256 marker over generated pack content).
3. Issue body: Generated Model Pack → Code Locations → Verification (`verify_result` minus `reference_count` and `generated_matches_reference`).
4. Ensures labels exist: `agentic-codeql`, `codeql-model-pack`, `agentic-phase-pr`, `verified-model-pack`.
5. Labels and closes each related phase PR with a comment linking the issue.

Do NOT re-implement this in the agent — always call the script.

## Concurrency rule

Never run two phases for the same branch simultaneously. Before starting a phase, check that no in-progress run exists for the branch (matches `chain-agentic-phases.yml` `active_runs` guard).

## Never merge phase PRs

The finalize step closes phase PRs with `state: closed` (see `closePullRequest` in `.github/scripts/finalize-verified-model-pack.js`). It never merges. Phase PRs are throwaway carriers for the generated artifacts — the canonical record lives in the `verified-model-pack` issue. Merging a phase PR would commit gitignored deliverables to `main` and bypass the finalize handoff.

## Constraints

- Phase PRs share one branch — never create a new branch in PROPOSE or VERIFY.
- DETECT only runs from the default branch.
- Finalize only runs after `status: VERIFIED`.
- Never close PRs without first creating/updating the issue.

## Done when

The verified model pack is captured in a labelled GitHub issue, the corresponding phase PR(s) are closed and labelled, and no further phase is pending.
