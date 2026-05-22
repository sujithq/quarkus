# Plan: Hardening the Agentic CodeQL Modeling Workflow

This file is the handoff plan for continuing after the completed end-to-end validation run. The current Quarkus/Panache proof works, but the workflow is not yet generic enough to apply safely to arbitrary repositories without stronger evidence contracts and a more reliable phase handoff.

## Current Status

Fresh end-to-end run:

1. DETECT run `26268822961` completed successfully on `main` at `e4f9c24b674217dfc9b7e8ac9444aa98450581b8`.
2. DETECT created PR #19: `https://github.com/sujithq/quarkus/pull/19`.
3. PR #19 branch: `codeql-gap-analysis-c86a7f161e4edf33`.
4. Chain run `26269319662` completed successfully and dispatched PROPOSE on the actual PR #19 branch.
5. PROPOSE run `26269322990` completed successfully.
6. PROPOSE created PR #20: `https://github.com/sujithq/quarkus/pull/20`.
7. PR #20 branch: `codeql-gap-analysis-c86a7f161e4edf33-1e4114579d42adf6`.
8. VERIFY did not start automatically after PROPOSE, so VERIFY was manually dispatched.
9. Manual VERIFY run `26270112644` completed successfully.
10. VERIFY safe output reported `Status: VERIFIED` and `Next: COMPLETE`.

## Live Hardening Validation

Started a new DETECT run after committing and pushing the hardening changes:

1. DETECT run `26271228688`: `https://github.com/sujithq/quarkus/actions/runs/26271228688`.
2. Branch: `codeql-gap-analysis-sql-injection-b678a9e055405cd6-52f39dd9e74aca6a`.
3. Commit: `d9a6b637caff132c3e4e788a8de0613344cbe823`.
4. Final status: `failure`.
5. Agent job status: `success`; the agent produced a `create_pull_request` safe output for branch prefix `codeql-gap-analysis-sqli`.
6. Safe output job status: `failure`.
7. Blocker: safe-output bundle application failed. The handler tried to fetch `refs/heads/codeql-gap-analysis-sqli` from the generated bundle, but `git bundle list-heads` only exposed `HEAD`, not a `refs/heads/*` ref.
8. Observed error: `Failed to resolve bundle branch ref from list-heads: expected exactly 1 refs/heads entry, found 0`.
9. Result: no new gap-analysis PR was created, so PROPOSE and VERIFY were not reached in this run.
10. Purpose: validate the hardened DETECT evidence contract and observe whether the end-to-end chain reaches PROPOSE and VERIFY automatically.

Note: GitHub `workflow_run` and scheduled workflow behavior is normally evaluated from the default branch workflow definitions. If this branch run does not exercise the updated chainer, merge or fast-forward the hardening workflow changes to `main`, then repeat the DETECT run from `main` for the representative end-to-end test.

## Verified Evidence

VERIFY run `26270112644` confirmed executable CodeQL validation:

1. Baseline without model pack: 1 result.
2. Reference model pack from `ql/src/quarkus-sinks.model.yml`: 2 results.
3. Generated model pack from `.codeql/models/generated-sql-injection-sinks.yaml`: 2 results.
4. Baseline detected the JPA control case at `DoctypeShareFolderMapping.java:35`.
5. Generated model detected the Panache vulnerability at `DoctypeShareFolderMapping.java:55:29`.
6. Generated model matched the reference behavior for the demonstrated gap.

The generated model in PR #20 uses the correct Java CodeQL `sinkModel` row shape:

```yaml
["io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true, "list", "", "", "Argument[0]", "sql-injection", "manual"]
["io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true, "find", "", "", "Argument[0]", "sql-injection", "manual"]
```

## Key Finding

The workflow skeleton is reusable:

```text
DETECT -> PROPOSE -> VERIFY
```

