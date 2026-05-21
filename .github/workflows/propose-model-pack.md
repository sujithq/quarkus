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

## Instructions

When this workflow is manually run:

1. Read input file:
   - docs/codeql-gap-analysis.md

2. Validate precondition:
   - Continue ONLY if the file contains: status: GAP_DETECTED
   - Otherwise STOP.

3. Extract findings from docs/codeql-gap-analysis.md:
   - For each Finding, extract:
     - Sink (Class.method)
     - Gap Type
   - Only process findings where Gap Type == missing-sink

4. Classify each sink (for reporting only):
   - jpa: createQuery, createNativeQuery, etc. (skip modelling)
   - framework: Panache/Hibernate helper methods
   - wrapper: repository/DAO abstraction around ORM
   - custom: unknown query execution method

5. Transform each sink into a CodeQL sinkModel entry:
   - Default to Argument[0] unless there is strong evidence otherwise.
   - Entry format:
     ["<Class>", "<method>", "Argument[0]", "sql-injection"]

6. MERGE LOGIC (CRITICAL):

   Target model file:
   - .codeql/models/generated-sql-injection-sinks.yaml

   If the model file DOES NOT exist:
   - Create it with the standard YAML structure and all new entries.

   If the model file DOES exist:
   - Read existing entries under: extensions[0].data
   - Merge new entries into the existing data list
   - Deduplicate using the key:
     Class + Method + Argument + Kind
   - Do NOT delete existing entries
   - Do NOT rewrite unrelated YAML sections
   - Preserve comments/formatting as much as possible (only update the data list)

7. Write result:
   - If created: create .codeql/models/generated-sql-injection-sinks.yaml
   - If updated: update .codeql/models/generated-sql-injection-sinks.yaml

8. Update docs/codeql-gap-analysis.md (append only):

   Append:

   ## Model Pack Proposal
   - Model file: .codeql/models/generated-sql-injection-sinks.yaml
   - Merge mode: enabled (existing entries preserved)
   - Added entries:
     - <Class.method> (<classification>)
   - Skipped entries:
     - <Class.method> (jpa / already-modelled / duplicate)

   status: MODEL_GENERATED
   next: VERIFY

9. Submit the changes:
  - If you created or updated any file, you MUST use the create-pull-request safe output.
  - The pull request MUST include all file changes needed for verification.
  - Do NOT use noop after creating or updating files in the workspace.
  - Use noop ONLY when the precondition is not met or when there are no missing-sink findings to model.

## YAML structure (reference)

extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["io.quarkus.hibernate.orm.panache.PanacheEntityBase", "list", "Argument[0]", "sql-injection"]
      - ["com.example.repo.CustomRepository", "executeQuery", "Argument[0]", "sql-injection"]

## Constraints

- Do NOT modify CodeQL queries
- Do NOT remove existing model entries
- Avoid over-generalisation (method-level only)
- Prefer missing an entry over creating false positives

## Success Criteria

- A model file exists at:
  - .codeql/models/generated-sql-injection-sinks.yaml
- If file pre-existed, it was updated by merging (no loss of entries)
- docs/codeql-gap-analysis.md updated with:
  - status: MODEL_GENERATED
  - next: VERIFY
