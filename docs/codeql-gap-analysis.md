# CodeQL Gap Analysis

status: MODEL_GENERATED
next: VERIFY

## Overview

This analysis examines SQL injection patterns in the Quarkus test repository to identify gaps in CodeQL's baseline detection capabilities. The repository contains intentionally vulnerable code paths that demonstrate both standard JPA/Hibernate patterns and Quarkus-specific Panache patterns.

## Finding 1: Panache list() Method - Missing Sink

**Issue**: Potential SQL injection via Quarkus Panache `list()` method

**Source**: `@QueryParam("doctype")` in REST endpoint
- File: `src/main/java/com/example/DoctypeShareFolderMappingResource.java`
- Line: 63
- Method: `findPanacheUnsafe`

**Flow**: User input → String concatenation → Panache query
- Input: HTTP query parameter `doctype`
- Construction: `String query = "doctypeId = '" + doctype + "'";` (line 129)
- Sink: `list(query)` (line 131)

**Sink**: `io.quarkus.hibernate.orm.panache.PanacheEntityBase.list(String)`
- File: `src/main/java/com/example/DoctypeShareFolderMapping.java`
- Line: 131
- Package: `io.quarkus.hibernate.orm.panache`
- Type: `PanacheEntityBase`
- Method: `list`
- Vulnerable Argument: `Argument[0]`

**Gap Type**: missing-sink

**Confidence**: high

**Evidence**: This repository contains a complete vulnerable flow from user input through string concatenation to the Panache `list()` method. The baseline CodeQL Java queries detect standard JPA/Hibernate sinks (`EntityManager.createQuery`, `Session.createQuery`) but do not recognize the Quarkus-specific `PanacheEntityBase.list()` method as a SQL injection sink.

## Finding 2: Panache find() Method - Missing Sink

**Issue**: Potential SQL injection via Quarkus Panache `find()` method

**Source**: `@QueryParam("doctype")` in REST endpoint
- File: `src/main/java/com/example/DoctypeShareFolderMappingResource.java`
- Line: 69
- Method: `findPanacheFindUnsafe`

**Flow**: User input → String concatenation → Panache query
- Input: HTTP query parameter `doctype`
- Construction: `String query = "doctypeId = '" + doctype + "'";` (line 135)
- Sink: `find(query).list()` (line 137)

**Sink**: `io.quarkus.hibernate.orm.panache.PanacheEntityBase.find(String)`
- File: `src/main/java/com/example/DoctypeShareFolderMapping.java`
- Line: 137
- Package: `io.quarkus.hibernate.orm.panache`
- Type: `PanacheEntityBase`
- Method: `find`
- Vulnerable Argument: `Argument[0]`

**Gap Type**: missing-sink

**Confidence**: high

**Evidence**: This repository contains a complete vulnerable flow from user input through string concatenation to the Panache `find()` method. The baseline CodeQL Java queries do not recognize the Quarkus-specific `PanacheEntityBase.find()` method as a SQL injection sink.

## Evidence Contract

```yaml
observed_gaps:
  - source_file: src/main/java/com/example/DoctypeShareFolderMappingResource.java
    source_line: 63
    source_method: findPanacheUnsafe
    source_annotation: "@QueryParam"
    sink_file: src/main/java/com/example/DoctypeShareFolderMapping.java
    sink_line: 131
    sink_method_name: findByDoctypePanacheUnsafe
    sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: list
    sink_argument: Argument[0]
    gap_type: missing-sink
    evidence: repo-local-flow
    confidence: high
    framework: quarkus-panache
    vulnerability_type: sql-injection

  - source_file: src/main/java/com/example/DoctypeShareFolderMappingResource.java
    source_line: 69
    source_method: findPanacheFindUnsafe
    source_annotation: "@QueryParam"
    sink_file: src/main/java/com/example/DoctypeShareFolderMapping.java
    sink_line: 137
    sink_method_name: findByDoctypePanacheFindUnsafe
    sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: find
    sink_argument: Argument[0]
    gap_type: missing-sink
    evidence: repo-local-flow
    confidence: high
    framework: quarkus-panache
    vulnerability_type: sql-injection

candidate_related_sinks:
  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheQuery
    sink_method: filter
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    reasoning: "PanacheQuery.filter() accepts query strings similar to find() and list(), but not directly exercised in this repository"

  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: count
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    reasoning: "PanacheEntityBase.count() accepts query strings similar to find() and list(), but not directly exercised in this repository"

  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: delete
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    reasoning: "PanacheEntityBase.delete() accepts query strings similar to find() and list(), but not directly exercised in this repository"

  - sink_package: io.quarkus.hibernate.orm.panache
    sink_type: PanacheEntityBase
    sink_method: update
    sink_argument: Argument[0]
    evidence: framework-family-inference
    confidence: medium
    auto_model: false
    reasoning: "PanacheEntityBase.update() accepts query strings for WHERE clauses, but not directly exercised in this repository"
```

## Baseline Detection Status

**Detected by baseline CodeQL** (no gaps):
- ✅ `jakarta.persistence.EntityManager.createNativeQuery(String)` - line 36
- ✅ `jakarta.persistence.EntityManager.createQuery(String)` - line 61
- ✅ `org.hibernate.Session.createQuery(String)` - lines 85, 95
- ✅ `org.hibernate.Session.createNativeQuery(String)` - line 110

**NOT detected by baseline CodeQL** (gaps identified):
- ❌ `io.quarkus.hibernate.orm.panache.PanacheEntityBase.list(String)` - line 131
- ❌ `io.quarkus.hibernate.orm.panache.PanacheEntityBase.find(String)` - line 137

## Summary

CodeQL's baseline Java queries successfully detect SQL injection vulnerabilities in standard JPA (`jakarta.persistence.EntityManager`) and Hibernate (`org.hibernate.Session`) APIs. However, they do not recognize Quarkus-specific Panache APIs as SQL injection sinks.

The Quarkus Hibernate ORM Panache framework provides convenience methods (`list`, `find`, `count`, `delete`, `update`) that accept query strings. When user-controlled input is concatenated into these query strings, SQL injection vulnerabilities can occur, but baseline CodeQL does not flag these patterns.

This repository contains two exercised vulnerable flows through Panache methods (`list` and `find`) that require custom sink models to detect. Additional Panache methods (`filter`, `count`, `delete`, `update`) are identified as candidate related sinks based on API family similarity, but are not directly exercised in this repository.

## Recommended Action

Proceed to PROPOSE_MODEL workflow to generate CodeQL model pack entries for the observed Panache sink gaps.

## Model Pack Proposal

- Model file: .codeql/models/generated-sql-injection-sinks.yaml
- Merge mode: enabled (existing entries preserved)

### Added entries

- io.quarkus.hibernate.orm.panache.PanacheEntityBase.list (framework, observed)
- io.quarkus.hibernate.orm.panache.PanacheEntityBase.find (framework, observed)

### Skipped entries

None

### Candidate related sinks

- io.quarkus.hibernate.orm.panache.PanacheQuery.filter (not auto-modelled; evidence: framework-family-inference; confidence: medium)
- io.quarkus.hibernate.orm.panache.PanacheEntityBase.count (not auto-modelled; evidence: framework-family-inference; confidence: medium)
- io.quarkus.hibernate.orm.panache.PanacheEntityBase.delete (not auto-modelled; evidence: framework-family-inference; confidence: medium)
- io.quarkus.hibernate.orm.panache.PanacheEntityBase.update (not auto-modelled; evidence: framework-family-inference; confidence: medium)

status: MODEL_GENERATED
next: VERIFY