But the current DETECT/PROPOSE logic is not generic enough for arbitrary repositories without guardrails. The agent can vary between conservative observed-gap modeling and broader framework-family expansion.

In this repository:

1. The observed missed vulnerable flow is `PanacheEntityBase.list(query)`.
2. `PanacheEntityBase.find(...)` is a reasonable sibling model because it is in the known-good reference pack, but it is not directly exercised by the current vulnerable sample.
3. Earlier runs proposed broader speculative entries such as `update`, `delete`, and `PanacheRepository` variants.
4. VERIFY can prove only what the repository demonstrates. It cannot prove unexercised sibling API models unless test/demo flows exist for them.

## Remaining Automation Gap

Automatic chaining currently has one remaining gap:

1. DETECT -> PROPOSE works.
2. PROPOSE -> VERIFY did not happen automatically in the fresh run.
3. PROPOSE safe output requested `create_pull_request` from branch `codeql-gap-analysis-c86a7f161e4edf33`.
4. GitHub created PR #20 on a suffixed branch: `codeql-gap-analysis-c86a7f161e4edf33-1e4114579d42adf6`.
5. No post-PROPOSE `workflow_run` chainer appeared.
6. No `pull_request` fallback chainer appeared for PR #20.
7. VERIFY had to be dispatched manually on PR #20's actual branch.

Hypothesis: GitHub did not emit the expected follow-up workflow trigger from the PROPOSE safe-output PR creation because the PR was created by workflow automation, or because the workflow/token path suppressed recursive triggers.

## Next Work Item 1: Fix PROPOSE -> VERIFY Chaining

Goal: make VERIFY start automatically after PROPOSE creates the model-pack PR.

Suggested investigation steps:

1. Inspect `chain-agentic-phases.yml` behavior for workflow_run events from PROPOSE.
2. Confirm whether GitHub emits `workflow_run` for `PROPOSE CodeQL Model Pack (SQL Injection) - MERGE MODE` when PROPOSE was itself dispatched by another workflow.
3. Confirm whether `pull_request` events fire for PRs created by gh-aw safe outputs with the token currently used by safe-output processing.
4. Check whether `GH_AW_CI_TRIGGER_TOKEN` is present and used everywhere needed.
5. If recursive trigger suppression is unavoidable, add an explicit post-PROPOSE dispatch mechanism that does not depend on a GitHub-generated PR event.

Potential implementation paths:

1. Preferred: make the existing `workflow_run` chainer reliably handle completed PROPOSE runs, download the PROPOSE `agent` artifact, resolve the actual PR branch #20, and dispatch VERIFY.
2. Alternative: add a scheduled or manually callable reconciliation workflow that scans open PRs for `status: MODEL_GENERATED` and `next: VERIFY`, then dispatches VERIFY.
3. Alternative: add a lightweight workflow_dispatch helper that takes a PR number, resolves the branch, and dispatches VERIFY.

Acceptance criteria:

1. Start DETECT from `main`.
2. DETECT creates a gap-analysis PR.
3. Chain dispatches PROPOSE on the actual PR branch.
4. PROPOSE creates or updates a model-pack PR/branch.
5. Chain dispatches VERIFY on the actual model-pack branch without manual intervention.
6. VERIFY completes with `Status: VERIFIED` and `Next: COMPLETE`.

## Next Work Item 2: Make DETECT Generic Enough

Goal: separate deterministic observed evidence from agent-inferred framework expansion.

Current issue:

1. DETECT is agentic and naturally nondeterministic.
2. It may report only the exact missed sink observed in the sample.
3. It may also infer related framework sinks.
4. On a new repository, that can blur observed gaps with speculative candidate models.

Proposed DETECT contract:

```yaml
observed_gaps:
  - source_file: src/main/java/...
    source_line: 27
    sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: list
    sink_argument: Argument[0]
    baseline_detected: false
    evidence: sarif-diff | manual-code-path | query-result
    confidence: high

candidate_related_sinks:
  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: find
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
```

