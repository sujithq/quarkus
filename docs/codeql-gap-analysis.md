# CodeQL Gap Analysis

status: GAP_DETECTED
next: PROPOSE_MODEL

## Overview

This analysis identifies SQL injection patterns in the Quarkus repository that are NOT detected by baseline CodeQL. The repository contains multiple vulnerable flows using both standard JPA/Hibernate APIs and Quarkus-specific Panache APIs.

**Baseline CodeQL Detection:** 4 findings (standard JPA/Hibernate sinks only)
**Missing Detection:** 2 Panache-specific SQL injection flows

## Finding 1: Panache list() Method

- **Issue:** Potential SQL injection via Quarkus Panache list() method
- **Source:** `@QueryParam("doctype")` in DoctypeShareFolderMappingResource.java
- **Flow:** User input → string concatenation → PanacheEntityBase.list()
- **Sink:** `io.quarkus.hibernate.orm.panache.PanacheEntityBase.list(String query)`
- **Gap Type:** missing-sink
- **Confidence:** high

**Vulnerable Code:**
```java
// Source: User-controlled query parameter
@GET
@Path("/panache-unsafe")
public List<DoctypeShareFolderMapping> findPanacheUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypePanacheUnsafe(doctype);
}

// Sink: Concatenated query passed to list()
public static List<DoctypeShareFolderMapping> findByDoctypePanacheUnsafe(String doctype) {
    String query = "doctypeId = '" + doctype + "'";
    return list(query);  // Line 131
}
```

**Location:** 
- Source: `src/main/java/com/example/DoctypeShareFolderMappingResource.java:63`
- Sink: `src/main/java/com/example/DoctypeShareFolderMapping.java:131`

## Finding 2: Panache find() Method

- **Issue:** Potential SQL injection via Quarkus Panache find() method
- **Source:** `@QueryParam("doctype")` in DoctypeShareFolderMappingResource.java
- **Flow:** User input → string concatenation → PanacheEntityBase.find()
- **Sink:** `io.quarkus.hibernate.orm.panache.PanacheEntityBase.find(String query)`
- **Gap Type:** missing-sink
- **Confidence:** high

**Vulnerable Code:**
```java
// Source: User-controlled query parameter
@GET
@Path("/panache-find-unsafe")
public List<DoctypeShareFolderMapping> findPanacheFindUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypePanacheFindUnsafe(doctype);
}

// Sink: Concatenated query passed to find()
public static List<DoctypeShareFolderMapping> findByDoctypePanacheFindUnsafe(String doctype) {
    String query = "doctypeId = '" + doctype + "'";
    return find(query).list();  // Line 137
}
```

**Location:**
- Source: `src/main/java/com/example/DoctypeShareFolderMappingResource.java:69`
- Sink: `src/main/java/com/example/DoctypeShareFolderMapping.java:137`

## Evidence Contract

```yaml
observed_gaps:
  - source_file: src/main/java/com/example/DoctypeShareFolderMappingResource.java
    source_line: 63
    source_param: doctype
    sink_file: src/main/java/com/example/DoctypeShareFolderMapping.java
    sink_line: 131
    sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: list
    sink_signature: (String)
    sink_argument: Argument[0]
    gap_type: missing-sink
    evidence: repo-local-flow
    confidence: high
    description: "User-controlled query parameter concatenated into HQL query string and passed to Panache list() method"

  - source_file: src/main/java/com/example/DoctypeShareFolderMappingResource.java
    source_line: 69
    source_param: doctype
    sink_file: src/main/java/com/example/DoctypeShareFolderMapping.java
    sink_line: 137
    sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: find
    sink_signature: (String)
    sink_argument: Argument[0]
    gap_type: missing-sink
    evidence: repo-local-flow
    confidence: high
    description: "User-controlled query parameter concatenated into HQL query string and passed to Panache find() method"

candidate_related_sinks:
  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: stream
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    rationale: "Panache stream() method accepts query strings similar to list() and find(), but not exercised in this repository"

  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: count
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    rationale: "Panache count() method accepts query strings for filtering, but not exercised in this repository"

  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: delete
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    rationale: "Panache delete() method accepts query strings for filtering, but not exercised in this repository"

  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: update
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    rationale: "Panache update() method accepts query strings, but not exercised in this repository"
```

## Analysis Details

### Already Detected (Control Cases)

Baseline CodeQL successfully detects these standard JPA/Hibernate patterns:

1. **EntityManager.createNativeQuery()** - Line 36
2. **EntityManager.createQuery()** - Line 61  
3. **Session.createQuery()** - Line 85
4. **Session.createNativeQuery()** - Line 110

These are coverage/control cases that demonstrate baseline CodeQL correctly identifies standard persistence API vulnerabilities.

