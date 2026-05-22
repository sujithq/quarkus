# Agentic CodeQL pipeline

This repository ships a four-agent Copilot pipeline that detects SQL-injection patterns CodeQL misses, generates a candidate model pack, verifies it with executable CodeQL, and finalizes the result.

## Components

| Layer        | Location                                | Purpose                                                                 |
| ------------ | --------------------------------------- | ----------------------------------------------------------------------- |
| Custom agents | [.github/agents/](./agents/)            | Cloud Copilot agent profiles (`*.agent.md`).                            |
| Skills        | [.github/skills/](./skills/)            | Authoritative per-phase procedures (`SKILL.md`).                        |
| Prompt        | [.github/prompts/](./prompts/)          | Reusable slash-command (`codeql-run-pipeline.prompt.md`).               |
| Workflows     | [.github/workflows/](./workflows/)      | gh-aw CI mirrors of the same phases plus chain + finalize.              |
| Finalizer     | [.github/scripts/finalize-verified-model-pack.js](./scripts/finalize-verified-model-pack.js) | Idempotent issue + label + PR-close logic. |

## Agents

| Agent                | When to invoke                                                          |
| -------------------- | ----------------------------------------------------------------------- |
| `codeql-orchestrator`| Run the full pipeline (single-session) or coordinate phase-by-phase.    |
| `codeql-detector`    | DETECT phase only \u2014 writes `docs/codeql-gap-analysis.md`.          |
| `codeql-proposer`    | PROPOSE phase only \u2014 writes `.codeql/models/generated-sql-injection-sinks.yaml`. |
| `codeql-verifier`    | VERIFY phase only \u2014 runs `mvn` + `codeql` three-way comparison.    |

## One-prompt usage (recommended)

In VS Code Copilot Chat:

1. Open the chat-mode picker and select **codeql-orchestrator**.
2. Type `/codeql-run-pipeline` and press Enter.

The orchestrator loads each phase skill inline and runs DETECT \u2192 PROPOSE \u2192 VERIFY \u2192 Finalize in a single session. No agent switching required.

On GitHub.com:

1. Go to https://github.com/copilot/agents and pick the `codeql-orchestrator` agent.
2. Paste the body of [.github/prompts/codeql-run-pipeline.prompt.md](./prompts/codeql-run-pipeline.prompt.md).

With Copilot CLI:

```pwsh
gh copilot suggest --agent codeql-orchestrator "$(Get-Content .github/prompts/codeql-run-pipeline.prompt.md -Raw)"
```

## Phase-by-phase usage

Use this when you want a review gate between phases (e.g. inspect the gap analysis before generating the pack).

1. Invoke **codeql-detector** \u2192 writes `docs/codeql-gap-analysis.md` with `status: GAP_DETECTED`.
2. Invoke **codeql-proposer** \u2192 generates `.codeql/models/generated-sql-injection-sinks.yaml`, sets `status: MODEL_GENERATED`.
3. Invoke **codeql-verifier** \u2192 runs executable CodeQL, sets `status: VERIFIED`.
4. Invoke **codeql-orchestrator** with `Run the finalize step.` \u2192 calls the finalizer script.

Each agent reads the state-machine handoff lines (`status:` / `next:`) and refuses to run if the precondition is not met.

## CI usage

Three gh-aw workflows mirror the agents and are chained by [chain-agentic-phases.yml](./workflows/chain-agentic-phases.yml):

- `detect-codeql-gap.lock.yml`
- `propose-model-pack.lock.yml`
- `verify-model-pack.lock.yml`
- `finalize-verified-model-pack.yml` (creates the verified-model-pack issue and closes phase PRs)

Manually start the chain:

```pwsh
gh workflow run detect-codeql-gap.lock.yml --ref main
```

DETECT must run from the default branch. Subsequent phases run on the PR branch DETECT opens.

## State machine

```
                +-- GAP_DETECTED ---> PROPOSE
                |
no doc / NO_GAP +
                |
                +-- (nothing to do)

GAP_DETECTED      \u2192 codeql-propose  \u2192 MODEL_GENERATED
MODEL_GENERATED   \u2192 codeql-verify   \u2192 VERIFIED | VERIFICATION_BLOCKED | VERIFICATION_FAILED
VERIFIED          \u2192 finalize        \u2192 COMPLETE (issue + closed PRs)
VERIFICATION_BLOCKED  \u2192 fix tooling, re-verify
VERIFICATION_FAILED   \u2192 back to propose
```

## Generated files (gitignored)

These are produced by the pipeline and are not checked in to your working tree:

- `.codeql/models/generated-sql-injection-sinks.yaml`
- `docs/codeql-gap-analysis.md`
- `.aw-verify/` (verify scratchpad: CodeQL DB, SARIF, downloaded CLI bundle)
- `results/`, `*.sarif`

The CI phase PRs do commit the deliverables on their own branch; the finalize step captures them in a labelled GitHub issue, then closes the PRs.

## Customising

- To change a phase's procedure, edit the matching `SKILL.md` in [.github/skills/](./skills/). The agent prompt re-reads it on every run.
- To change the high-level agent role or tool boundaries, edit the corresponding `.agent.md` in [.github/agents/](./agents/).
- The workflow `.md` files in [.github/workflows/](./workflows/) are the canonical long-form prompts; skills cross-link to them.
