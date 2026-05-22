---
name: codeql-propose
description: Generate or merge `.codeql/models/generated-sql-injection-sinks.yaml` from the Evidence Contract produced by the detect skill. Mirrors `.github/workflows/propose-model-pack.md`.
---

# Skill: codeql-propose

Canonical source: [.github/workflows/propose-model-pack.md](../../workflows/propose-model-pack.md).

## When to use

After codeql-detect has written `docs/codeql-gap-analysis.md` with `status: GAP_DETECTED` and `next: PROPOSE_MODEL`.

## Precondition

Continue only if `docs/codeql-gap-analysis.md` contains `status: GAP_DETECTED`. Otherwise STOP.

## Procedure

1. **Read** `docs/codeql-gap-analysis.md`. Prefer the `Evidence Contract` YAML block.
2. **Source rows** from `observed_model_inputs` (preferred). If absent, fall back to `observed_gaps` AND recover baseline-detected control rows by inspecting `src/main/java/com/example/DoctypeShareFolderMapping.java`.
3. **Expected exercised rows** in this repository:
   - `jakarta.persistence.EntityManager.createNativeQuery Argument[0]`
   - `jakarta.persistence.EntityManager.createQuery Argument[0]`
   - `org.hibernate.Session.createQuery Argument[0]`
   - `org.hibernate.Session.createNativeQuery Argument[0]`
   - `io.quarkus.hibernate.orm.panache.PanacheEntityBase.list Argument[0]`
   - `io.quarkus.hibernate.orm.panache.PanacheEntityBase.find Argument[0]`
4. **Filter** to rows with `gap_type ∈ {missing-sink, baseline-detected, repo-local-control, omitted}`, `evidence ∈ {repo-local-flow, sarif-diff, query-result, manual-code-path}`, and `confidence ∈ {high, medium}`. Never auto-model `candidate_related_sinks`.
5. **Transform** each row to a `sinkModel` entry:
   ```
   ["<package>", "<type>", <subtypes>, "<method>", "", "", "<argument>", "sql-injection", "manual"]
   ```
   - `subtypes = false` for `jakarta.persistence.EntityManager` and `org.hibernate.Session`.
   - `subtypes = true` for Panache base classes (`PanacheEntityBase`, etc.).
   - `argument` defaults to `Argument[0]` when not supplied.
6. **Merge into** `.codeql/models/generated-sql-injection-sinks.yaml`:
   - If file missing → create with all rows.
   - If file exists → read `extensions[0].data`, dedupe on `Package+Type+Method+Argument+Kind`, append new rows, preserve unrelated YAML and comments.
7. **Append to** `docs/codeql-gap-analysis.md`:

```markdown
## Model Pack Proposal

- Model file: .codeql/models/generated-sql-injection-sinks.yaml
- Merge mode: enabled (existing entries preserved)

### Added entries
- <Package.Type.method> (<classification>, observed)

### Skipped entries
- <Package.Type.method> (duplicate / already modelled / candidate-only / evidence-contract-missing)

### Candidate related sinks
- <Package.Type.method> (not auto-modelled; evidence: <evidence>; confidence: <confidence>)

status: MODEL_GENERATED
next: VERIFY
```

## YAML structure (reference)

```yaml
extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true, "list", "", "", "Argument[0]", "sql-injection", "manual"]
```

## Branch behaviour

Work on the existing branch created by codeql-detect. Do NOT create a new branch or PR — update the existing one.

## Constraints

- Do NOT modify CodeQL queries.
- Do NOT remove existing model entries.
- Do NOT generalise beyond method level.
- Do NOT silently model rows from `candidate_related_sinks`.

## Done when

`.codeql/models/generated-sql-injection-sinks.yaml` contains all justified rows AND `docs/codeql-gap-analysis.md` ends with `status: MODEL_GENERATED` / `next: VERIFY`.
