# CodeQL Gap Analysis

status: GAP_DETECTED  
next: PROPOSE_MODEL

---

## Summary

This analysis identified **1 SQL injection vulnerability pattern** in the codebase that is **NOT detected by baseline CodeQL** but becomes detectable after model extensions are applied.

**Gap Type**: Missing Sink  
**Framework**: Quarkus Panache ORM  
**Confidence**: High

---

## Finding 1: Panache `list()` Method as SQL Injection Sink

### Issue
Potential SQL injection vulnerability when user input flows into Panache `PanacheEntityBase.list()` method through string concatenation.

### Vulnerable Code Pattern

**Location**: `src/main/java/com/example/DoctypeShareFolderMapping.java:52-56`

```java
public static List<DoctypeShareFolderMapping> findByDoctypePanacheUnsafe(String doctype) {
    String query = "doctypeId = '" + doctype + "'";
    return list(query);
}
```

**Source**: `@QueryParam` annotation  
**Source Location**: `src/main/java/com/example/DoctypeShareFolderMappingResource.java:27`

```java
@GET
@Path("/panache-unsafe")
public List<DoctypeShareFolderMapping> findPanacheUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypePanacheUnsafe(doctype);
}
```

### Data Flow

1. **Source**: User-controlled input via `@QueryParam("doctype")` in REST endpoint
2. **Propagation**: Parameter passed to static method `findByDoctypePanacheUnsafe()`
3. **Dangerous Operation**: String concatenation to build query: `"doctypeId = '" + doctype + "'"`
4. **Sink**: Unsanitized query string passed to `PanacheEntityBase.list(query)`

### Gap Classification

- **Gap Type**: `missing-sink`
- **Missing Component**: `io.quarkus.hibernate.orm.panache.PanacheEntityBase.list(String)`
- **Reason**: Baseline CodeQL does not model `PanacheEntityBase.list()` as a SQL injection sink

### Detection Status

| Scenario | Baseline CodeQL | With Models | Detection Status |
|----------|----------------|-------------|------------------|
| `EntityManager.createNativeQuery()` with concatenation (line 35) | ✅ Detected | ✅ Detected | **Already Covered** |
| `PanacheEntityBase.list()` with concatenation (line 55) | ❌ Not Detected | ✅ Detected | **GAP IDENTIFIED** |

### Evidence

- **Baseline SARIF**: 1 result at line 35 only
- **Modeled SARIF**: 2 results at lines 35 and 55
- **Missing detection**: Panache `list()` method vulnerability

### Confidence Level

**HIGH** - This is a clear gap with:
- Reproducible test case in the repository
- Confirmed vulnerable pattern (string concatenation before query execution)
- Direct data flow from HTTP input to query execution
- Empirical evidence from baseline vs. modeled CodeQL results

### Safe Alternative

The codebase includes a safe version using parameterized queries:

```java
public static List<DoctypeShareFolderMapping> findByDoctypePanacheSafe(String doctype) {
    return list("doctypeId", doctype);  // Parameterized - SAFE
}
```

---

## Analysis Methodology

### 1. Input Source Identification
- Identified JAX-RS annotations: `@QueryParam`, `@PathParam`
- Located REST endpoints in `DoctypeShareFolderMappingResource.java`

### 2. Unsafe Query Construction Detection
- Searched for string concatenation patterns used to build queries
- Found concatenation in `findByDoctypeUnsafe()` and `findByDoctypePanacheUnsafe()`

### 3. Sink Identification
- Standard JPA: `EntityManager.createNativeQuery()`, `EntityManager.createQuery()`
- Hibernate: Session query methods
- **Panache**: `PanacheEntityBase.list()`, `PanacheEntityBase.find()`

### 4. Data Flow Analysis
- Traced flow: `@QueryParam` → method parameter → concatenation → query execution
- Verified both vulnerable patterns have complete data flows

### 5. Safe Pattern Filtering
- Excluded parameterized queries using `?` or `:param` placeholders
- Excluded Panache methods with separate parameter arguments

### 6. CodeQL Result Comparison
- **Baseline**: Detected only `createNativeQuery` pattern
- **Modeled**: Detected both `createNativeQuery` and Panache `list()` patterns
- **Gap**: Panache sink not in baseline models

---

## Recommendations

### Immediate Actions
1. ✅ Gap identified and documented
2. ⏭️ **Next Step**: Proceed to PROPOSE_MODEL workflow to create CodeQL model pack

### Model Requirements
The model pack should include:
- **Sink definition** for `io.quarkus.hibernate.orm.panache.PanacheEntityBase.list(String)`
- **Sink definition** for `io.quarkus.hibernate.orm.panache.PanacheEntityBase.find(String, Object...)`
- Classification as SQL injection sink (type: `sql`)

### Prevention
Developers should:
- Always use parameterized Panache queries: `list("field", value)`
- Avoid string concatenation when building queries
- Prefer type-safe query methods where available

---

## Conclusion

This gap analysis successfully identified a SQL injection vulnerability pattern in Quarkus Panache that is not detected by baseline CodeQL. The finding is classified as a **missing-sink** gap with **high confidence**, making it an excellent candidate for model extension.

**Status**: GAP_DETECTED  
**Next Workflow**: PROPOSE_MODEL