### Gap Analysis

The Quarkus Panache convenience APIs (`PanacheEntityBase.list()` and `PanacheEntityBase.find()`) are **framework-specific abstractions** over standard JPA/Hibernate that baseline CodeQL does not recognize as SQL injection sinks.

**Why These Are Gaps:**
- Panache methods execute HQL/JPQL queries internally but are not modeled in baseline CodeQL
- String concatenation is used to build query predicates, enabling SQL injection
- The vulnerability pattern matches standard SQL injection: `user_input → concatenation → query_execution`
- Safe alternatives exist (parameterized queries) but vulnerable pattern is undetected

**Impact:**
- Quarkus applications using Panache with unsafe query construction are not flagged
- Developers may assume framework convenience methods are automatically safe
- High-risk pattern goes unreported in security scans

## Validation Evidence

This repository contains working proof-of-concept code demonstrating:

1. **Unsafe patterns** that concatenate user input into query strings
2. **Safe patterns** using parameterized queries as comparison
3. **Complete data flow** from HTTP request parameter to query execution
4. **Confirmed baseline CodeQL results** showing 4 detections (JPA/Hibernate only)
5. **Confirmed gap** showing Panache patterns at lines 131 and 137 are not detected

The entity class `DoctypeShareFolderMapping` extends `PanacheEntityBase`, making it a direct subclass where these methods are inherited and invoked.

## Recommended Remediation Pattern

For Panache queries, use the parameterized overload:

**Unsafe:**
```java
String query = "doctypeId = '" + doctype + "'";
return list(query);
```

**Safe:**
```java
return list("doctypeId", doctype);
```

The safe pattern keeps user input separate from query structure, preventing injection attacks.

---

## Model Pack Proposal

- Model file: .codeql/models/generated-sql-injection-sinks.yaml
- Merge mode: enabled (existing entries preserved)

### Added entries

- io.quarkus.hibernate.orm.panache.PanacheEntityBase.list (framework, observed)
- io.quarkus.hibernate.orm.panache.PanacheEntityBase.find (framework, observed)

### Skipped entries

None. All observed gaps were successfully modeled.

### Candidate related sinks

- io.quarkus.hibernate.orm.panache.PanacheEntityBase.stream (not auto-modelled; evidence: framework-family-inference; confidence: medium)
- io.quarkus.hibernate.orm.panache.PanacheEntityBase.count (not auto-modelled; evidence: framework-family-inference; confidence: medium)
- io.quarkus.hibernate.orm.panache.PanacheEntityBase.delete (not auto-modelled; evidence: framework-family-inference; confidence: medium)
- io.quarkus.hibernate.orm.panache.PanacheEntityBase.update (not auto-modelled; evidence: framework-family-inference; confidence: medium)

status: MODEL_GENERATED
next: VERIFY

---

## Validation Results

### Summary

- Generated model file applied: yes
- Executable CodeQL validation: passed
- Reference `ql/src` proof compared: yes

### Baseline: No Model Pack

- Result count: 4
- Expected: JPA control finding only
- Panache finding present: no

Baseline detected only the standard JPA/Hibernate SQL injection patterns:
- `src/main/java/com/example/DoctypeShareFolderMapping.java:36:36` - EntityManager.createNativeQuery
- `src/main/java/com/example/DoctypeShareFolderMapping.java:61:30` - EntityManager.createQuery
- `src/main/java/com/example/DoctypeShareFolderMapping.java:85:30` - Session.createQuery
- `src/main/java/com/example/DoctypeShareFolderMapping.java:110:36` - Session.createNativeQuery

The Quarkus Panache `list(query)` at line 131 and `find(query)` at line 137 were NOT detected, confirming the modeling gap.

### Reference: Existing `ql/src` Model Pack

- Result count: 6
- Expected: JPA control finding plus Panache finding
- Panache finding present: yes

Reference model pack detected all 4 baseline findings plus 2 Panache findings:
- `src/main/java/com/example/DoctypeShareFolderMapping.java:131:21` - PanacheEntityBase.list(query)
- `src/main/java/com/example/DoctypeShareFolderMapping.java:137:21` - PanacheEntityBase.find(query)

This confirms the reference model pack (`ql/src/quarkus-sinks.model.yml`) successfully closes the Quarkus/Panache gap.

### Generated Model Pack

- Result count: 6
- Expected: JPA control finding plus Panache finding
- Panache finding present: yes
- Generated sink exercised: PanacheEntityBase.list, PanacheEntityBase.find

Generated model pack detected identical results to the reference pack:
- All 4 baseline JPA/Hibernate findings
- `src/main/java/com/example/DoctypeShareFolderMapping.java:131:21` - PanacheEntityBase.list(query)
- `src/main/java/com/example/DoctypeShareFolderMapping.java:137:21` - PanacheEntityBase.find(query)

