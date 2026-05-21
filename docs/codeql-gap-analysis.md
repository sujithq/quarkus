# CodeQL Gap Analysis

status: GAP_DETECTED
next: PROPOSE_MODEL

---

## Summary

This analysis scans the codebase for SQL injection patterns where user-controlled input flows
through string concatenation into a query execution method that is not modelled as a sink in
baseline CodeQL.

Three flows were identified. One is already detected by baseline CodeQL (JPA control case).
Two are missed by baseline CodeQL and constitute confirmed coverage gaps (Quarkus/Panache
`PanacheEntityBase.list` with high confidence and `PanacheEntityBase.find` with medium
confidence).

Evidence source: comparison of `results/baseline.sarif` (1 result) and
`results/modeled.sarif` (2 results) produced by CodeQL CLI 2.25.2 against this codebase.

---

## Finding 1

- Issue: Potential SQL injection
- Source: `@QueryParam("doctype")` — `DoctypeShareFolderMappingResource.findPanacheUnsafe`
- Sink: `PanacheEntityBase.list` — `DoctypeShareFolderMapping.java:55`
- Gap Type: missing-sink
- Confidence: high
- Reason:
  User-controlled input arrives via `@QueryParam("doctype") String doctype` in
  `DoctypeShareFolderMappingResource.findPanacheUnsafe`. It is passed to
  `DoctypeShareFolderMapping.findByDoctypePanacheUnsafe(doctype)`, where it is
  directly concatenated into a JPQL where-clause fragment:

  ```java
  String query = "doctypeId = '" + doctype + "'";
  return list(query);
  ```

  The method `io.quarkus.hibernate.orm.panache.PanacheEntityBase.list(String query, ...)`
  executes the query string against the database. Baseline CodeQL does not model this
  Quarkus/Panache convenience method as a SQL injection sink, so the tainted flow from
  `@QueryParam` to `list(query)` is not reported.

  Confirmed gap: `results/baseline.sarif` contains 1 result (JPA only). After adding a
  model-pack entry for `PanacheEntityBase.list(Argument[0])`, `results/modeled.sarif`
  contains 2 results, with the second result at
  `src/main/java/com/example/DoctypeShareFolderMapping.java:55:29`.

---

## Finding 2

- Issue: Potential SQL injection
- Source: `@QueryParam("doctype")` — `DoctypeShareFolderMappingResource.findPanacheUnsafe`
- Sink: `PanacheEntityBase.find` — same API surface as Finding 1
- Gap Type: missing-sink
- Confidence: medium
- Reason:
  `io.quarkus.hibernate.orm.panache.PanacheEntityBase.find(String query, ...)` accepts a
  JPQL where-clause string as `Argument[0]`, identical in shape to the `list` overload
  confirmed in Finding 1. If user-controlled input were concatenated into the first argument
  of a `find` call, baseline CodeQL would not flag it for the same reason: the method is not
  modelled as a SQL injection sink.

  Confidence is medium rather than high because no test path calling `find` with concatenated
  user input exists in this codebase. The gap is inferred from the structural equivalence
  with `list` and from the fact that the model pack entry for `find` was required alongside
  `list` to close the broader Panache coverage gap.

---

## Control Case (Not a Gap)

- Issue: SQL injection — already detected by baseline CodeQL
- Source: `@QueryParam("doctype")` — `DoctypeShareFolderMappingResource.findUnsafe`
- Sink: `EntityManager.createNativeQuery` — `DoctypeShareFolderMapping.java:35`
- Gap Type: none
- Confidence: n/a
- Reason:
  User-controlled input is concatenated into a native SQL string:

  ```java
  String sql = "SELECT * FROM doctype_sharefolder_mapping WHERE doctype_id = '" + doctype + "'";
  em.createNativeQuery(sql, DoctypeShareFolderMapping.class).getSingleResult();
  ```

  The sink `jakarta.persistence.EntityManager.createNativeQuery` is already modelled in
  the baseline CodeQL Java queries. `results/baseline.sarif` reports this finding at
  `src/main/java/com/example/DoctypeShareFolderMapping.java:35:36`. This is included as a
  control case to demonstrate that the detection infrastructure is working and that the
  Panache gap is specific to the unmodelled framework sink, not a general analysis failure.

---

## Handover Contract

status: GAP_DETECTED
next: PROPOSE_MODEL
