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

---

# PROPOSE CodeQL Model Pack (SQL Injection)

Generate a CodeQL model pack based on detected coverage gaps.

## Instructions

When this workflow is manually run:

---

### 1. Read input file

Read:

docs/codeql-gap-analysis.md

---

### 2. Validate precondition

Check top of file:

- If status != GAP_DETECTED
  → STOP

- If status == GAP_DETECTED
  → continue

---

### 3. Extract findings

For EACH finding:

Extract:

- Source
- Sink
- Gap Type
- Confidence

---

### 4. Filter findings

ONLY process findings where:

- Gap Type == missing-sink

IGNORE:

- missing-source
- missing-flow

---

### 5. Classify sinks

Classify each Sink into one of:

- jpa
  - examples: createQuery, createNativeQuery

- framework
  - examples: PanacheEntityBase.list, Hibernate

- wrapper
  - repository or DAO abstractions

- custom
  - unknown execution methods

---

### 6. Filter sinks for modelling

DO NOT generate model entries for:

- jpa sinks (already covered by CodeQL)
- duplicate sinks

ONLY keep:

- framework
- wrapper
- custom

---

### 7. Transform sinks into CodeQL entries

For each remaining sink create:

["<Class>", "<method>", "Argument[0]", "sql-injection"]

---

### 8. Aggregate entries

Combine ALL entries into ONE YAML file.

---

### 9. Create output file in a pull request

Create a pull request that adds exactly one new file:

.codeql/models/generated-sql-injection-sinks.yaml

---

### 10. YAML format (STRICT)

extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["io.quarkus.hibernate.orm.panache.PanacheEntityBase", "list", "Argument[0]", "sql-injection"]
      - ["com.example.repo.CustomRepository", "executeQuery", "Argument[0]", "sql-injection"]

---

### 11. Update analysis file in the same pull request

Append to:

docs/codeql-gap-analysis.md

---

### 12. Append content (STRICT)

## Model Pack Proposal

Generated sinks:

- <Class.method> (framework / wrapper / custom)

status: MODEL_GENERATED
next: VERIFY

---

## Constraints

- Do NOT modify existing CodeQL queries
- Do NOT generalise to entire classes
- Do NOT generate duplicate entries
- Keep models minimal and precise
- Prefer missing a sink over false positives

---

## Success Criteria

- Pull request includes created file:
  .codeql/models/generated-sql-injection-sinks.yaml

- Multiple findings supported

- Correct filtering:
  - JPA excluded ✅

- Pull request updates analysis file with:
  - status: MODEL_GENERATED
  - next: VERIFY