---
name: codeql-detect
description: Detect SQL-injection patterns in this repo that baseline CodeQL misses, and emit a structured Evidence Contract for the PROPOSE phase. Mirrors `.github/workflows/detect-codeql-gap.md`.
---

# Skill: codeql-detect

Canonical source: [.github/workflows/detect-codeql-gap.md](../../workflows/detect-codeql-gap.md). Keep prose changes there; this skill is the locally-runnable contract.

## When to use

When asked to detect CodeQL coverage gaps, model new sinks, or kick off the agentic SQL-injection pipeline.

## Inputs

- Java sources under `src/main/java/**`
- Existing reference pack `ql/src/quarkus-sinks.model.yml`
- Existing analysis doc `docs/codeql-gap-analysis.md` (if present)

## Procedure

1. **Identify input sources**: `@QueryParam`, `@PathParam`, controller params, HTTP request input.
2. **Identify unsafe query construction**: string concatenation into SQL/JPQL/HQL.
3. **Identify candidate sinks**:
   - JPA: `EntityManager.createQuery`, `EntityManager.createNativeQuery`
   - Hibernate: `Session.createQuery`, `Session.createNativeQuery`
   - Quarkus: `PanacheEntityBase.list`, `PanacheEntityBase.find`
   - Custom repository / DAO methods
4. **Detect flows**: source → concat → execution. Filter out parameterised queries (`?`, `:param`).
5. **Classify**: `missing-sink` | `missing-source` | `missing-flow`.
6. **Separate evidence**:
   - `observed_gaps` — exercised flows baseline CodeQL misses
   - `observed_model_inputs` — exercised flows that must seed the generated candidate pack (includes baseline-detected JPA/Hibernate rows AND missed framework rows)
   - `candidate_related_sinks` — related framework APIs not exercised here (`auto_model: false`)
7. **Write** `docs/codeql-gap-analysis.md` with the output format below.

## Output contract — `docs/codeql-gap-analysis.md`

If findings exist:

```markdown
# CodeQL Gap Analysis

status: GAP_DETECTED
next: PROPOSE_MODEL

## Finding 1
- Issue: Potential SQL injection
- Source: QueryParam
- Sink: PanacheEntityBase.list
- Gap Type: missing-sink
- Confidence: high

## Evidence Contract

```yaml
observed_gaps:
  - source_file: ...
    sink_file: ...
    sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: list
    sink_argument: Argument[0]
    gap_type: missing-sink
    evidence: repo-local-flow
    confidence: high

observed_model_inputs:
  - source_file: ...
    sink_file: ...
    sink_package: jakarta.persistence
    sink_type: EntityManager
    sink_method: createNativeQuery
    sink_argument: Argument[0]
    gap_type: baseline-detected
    evidence: repo-local-flow
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
```

If no findings:

```markdown
# CodeQL Gap Analysis

status: NO_GAP
next: STOP
```

## State handoff

Status/next lines MUST be plain text (no bold, no backticks). They are machine-read by the orchestrator.

## Constraints

- Do NOT generate model packs.
- Do NOT modify CodeQL configuration.
- Avoid false positives.
- Run only from the default branch when emitting a phase PR; otherwise stop with a noop note.

## Done when

`docs/codeql-gap-analysis.md` exists with `status: GAP_DETECTED` (or `NO_GAP`), the Evidence Contract block, and both `observed_model_inputs` and `candidate_related_sinks` populated.
