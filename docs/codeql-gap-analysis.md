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

status: GAP_DETECTED
next: PROPOSE_MODEL
