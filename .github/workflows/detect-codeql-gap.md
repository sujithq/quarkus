---
on:
   push:
      branches:
         - main
      paths:
         - src/**
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
         - docs/codeql-gap-analysis.md

---

# DETECT CodeQL Coverage Gaps (SQL Injection)

Analyse the repository to detect SQL injection patterns that are NOT detected by CodeQL.

## Instructions

When this workflow is manually run or triggered by source changes:

0. Validate the run context:
   - DETECT must create gap-analysis pull requests from the repository default branch only.
   - If this workflow is running from any non-default branch or from a branch that already contains phase output such as docs/codeql-gap-analysis.md, do not create a pull request.
   - In that case, use noop and explain that DETECT must be rerun from `main` after workflow changes are merged.
   - This avoids generating a safe-output bundle from a feature branch while targeting `main`, which can make the PR bundle impossible to apply.

1. Identify input sources:
   - @QueryParam
   - @PathParam
   - controller parameters
   - HTTP request input

2. Identify unsafe query construction:
   - string concatenation used to build SQL/JPQL/HQL queries

3. Identify execution methods (candidate sinks):
   - JPA: createQuery, createNativeQuery
   - Hibernate: session.createQuery
   - Frameworks: PanacheEntityBase.list, find
   - Custom repositories / DAO methods

4. Detect flows:
   - input -> concat -> execution

5. Filter out safe cases:
   - parameterised queries (?, :param)

6. Classify findings:
   - missing-sink
   - missing-source
   - missing-flow

7. Separate evidence types:
   - observed_gaps: concrete source -> concat -> execution flows present in this repository that CodeQL misses
   - candidate_related_sinks: related framework APIs inferred from the observed API family but not directly exercised by this repository

8. Treat observed_gaps as the only default input for automatic model generation. Candidate related sinks are useful context, but must be labelled as candidates unless the repository contains an exercised vulnerable flow for them.

9. Create exactly one pull request that adds this file:

   docs/codeql-gap-analysis.md

---

# Output Format

If findings exist:

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
   - source_file: src/main/java/com/example/DoctypeShareFolderMappingResource.java
      sink_file: src/main/java/com/example/DoctypeShareFolderMapping.java
      sink_package: io.quarkus.hibernate.orm.panache
      sink_type: PanacheEntityBase
      sink_method: list
      sink_argument: Argument[0]
      gap_type: missing-sink
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

Only include entries under observed_gaps when this repository contains the exercised flow. Put related APIs that are not exercised locally under candidate_related_sinks with auto_model: false.

Keep the state handoff lines plain and machine-readable. Do not wrap them in bold, backticks, or prose:

status: GAP_DETECTED
next: PROPOSE_MODEL


If no findings:

# CodeQL Gap Analysis

status: NO_GAP
next: STOP

---

## Constraints

- Do NOT generate model packs
- Do NOT modify CodeQL configuration
- Avoid false positives

---

## Success Criteria

- Pull request is created with: docs/codeql-gap-analysis.md
- File contains status and next fields
- File contains an Evidence Contract with observed_gaps and candidate_related_sinks
- Ready for PROPOSE workflow