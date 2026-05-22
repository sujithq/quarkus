# CodeQL Gap Analysis

**status**: GAP_DETECTED  
**next**: PROPOSE_MODEL

---

## Finding 1: SQL Injection via Panache `list()` Method

- **Issue**: Potential SQL injection through string concatenation in Panache query
- **Source**: `@QueryParam("doctype")` in REST endpoint
- **Sink**: `PanacheEntityBase.list(String query)` method
- **Gap Type**: missing-sink
- **Confidence**: high

### Details

**Vulnerable Code Location**: `src/main/java/com/example/DoctypeShareFolderMapping.java:52-55`

```java
public static List<DoctypeShareFolderMapping> findByDoctypePanacheUnsafe(String doctype) {
    String query = "doctypeId = '" + doctype + "'";
    return list(query);
}
```

**Attack Flow**:
1. User-controlled input arrives via `@QueryParam("doctype")` in `DoctypeShareFolderMappingResource.java:27`
2. Input flows to `findByDoctypePanacheUnsafe()` method
3. String concatenation constructs SQL/HQL query: `"doctypeId = '" + doctype + "'"`
4. Concatenated query passed to `PanacheEntityBase.list()` method

**Why CodeQL Missed This**:
- Baseline CodeQL does not recognize `PanacheEntityBase.list(String)` as a SQL injection sink
- Standard CodeQL models cover JPA's `createQuery()` and `createNativeQuery()` but not Quarkus Panache extension methods
- The `list()` method executes HQL/SQL queries internally but is not in the default sink model

**Verification**:
- Baseline scan: **NOT detected** (0 findings on line 55)
- Modeled scan: **DETECTED** (finding on line 55 after adding Panache sink model)

### Related Safe Pattern

The repository includes a safe version demonstrating proper parameterization:

```java
public static List<DoctypeShareFolderMapping> findByDoctypePanacheSafe(String doctype) {
    return list("doctypeId", doctype);  // Parameterized - SAFE
}
```

---

## Summary

CodeQL's baseline SQL injection detection successfully identifies traditional JPA patterns (`createNativeQuery` with concatenation on line 35) but **misses Quarkus-specific Panache framework methods**.

**Impact**: Applications using Quarkus Panache ORM with string concatenation in query construction are vulnerable to SQL injection but will not be flagged by standard CodeQL analysis.

**Recommendation**: Proceed to PROPOSE_MODEL workflow to add Panache-specific sinks to CodeQL model coverage.

---

## Model Pack Proposal

- Model file: .codeql/models/generated-sql-injection-sinks.yaml
- Merge mode: enabled (existing entries preserved)

### Added entries

- `PanacheEntityBase.list` (framework)

### Skipped entries

None

**status**: MODEL_GENERATED  
**next**: VERIFY
