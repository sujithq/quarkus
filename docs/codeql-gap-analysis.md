# CodeQL Gap Analysis

status: GAP_DETECTED  
next: PROPOSE_MODEL

---

## Summary

This analysis identified SQL injection vulnerabilities in the Quarkus repository that are **NOT** detected by CodeQL's baseline analysis. The gap was confirmed by comparing baseline results (no custom models) against modeled results (with custom models).

**Key Finding**: CodeQL does not recognize Panache framework methods (`PanacheEntityBase.list`) as SQL injection sinks by default.

---

## Finding 1

**Issue**: Potential SQL injection via Panache query API

**Source**: 
- Type: `@QueryParam`
- Location: `DoctypeShareFolderMappingResource.java:27`
- Parameter: `doctype` (user-controlled)

**Flow**:
1. User input received via `@QueryParam("doctype")` at REST endpoint
2. Passed to `findByDoctypePanacheUnsafe(String doctype)` 
3. String concatenation: `String query = "doctypeId = '" + doctype + "'"`
4. Concatenated string passed to `PanacheEntityBase.list(query)`

**Sink**:
- Method: `io.quarkus.hibernate.orm.panache.PanacheEntityBase.list`
- Location: `DoctypeShareFolderMapping.java:55`
- Signature: `public static <T> List<T> list(String query, Object... params)`

**Gap Type**: `missing-sink`

**Confidence**: HIGH

**Evidence**:
- **Baseline results**: Line 55 NOT detected (only line 35 detected)
- **Modeled results**: Line 55 DETECTED (after adding custom models)
- **Proof**: `results/baseline.sarif` shows 1 finding; `results/modeled.sarif` shows 2 findings

**Vulnerability Details**:
```java
// Vulnerable code path
@GET
@Path("/panache-unsafe")
public List<DoctypeShareFolderMapping> findPanacheUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypePanacheUnsafe(doctype);
}

public static List<DoctypeShareFolderMapping> findByDoctypePanacheUnsafe(String doctype) {
    String query = "doctypeId = '" + doctype + "'";  // Unsafe concatenation
    return list(query);  // PanacheEntityBase.list - MISSING SINK
}
```

**Attack Vector**:
```
GET /doctype-share-folder-mappings/panache-unsafe?doctype=' OR '1'='1
```

**Safe Alternative** (already exists in codebase):
```java
// Safe parameterized version
public static List<DoctypeShareFolderMapping> findByDoctypePanacheSafe(String doctype) {
    return list("doctypeId", doctype);  // Parameterized
}
```

---

## Finding 2

**Issue**: SQL injection via JPA native query (DETECTED by baseline)

**Source**: 
- Type: `@QueryParam`
- Location: `DoctypeShareFolderMappingResource.java:15`
- Parameter: `doctype` (user-controlled)

**Flow**:
1. User input received via `@QueryParam("doctype")` at REST endpoint
2. Passed to `findByDoctypeUnsafe(String doctype)`
3. String concatenation: `String sql = "SELECT * FROM doctype_sharefolder_mapping WHERE doctype_id = '" + doctype + "'"`
4. Concatenated SQL passed to `EntityManager.createNativeQuery(sql)`

**Sink**:
- Method: `jakarta.persistence.EntityManager.createNativeQuery`
- Location: `DoctypeShareFolderMapping.java:35`

**Gap Type**: `none` (properly detected by baseline CodeQL)

**Confidence**: HIGH

**Status**: ✅ Detected by baseline CodeQL analysis

---

## Analysis Methodology

1. **Input Source Identification**:
   - Scanned for `@QueryParam`, `@PathParam`, `@FormParam`
   - Identified REST controller parameters
   - Found: `@QueryParam("doctype")` in `DoctypeShareFolderMappingResource`

2. **Unsafe Query Construction Detection**:
   - Searched for string concatenation with `+` operator
   - Found two instances building SQL/query strings from user input

3. **Sink Identification**:
   - Standard JPA: `EntityManager.createNativeQuery`, `createQuery`
   - Hibernate: `Session.createQuery`, `createSQLQuery`
   - Panache: `PanacheEntityBase.list`, `find`, `update`, `delete`
   - Found: `createNativeQuery` (line 35) and `PanacheEntityBase.list` (line 55)

4. **Gap Detection**:
   - Compared `results/baseline.sarif` vs `results/modeled.sarif`
   - Baseline: 1 finding (line 35 only)
   - Modeled: 2 findings (lines 35 + 55)
   - **Gap identified**: Line 55 missing in baseline

5. **False Positive Filtering**:
   - Verified safe alternatives use parameterized queries
   - Confirmed `findByDoctypeSafe` and `findByDoctypePanacheSafe` are properly parameterized
   - No false positives in this analysis

---

## Panache Framework Context

**What is Panache?**
- Quarkus extension simplifying JPA/Hibernate usage
- Provides Active Record and Repository patterns
- Query methods accept PanacheQL (simplified HQL/JPQL)

**Vulnerable Method Signature**:
```java
io.quarkus.hibernate.orm.panache.PanacheEntityBase
public static <T> List<T> list(String query, Object... params)
```

**Why It's Vulnerable**:
- The `query` parameter accepts arbitrary PanacheQL/HQL expressions
- If constructed via string concatenation with user input, allows injection
- Similar to `EntityManager.createQuery()` but not in CodeQL's default sink list

**Other Potentially Vulnerable Panache Methods**:
- `PanacheEntityBase.find(String query, Object... params)`
- `PanacheEntityBase.update(String query, Object... params)`
- `PanacheEntityBase.delete(String query, Object... params)`
- `PanacheRepository.list(String query, Object... params)`
- `PanacheRepository.find(String query, Object... params)`

---

## Recommendations

1. **Immediate**: Add custom CodeQL models for Panache query methods
2. **Detection**: Treat all `PanacheEntityBase` query methods as SQL injection sinks
3. **Prevention**: Enforce parameterized queries in Panache usage
4. **Education**: Document SQL injection risks specific to Panache framework

---

## Classification Summary

| Finding | Source | Sink | Gap Type | Detected (Baseline) | Detected (Modeled) |
|---------|--------|------|----------|---------------------|-------------------|
| Finding 1 | @QueryParam | PanacheEntityBase.list | missing-sink | ❌ NO | ✅ YES |
| Finding 2 | @QueryParam | EntityManager.createNativeQuery | none | ✅ YES | ✅ YES |

---

## Next Steps

status: GAP_DETECTED  
next: PROPOSE_MODEL

**Action Required**: Create CodeQL extensible models for Quarkus Panache framework to detect SQL injection through:
- `io.quarkus.hibernate.orm.panache.PanacheEntityBase.list`
- `io.quarkus.hibernate.orm.panache.PanacheEntityBase.find`
- `io.quarkus.hibernate.orm.panache.PanacheEntityBase.update`
- `io.quarkus.hibernate.orm.panache.PanacheEntityBase.delete`
- Similar methods in `PanacheRepository` and related classes

This will close the detection gap and improve security coverage for Quarkus applications.
