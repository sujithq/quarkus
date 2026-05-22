# CodeQL Gap Analysis

status: GAP_DETECTED
next: PROPOSE_MODEL

## Overview

This analysis identified SQL injection vulnerabilities in Quarkus applications that use Panache ORM framework methods. While standard JPA and Hibernate sinks are well-covered by CodeQL, the Quarkus-specific Panache framework methods (`list` and `find`) may not be properly detected when tainted input flows through string concatenation.

## Finding 1: SQL Injection via PanacheEntityBase.list

- **Issue**: Potential SQL injection through Panache `list` method
- **Source**: `@QueryParam` annotated REST parameter
- **Sink**: `PanacheEntityBase.list(String query)`
- **Gap Type**: missing-sink or missing-flow
- **Confidence**: high

**Vulnerable Code Pattern**:
```java
@GET
@Path("/panache-unsafe")
public List<DoctypeShareFolderMapping> findPanacheUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypePanacheUnsafe(doctype);
}

public static List<DoctypeShareFolderMapping> findByDoctypePanacheUnsafe(String doctype) {
    String query = "doctypeId = '" + doctype + "'";
    return list(query);  // Sink: inherited from PanacheEntityBase
}
```

## Finding 2: SQL Injection via PanacheEntityBase.find

- **Issue**: Potential SQL injection through Panache `find` method
- **Source**: `@QueryParam` annotated REST parameter
- **Sink**: `PanacheEntityBase.find(String query).list()`
- **Gap Type**: missing-sink or missing-flow
- **Confidence**: high

**Vulnerable Code Pattern**:
```java
@GET
@Path("/panache-find-unsafe")
public List<DoctypeShareFolderMapping> findPanacheFindUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypePanacheFindUnsafe(doctype);
}

public static List<DoctypeShareFolderMapping> findByDoctypePanacheFindUnsafe(String doctype) {
    String query = "doctypeId = '" + doctype + "'";
    return find(query).list();  // Sink: find inherited from PanacheEntityBase
}
```

## Finding 3: SQL Injection via EntityManager.createNativeQuery

- **Issue**: Potential SQL injection through JPA native query
- **Source**: `@QueryParam` annotated REST parameter
- **Sink**: `EntityManager.createNativeQuery(String sqlString)`
- **Gap Type**: missing-flow
- **Confidence**: high

**Vulnerable Code Pattern**:
```java
@GET
@Path("/unsafe")
public DoctypeShareFolderMapping findUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypeUnsafe(doctype);
}

public static DoctypeShareFolderMapping findByDoctypeUnsafe(String doctype) {
    EntityManager em = Arc.container().instance(EntityManager.class).get();
    String sql = "SELECT * FROM doctype_sharefolder_mapping WHERE doctype_id = '" + doctype + "'";
    return (DoctypeShareFolderMapping) em.createNativeQuery(sql, DoctypeShareFolderMapping.class)
            .getSingleResult();
}
```

## Finding 4: SQL Injection via EntityManager.createQuery

- **Issue**: Potential SQL injection through JPA query
- **Source**: `@QueryParam` annotated REST parameter
- **Sink**: `EntityManager.createQuery(String qlString)`
- **Gap Type**: missing-flow
- **Confidence**: high

**Vulnerable Code Pattern**:
```java
@GET
@Path("/jpa-query-unsafe")
public List<DoctypeShareFolderMapping> findJpaQueryUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypeJpaQueryUnsafe(doctype);
}

public static List<DoctypeShareFolderMapping> findByDoctypeJpaQueryUnsafe(String doctype) {
    EntityManager em = Arc.container().instance(EntityManager.class).get();
    String query = "FROM DoctypeShareFolderMapping WHERE doctypeId = '" + doctype + "'";
    return em.createQuery(query, DoctypeShareFolderMapping.class).getResultList();
}
```

## Finding 5: SQL Injection via Hibernate Session.createQuery

