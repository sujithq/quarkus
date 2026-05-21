---
on:
  workflow_dispatch:

permissions:
  contents: read

engine: copilot
network: defaults

safe-outputs:
  update-file:
    max: 3

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

For EACH finding:

- Extract:
  - Sink (Class.method)
  - Gap Type
  - Confidence

Only process:

- Gap Type == missing-sink

---

### 5. Classify sinks (for reporting)

Classify each sink:

- jpa → createQuery, createNativeQuery (skip modelling)
- framework → Panache, Hibernate, etc.
- wrapper → repository / DAO abstraction
- custom → unknown execution method

---

### 6. Transform sinks into CodeQL entries

For each valid sink, generate:

["<Class>", "<method>", "Argument[0]", "sql-injection"]

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
  Class + Method + Argument + Kind

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

- <Class.method> (<classification>)

### Skipped entries

- <Class.method> (jpa / duplicate / already modelled)

status: MODEL_GENERATED
next: VERIFY

---

### 11. Submit changes

- If changes were made:
  - commit changes to current branch
  - do NOT create a new pull request
  - update the existing pull request

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
      - ["io.quarkus.hibernate.orm.panache.PanacheEntityBase", "list", "Argument[0]", "sql-injection"]
      - ["com.example.repo.CustomRepository", "executeQuery", "Argument[0]", "sql-injection"]

---

## Constraints

- Do NOT modify CodeQL queries
- Do NOT remove existing model entries
- Do NOT generalise beyond method level
- Avoid false positives

---

## Success Criteria

- Model file exists:
  .codeql/models/generated-sql-injection-sinks.yaml

- If file existed:
  - entries were merged (no overwrite)

- docs/codeql-gap-analysis.md updated with:
  - status: MODEL_GENERATED
  - next: VERIFY