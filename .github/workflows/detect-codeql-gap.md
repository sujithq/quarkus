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

# DETECT CodeQL Coverage Gaps (SQL Injection)

Analyse the repository to detect SQL injection patterns that are NOT detected by CodeQL.

## Instructions

When this workflow is manually run:

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

7. Create exactly one pull request that adds this file:

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
- Ready for PROPOSE workflow