- **Issue**: Potential SQL injection through Hibernate query
- **Source**: `@QueryParam` annotated REST parameter
- **Sink**: `Session.createQuery(String queryString)`
- **Gap Type**: missing-flow
- **Confidence**: high

**Vulnerable Code Pattern**:
```java
@GET
@Path("/hibernate-query-unsafe")
public List<DoctypeShareFolderMapping> findHibernateQueryUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypeHibernateQueryUnsafe(doctype);
}

public static List<DoctypeShareFolderMapping> findByDoctypeHibernateQueryUnsafe(String doctype) {
    Session session = Arc.container().instance(EntityManager.class).get().unwrap(Session.class);
    String query = "FROM DoctypeShareFolderMapping WHERE doctypeId = '" + doctype + "'";
    return session.createQuery(query, DoctypeShareFolderMapping.class).list();
}
```

## Finding 6: SQL Injection via Hibernate Session.createNativeQuery

- **Issue**: Potential SQL injection through Hibernate native query
- **Source**: `@QueryParam` annotated REST parameter
- **Sink**: `Session.createNativeQuery(String sqlString)`
- **Gap Type**: missing-flow
- **Confidence**: high

**Vulnerable Code Pattern**:
```java
@GET
@Path("/hibernate-native-unsafe")
public List<DoctypeShareFolderMapping> findHibernateNativeUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypeHibernateNativeUnsafe(doctype);
}

public static List<DoctypeShareFolderMapping> findByDoctypeHibernateNativeUnsafe(String doctype) {
    Session session = Arc.container().instance(EntityManager.class).get().unwrap(Session.class);
    String sql = "SELECT * FROM doctype_sharefolder_mapping WHERE doctype_id = '" + doctype + "'";
    return session.createNativeQuery(sql, DoctypeShareFolderMapping.class).list();
}
```

## Evidence Contract