The generated model entries successfully triggered CodeQL's SQL injection query on both Panache API shapes.

### Generated Row Proof

```yaml
verify_result:
  status: VERIFIED
  baseline_count: 4
  reference_count: 6
  generated_count: 6
  generated_matches_reference: true
  proven_generated_rows:
    - io.quarkus.hibernate.orm.panache.PanacheEntityBase.list Argument[0]
    - io.quarkus.hibernate.orm.panache.PanacheEntityBase.find Argument[0]
  unproven_generated_rows: []
  failed_generated_rows: []
```

### Row-by-Row Analysis

**Generated model file:** `.codeql/models/generated-sql-injection-sinks.yaml`

| Package | Type | Method | Argument | Status | Evidence |
|---------|------|--------|----------|--------|----------|
| io.quarkus.hibernate.orm.panache | PanacheEntityBase | list | Argument[0] | **proven** | Line 131: `list(query)` reported as SQL injection |
| io.quarkus.hibernate.orm.panache | PanacheEntityBase | find | Argument[0] | **proven** | Line 137: `find(query)` reported as SQL injection |

Both generated model rows were successfully proven by executable CodeQL validation. Each row:
1. Loaded successfully into CodeQL's sink model extension point
2. Triggered the standard CodeQL Java SQL injection query (`java/sql-injection`)
3. Reported the exact vulnerable flow documented in the gap analysis
4. Matched the behavior of the hand-crafted reference model pack

### Validation Confidence

**high**

Rationale:
- Executable CodeQL validation completed successfully
- Baseline/reference/generated SARIF comparison matches expected pattern exactly
- Generated model pack reports identical findings to reference model pack
- Both documented Panache vulnerabilities (lines 131 and 137) are detected
- Generated model rows are proven by repository-local vulnerable flows
- No additional findings or missing findings compared to reference

### Executable Environment

- Java: OpenJDK 17.0.19
- Maven: 3.9.16
- CodeQL CLI: 2.25.5
- CodeQL Query Pack: codeql/java-queries (java-security-extended suite)
- Build: `mvn clean package -DskipTests`
- Database: Java extraction with Maven build command

### Validation Commands

```bash
# Install CodeQL CLI
mkdir -p .aw-verify/tools
curl -L https://github.com/github/codeql-action/releases/latest/download/codeql-bundle-linux64.tar.gz \
  -o .aw-verify/codeql-bundle-linux64.tar.gz
tar -xzf .aw-verify/codeql-bundle-linux64.tar.gz -C .aw-verify/tools
export PATH="$PWD/.aw-verify/tools/codeql:$PATH"

# Build application
mvn clean package -DskipTests -Dmaven.repo.local=.aw-verify/m2-repo

# Create CodeQL database
codeql database create .aw-verify/db-quarkus --overwrite --language=java \
  --command="mvn clean package -DskipTests -Dmaven.repo.local=.aw-verify/m2-repo"

# Run baseline analysis
codeql database analyze .aw-verify/db-quarkus codeql/java-queries:codeql-suites/java-security-extended.qls \
  --rerun --format=sarif-latest --output=.aw-verify/results/baseline.sarif

# Run reference modeled analysis
codeql pack install .
codeql database analyze .aw-verify/db-quarkus codeql/java-queries:codeql-suites/java-security-extended.qls \
  --model-packs=local/quarkus-models --additional-packs=. \
  --rerun --format=sarif-latest --output=.aw-verify/results/reference-modeled.sarif

# Run generated modeled analysis
codeql pack install .aw-verify/generated-pack
codeql database analyze .aw-verify/db-quarkus codeql/java-queries:codeql-suites/java-security-extended.qls \
  --model-packs=local/generated-quarkus-models --additional-packs=.aw-verify/generated-pack \
  --rerun --format=sarif-latest --output=.aw-verify/results/generated-modeled.sarif
```

### Comparison Matrix

| Analysis | Model Pack | SQL Injection Results | JPA Control | Panache list() | Panache find() |
|----------|------------|----------------------|-------------|----------------|----------------|
| Baseline | none | 4 | ✓ (4 cases) | ✗ | ✗ |
| Reference | `ql/src/quarkus-sinks.model.yml` | 6 | ✓ (4 cases) | ✓ (line 131) | ✓ (line 137) |
| Generated | `.codeql/models/generated-sql-injection-sinks.yaml` | 6 | ✓ (4 cases) | ✓ (line 131) | ✓ (line 137) |

The generated model pack achieves functional parity with the reference model pack for the documented Quarkus/Panache SQL injection gap.

status: VERIFIED
next: COMPLETE
