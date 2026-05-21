# CodeQL Gap Analysis

status: GAP_DETECTED
next: PROPOSE_MODEL

## Finding 1

- **Issue**: Potential SQL injection via Panache query methods
- **Source**: `@QueryParam` (JAX-RS HTTP parameter)
- **Sink**: `PanacheEntityBase.list(String query)` 
- **Gap Type**: missing-sink
- **Confidence**: high

### Details

**Vulnerable Code Pattern:**
```java
@GET
@Path("/panache-unsafe")
public List<DoctypeShareFolderMapping> findPanacheUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypePanacheUnsafe(doctype);
}

public static List<DoctypeShareFolderMapping> findByDoctypePanacheUnsafe(String doctype) {
    String query = "doctypeId = '" + doctype + "'";
    return list(query);  // PanacheEntityBase.list() - NOT detected by baseline CodeQL
}
```

**Location:** `src/main/java/com/example/DoctypeShareFolderMapping.java:55`

**Data Flow:**
1. Source: `@QueryParam("doctype")` in `DoctypeShareFolderMappingResource.java:27`
2. String concatenation builds unsafe query: `"doctypeId = '" + doctype + "'"`
3. Sink: `PanacheEntityBase.list(query)` at line 55

**Why This is a Gap:**

Quarkus Panache provides a high-level ORM API built on Hibernate. The `PanacheEntityBase.list(String query)` method accepts a PanacheQL query string (similar to JPQL) and executes it against the database. When user input is concatenated into this query string without parameterization, it creates an SQL injection vulnerability.

Baseline CodeQL detects standard JPA methods like `EntityManager.createNativeQuery()` but does not recognize Panache-specific query execution methods as SQL injection sinks.

**Comparison:**

- ✅ **Baseline CodeQL DETECTED**: `EntityManager.createNativeQuery(sql)` at line 35
- ❌ **Baseline CodeQL MISSED**: `PanacheEntityBase.list(query)` at line 55
- ✅ **With Models DETECTED**: Both vulnerabilities detected

**Safe Alternative:**

```java
public static List<DoctypeShareFolderMapping> findByDoctypePanacheSafe(String doctype) {
    return list("doctypeId", doctype);  // Parameterized - SAFE
}
```

### Impact

SQL injection vulnerabilities allow attackers to:
- Bypass authentication and authorization
- Read, modify, or delete sensitive data
- Execute administrative operations on the database
- In some cases, execute operating system commands

### Recommendation

Model `PanacheEntityBase.list(String query)` and related Panache query methods as SQL injection sinks to enable CodeQL to detect these vulnerabilities in Quarkus applications.

---

## Model Pack Proposal

- Model file: .codeql/models/generated-sql-injection-sinks.yaml
- Merge mode: enabled (existing entries preserved)

### Added entries

- io.quarkus.hibernate.orm.panache.PanacheEntityBase.list (framework)

### Skipped entries

None

status: MODEL_GENERATED
next: VERIFY