```yaml
observed_gaps:
  # Panache ORM Framework Gaps
  - source_file: src/main/java/com/example/DoctypeShareFolderMappingResource.java
    source_line: 15
    source_method: findPanacheUnsafe
    source_param: doctype
    source_annotation: "@QueryParam"
    sink_file: src/main/java/com/example/DoctypeShareFolderMapping.java
    sink_line: 131
    sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: list
    sink_argument: Argument[0]
    concat_line: 129
    gap_type: missing-sink
    evidence: repo-local-flow
    confidence: high
    description: "Tainted @QueryParam flows through string concatenation into PanacheEntityBase.list()"

  - source_file: src/main/java/com/example/DoctypeShareFolderMappingResource.java
    source_line: 69
    source_method: findPanacheFindUnsafe
    source_param: doctype
    source_annotation: "@QueryParam"
    sink_file: src/main/java/com/example/DoctypeShareFolderMapping.java
    sink_line: 137
    sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: find
    sink_argument: Argument[0]
    concat_line: 135
    gap_type: missing-sink
    evidence: repo-local-flow
    confidence: high
    description: "Tainted @QueryParam flows through string concatenation into PanacheEntityBase.find()"

  # Standard JPA/Hibernate Gaps (flow detection issues)
  - source_file: src/main/java/com/example/DoctypeShareFolderMappingResource.java
    source_line: 15
    source_method: findUnsafe
    source_param: doctype
    source_annotation: "@QueryParam"
    sink_file: src/main/java/com/example/DoctypeShareFolderMapping.java
    sink_line: 35
    sink_package: jakarta.persistence
    sink_type: EntityManager
    sink_method: createNativeQuery
    sink_argument: Argument[0]
    concat_line: 33
    gap_type: missing-flow
    evidence: repo-local-flow
    confidence: high
    description: "Tainted @QueryParam flows through string concatenation into EntityManager.createNativeQuery()"

  - source_file: src/main/java/com/example/DoctypeShareFolderMappingResource.java
    source_line: 27
    source_method: findJpaQueryUnsafe
    source_param: doctype
    source_annotation: "@QueryParam"
    sink_file: src/main/java/com/example/DoctypeShareFolderMapping.java
    sink_line: 60
    sink_package: jakarta.persistence
    sink_type: EntityManager
    sink_method: createQuery
    sink_argument: Argument[0]
    concat_line: 58
    gap_type: missing-flow
    evidence: repo-local-flow
    confidence: high
    description: "Tainted @QueryParam flows through string concatenation into EntityManager.createQuery()"

  - source_file: src/main/java/com/example/DoctypeShareFolderMappingResource.java
    source_line: 39
    source_method: findHibernateQueryUnsafe
    source_param: doctype
    source_annotation: "@QueryParam"
    sink_file: src/main/java/com/example/DoctypeShareFolderMapping.java
    sink_line: 84
    sink_package: org.hibernate
    sink_type: Session
    sink_method: createQuery
    sink_argument: Argument[0]
    concat_line: 82
    gap_type: missing-flow
    evidence: repo-local-flow
    confidence: high
    description: "Tainted @QueryParam flows through string concatenation into Hibernate Session.createQuery()"

  - source_file: src/main/java/com/example/DoctypeShareFolderMappingResource.java
    source_line: 51
    source_method: findHibernateNativeUnsafe
    source_param: doctype
    source_annotation: "@QueryParam"
    sink_file: src/main/java/com/example/DoctypeShareFolderMapping.java
    sink_line: 109
    sink_package: org.hibernate
    sink_type: Session
    sink_method: createNativeQuery
    sink_argument: Argument[0]
    concat_line: 107
    gap_type: missing-flow
    evidence: repo-local-flow
    confidence: high
    description: "Tainted @QueryParam flows through string concatenation into Hibernate Session.createNativeQuery()"

candidate_related_sinks:
  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheQuery
    sink_method: stream
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    description: "PanacheQuery.stream() may also accept query strings, related to find() which returns PanacheQuery"

  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: count
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    description: "PanacheEntityBase.count() may accept query strings like list() and find()"

  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: delete
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    description: "PanacheEntityBase.delete() may accept query strings for conditional deletes"

  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: update
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    description: "PanacheEntityBase.update() may accept query strings for conditional updates"
```

## Analysis Summary

### Existing Model Coverage

The repository already contains a model pack (`ql/src/quarkus-sinks.model.yml`) that declares the following sinks:
- `EntityManager.createNativeQuery` (Argument[0])
- `EntityManager.createQuery` (Argument[0])
- `Session.createQuery` (Argument[0])
- `Session.createNativeQuery` (Argument[0])
- `PanacheEntityBase.list` (Argument[0])
- `PanacheEntityBase.find` (Argument[0])

### Gap Classification

Despite existing sink models, the repository contains vulnerable code patterns suggesting one or more of:

1. **Source modeling gap**: JAX-RS `@QueryParam` may not be recognized as a remote flow source
2. **Taint tracking gap**: String concatenation may not preserve taint through intermediate variables
3. **Flow detection gap**: Taint may not flow through Arc CDI container instance resolution
4. **Sink reachability gap**: Static methods on Panache entities may not be analyzed correctly

### Safe Patterns Observed

The repository also contains safe implementations demonstrating proper parameterized queries:
- `EntityManager.createQuery(...).setParameter(name, value)`
- `Session.createQuery(...).setParameter(name, value)`
- `PanacheEntityBase.list(query, param)` with two-argument form
- `PanacheEntityBase.find(query, param)` with two-argument form

## Recommended Next Steps

1. **PROPOSE_MODEL**: Create or enhance models for:
   - JAX-RS source annotations (`@QueryParam`, `@PathParam`)
   - Taint preservation through string concatenation
   - Flow through Quarkus Arc CDI containers

2. Validate that Panache ORM sink models properly handle:
   - Inherited methods called on subclasses
   - Static context invocations

3. Test coverage for Quarkus-specific patterns:
   - CDI bean resolution
   - Panache active record pattern
   - Entity inheritance hierarchies
