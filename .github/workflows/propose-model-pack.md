---
on:
  workflow_dispatch:

permissions:
  contents: read

engine: copilot
network: defaults

safe-outputs:
  create-pull-request:
    max: 1
    protected-files: allowed
    allowed-files:
      - .codeql/models/generated-sql-injection-sinks.yaml
      - docs/codeql-gap-analysis.md

---

# PROPOSE CodeQL Model Pack (SQL Injection) — MERGE MODE

Generate or update a CodeQL model pack based on detected coverage gaps, WITHOUT overwriting existing entries.

---

## Instructions

When this workflow is manually run:

---

### 1. Read input file

- docs/codeql-gap-analysis.md

---

### 2. Validate precondition

- Continue ONLY if:
  status: GAP_DETECTED

- Otherwise:
  STOP

---

### 3. Branch behaviour (CRITICAL)

- Work on the existing branch created by the DETECT workflow
- Do NOT create a new branch
- Do NOT create a new pull request
- Commit all changes to the current branch
- This workflow MUST update the existing pull request

---

### 4. Extract findings

Prefer the `Evidence Contract` YAML block in docs/codeql-gap-analysis.md.

For EACH entry in `observed_model_inputs` when present. If `observed_model_inputs` is absent, use `observed_gaps` as a backwards-compatible fallback and also inspect the repository's exercised unsafe query methods to recover baseline-detected control sinks.

Extract:

- sink_package
- sink_type
- sink_method
- sink_argument
- gap_type
- confidence

The generated model pack is a complete repo-local candidate pack, not only a gap patch. It should include all exercised unsafe query sink rows that the workflow can justify locally, including baseline-detected JPA/Hibernate control sinks and missed framework sinks.

Expected exercised sink rows in this repository are:

- `jakarta.persistence.EntityManager.createNativeQuery Argument[0]`
- `jakarta.persistence.EntityManager.createQuery Argument[0]`
- `org.hibernate.Session.createQuery Argument[0]`
- `org.hibernate.Session.createNativeQuery Argument[0]`
- `io.quarkus.hibernate.orm.panache.PanacheEntityBase.list Argument[0]`
- `io.quarkus.hibernate.orm.panache.PanacheEntityBase.find Argument[0]`

For backwards-compatible `observed_gaps` fallback entries:

- Still include valid gap rows.
- Add the repo-local baseline-detected control rows above when the corresponding unsafe methods exist in `src/main/java/com/example/DoctypeShareFolderMapping.java`.

Only process:

- gap_type is missing-sink, baseline-detected, repo-local-control, or omitted
- evidence is repo-local-flow, sarif-diff, query-result, or manual-code-path
- confidence is high or medium

Do NOT auto-model entries from `candidate_related_sinks` unless they also appear under `observed_gaps`.

If the input file only contains the legacy `## Finding` format, process those findings as a backwards-compatible fallback, but record that the evidence contract was missing.

---

### 5. Classify sinks (for reporting)

Classify each sink:

- jpa → createQuery, createNativeQuery
- framework → Panache, Hibernate, etc.
- wrapper → repository / DAO abstraction
- custom → unknown execution method

---

### 6. Transform sinks into CodeQL entries

For each valid observed sink, generate a Java `sinkModel` row using the same schema as `ql/src/quarkus-sinks.model.yml`:

["<package>", "<type>", true, "<method>", "", "", "Argument[0]", "sql-injection", "manual"]

Rules:

- Use `sink_package` and `sink_type` from the evidence contract when present.
- For legacy findings, split the fully qualified class name into package and type.
- Use `true` for subtypes when modelling framework base classes or interfaces such as Panache types.
- Use the evidence contract's `sink_argument` when present; otherwise default to `Argument[0]`.
- Use empty strings for signature and extension unless a more specific signature is required.
- Use `manual` for provenance.
- Use `false` for subtype matching on concrete JPA/Hibernate API types such as `EntityManager` and `Session`.
- Use `true` for subtype matching on framework base classes or interfaces such as Panache types.

Example:

["io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true, "list", "", "", "Argument[0]", "sql-injection", "manual"]

---

### 7. MERGE LOGIC (CRITICAL)

Target file:

.codeql/models/generated-sql-injection-sinks.yaml

---

#### Case 1 — File does NOT exist

- Create file
- Add all generated entries

---

#### Case 2 — File EXISTS

- Read existing entries under:
  extensions[0].data

- Merge new entries into existing list

- Deduplicate using key:
  Package + Type + Method + Argument + Kind

- Do NOT remove existing entries

- Do NOT modify unrelated YAML structure

- Preserve format and comments where possible

---

### 8. Write result

- If file did not exist → create file
- If file exists → update only the data section

---

### 9. Update analysis file

Append to:

docs/codeql-gap-analysis.md

---

### 10. Append content (STRICT)

## Model Pack Proposal

- Model file: .codeql/models/generated-sql-injection-sinks.yaml
- Merge mode: enabled (existing entries preserved)

### Added entries

- <Package.Type.method> (<classification>, observed)

### Skipped entries

- <Package.Type.method> (jpa / duplicate / already modelled / candidate-only / evidence-contract-missing)

### Candidate related sinks

- <Package.Type.method> (not auto-modelled; evidence: <evidence>; confidence: <confidence>)

status: MODEL_GENERATED
next: VERIFY

---

### 11. Submit changes

- If changes were made:
  - use the create-pull-request safe output
  - include all changes needed for verification
  - do NOT use noop after creating or updating files

- Use noop ONLY when:
  - precondition not met
  - OR no missing-sink findings exist

---

## YAML structure (reference)

extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true, "list", "", "", "Argument[0]", "sql-injection", "manual"]
      - ["com.example.repo", "CustomRepository", true, "executeQuery", "", "", "Argument[0]", "sql-injection", "manual"]

---

## Constraints

- Do NOT modify CodeQL queries
- Do NOT remove existing model entries
- Do NOT generalise beyond method level
- Do NOT silently model candidate_related_sinks that are not observed in this repository
- Avoid false positives

---

## Success Criteria

- Model file exists:
  .codeql/models/generated-sql-injection-sinks.yaml

- Model file contains all exercised candidate rows justified by repo-local unsafe flows, including baseline-detected control rows and missed framework rows

- If file existed:
  - entries were merged (no overwrite)

- docs/codeql-gap-analysis.md updated with:
  - status: MODEL_GENERATED
  - next: VERIFY