---
on:
  workflow_dispatch:

permissions:
  contents: read

engine: copilot
network: defaults

safe-outputs:
  update-file:
    max: 2

---

# VERIFY CodeQL Model Pack (SQL Injection)

Validate that the generated CodeQL model pack improves SQL injection detection.

---

## Instructions

When this workflow is manually run:

---

### 1. Read input file

- docs/codeql-gap-analysis.md

---

### 2. Validate precondition

- Continue ONLY if:
  status: MODEL_GENERATED

- Otherwise:
  STOP

---

### 3. Branch behaviour (CRITICAL)

- Work on the existing branch created by DETECT
- Continue on the same pull request
- Do NOT create a new branch
- Do NOT create a new pull request
- All updates must be committed to the current branch

---

### 4. Identify target model file

Check:

.codeql/models/generated-sql-injection-sinks.yaml

If NOT present:
- STOP (nothing to verify)

---

### 5. Perform validation (logical verification)

Simulate validation based on detection context:

- Identify findings from:
  docs/codeql-gap-analysis.md

For each finding:

- Verify that:
  - a corresponding sink exists in the model file
  - the sink matches class + method

---

### 6. Determine outcome

Define:

- BEFORE:
  - SQL injection NOT detected (gap exists)

- AFTER:
  - SQL injection SHOULD be detectable with model

---

### 7. Classify validation confidence

- high:
  - clear match between finding and generated sink

- medium:
  - partial or indirect mapping

- low:
  - uncertainty in sink mapping

---

### 8. Update analysis file

Append to:

docs/codeql-gap-analysis.md

---

### 9. Append content (STRICT)

## Validation Results

### Summary

- Model file applied: ✅
- Findings matched to sinks: ✅

### Before Model Pack

- SQL injection not detected

### After Model Pack

- SQL injection expected to be detected via:
  - <Class.method>

### Validation Confidence

- <high | medium | low>

status: VERIFIED
next: COMPLETE

---

### 10. Submit changes

- If validation results were added:
  - commit changes to current branch
  - update existing pull request
  - do NOT create a new pull request

- Use noop ONLY when:
  - precondition not met
  - OR no model file exists

---

## Constraints

- Do NOT execute real CodeQL scans (logical validation only)
- Do NOT modify model files
- Do NOT introduce new sinks
- Only validate what was generated

---

## Success Criteria

- docs/codeql-gap-analysis.md updated with:
  - Validation Results section
  - status: VERIFIED
  - next: COMPLETE

- No new PR created
- Existing PR updated with final validation