Policy recommendation:

1. PROPOSE should auto-model `observed_gaps` by default.
2. PROPOSE should list `candidate_related_sinks` separately unless an explicit expansion policy is enabled.
3. VERIFY should clearly state which generated rows are proven by repo-local flows and which are unexercised candidate models.

Acceptance criteria:

1. DETECT output distinguishes observed missed flows from related candidates.
2. PROPOSE does not silently broaden scope without labeling the evidence level.
3. VERIFY reports proof status per generated row where possible.
4. A new repo can run the workflow without relying on Quarkus-specific hidden assumptions.

## Next Work Item 3: Strengthen VERIFY as the Guardrail

Goal: make VERIFY the deterministic acceptance gate for generated models.

Enhancements:

1. Emit a compact machine-readable summary in `docs/codeql-gap-analysis.md` or a dedicated artifact.
2. Include baseline/reference/generated counts.
3. Include detected locations and rule IDs.
4. Include a row-level coverage matrix for generated model entries.

Example summary:

```yaml
verify_result:
  status: VERIFIED
  baseline_count: 1
  reference_count: 2
  generated_count: 2
  generated_matches_reference: true
  proven_generated_rows:
    - PanacheEntityBase.list Argument[0]
  unproven_generated_rows:
    - PanacheEntityBase.find Argument[0]
```

Acceptance criteria:

1. A green VERIFY run always includes executable evidence.
2. A green workflow cannot hide missing CodeQL execution.
3. The user can tell whether a generated row was observed in this repository or only included as a related candidate.

## Known Good Commands

Useful commands from this investigation:

```powershell
gh run view 26270112644 --repo sujithq/quarkus --json status,conclusion,url,jobs
gh api repos/sujithq/quarkus/actions/runs/26270112644/artifacts --jq '.artifacts[] | {name,expired,size_in_bytes,created_at}'
gh run download 26270112644 --repo sujithq/quarkus --name agent --dir $env:TEMP\verify-26270112644-agent
gh pr view 20 --repo sujithq/quarkus --json number,title,state,isDraft,headRefName,headRefOid,url,files,commits
```

Local CodeQL proof commands:

```powershell
mvn clean package
codeql database create db-quarkus --overwrite --language=java --command="mvn clean package"
codeql database analyze db-quarkus codeql/java-queries --rerun --format=sarif-latest --output=results/baseline.sarif
codeql database analyze db-quarkus codeql/java-queries --model-packs=local/quarkus-models --additional-packs=. --rerun --format=sarif-latest --output=results/modeled.sarif
```

## Files To Revisit

1. `.github/workflows/chain-agentic-phases.yml` - fix PROPOSE -> VERIFY handoff.
2. `.github/workflows/detect-codeql-gap.md` - make observed-vs-candidate evidence explicit.
3. `.github/workflows/propose-model-pack.md` - only auto-model observed gaps unless expansion is enabled.
4. `.github/workflows/verify-model-pack.md` - emit row-level proof summary.
5. `ql/src/quarkus-sinks.model.yml` - keep as reference model for the current Quarkus proof.
6. `.codeql/models/generated-sql-injection-sinks.yaml` on PR #20 - current generated model that passed VERIFY.
7. `docs/codeql-gap-analysis.md` on PR #20 - current phase state and verification context.

## Recommended Resume Order

1. Start with the PROPOSE -> VERIFY chaining bug.
2. Re-run a fresh DETECT after the chaining fix and confirm full automation reaches VERIFY.
3. Then harden the DETECT output contract.
4. Then harden PROPOSE scope policy.
5. Then improve VERIFY row-level evidence.

## Final Known State

The current proof is valid for this repository:

1. Generated model file passes executable CodeQL verification.
2. VERIFY run `26270112644` completed successfully.
3. The remaining work is productizing the workflow, not fixing the Quarkus model proof itself.
