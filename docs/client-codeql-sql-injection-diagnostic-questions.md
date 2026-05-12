# Client Diagnostic Questions: SQL Injection Not Reported By CodeQL

## Purpose

Use this checklist when a client says that GitHub code scanning / CodeQL does not detect an intentionally vulnerable SQL injection example.

The goal is to determine whether the missed alert is caused by:

1. The code pattern being different from the validated direct JPA case.
2. The vulnerable code not being extracted into the CodeQL database.
3. The user-controlled source not being recognized.
4. The sink being hidden behind Quarkus/Panache/custom repository wrappers.
5. Code scanning configuration, branch, UI filtering, or query-suite differences.

## Short Message To Send First

> We validated locally that CodeQL detects the direct JPA pattern `EntityManager.createNativeQuery(sql, Entity.class)`. To diagnose why it is not reported in your environment, we need to confirm the exact source-to-sink path, CodeQL workflow configuration, database extraction quality, query suite/version, and whether the real application uses direct JPA or a framework/custom wrapper such as Panache or DAO helpers.

## 1. Exact Vulnerable Code

Ask:

1. Can you share the exact vulnerable method, not just a simplified screenshot?
2. Can you share the exact line where the query is executed?
3. Is the executed method one of these?

```java
EntityManager.createNativeQuery(...)
EntityManager.createQuery(...)
Session.createQuery(...)
Session.createNativeQuery(...)
PanacheEntityBase.list(...)
PanacheEntityBase.find(...)
customRepository.execute(...)
customDao.findByWhereClause(...)
```

Why this matters:

Direct JPA/Hibernate sinks are often already modeled by CodeQL. Panache and custom wrappers may require a model pack.

Evidence to request:

1. The full Java method containing the vulnerable query.
2. The imports at the top of the file.
3. The class declaration, especially whether it extends `PanacheEntityBase` or uses a repository base class.

## 2. User-Controlled Source

Ask:

1. Where does the vulnerable value come from?
2. Is it a REST query parameter, path parameter, request body, header, cookie, form field, or DTO property?
3. Can you share the controller/resource/endpoint method that receives the input?
4. Is the value passed through a DTO or mapper before reaching the query?

Examples of sources CodeQL may recognize:

```java
@QueryParam("doctype") String doctype
@PathParam("id") String id
@HeaderParam("x-user") String user
```

Examples that may need extra investigation:

```java
String doctype = requestContext.get("doctype");
String doctype = customRequest.getField("doctype");
String doctype = dto.getSearch().getDoctype();
```

Why this matters:

SQL injection detection needs both a source and a sink. If CodeQL sees the sink but not the source, the alert may not appear.

Evidence to request:

1. The endpoint/resource/controller method.
2. DTO classes involved in the flow.
3. Mapper/service methods between the endpoint and DAO/repository.

## 3. Full Source-To-Sink Path

Ask:

1. Can you provide the complete call chain from HTTP input to database query?
2. Is the vulnerable method effectively called from a reachable endpoint?
3. Are there intermediate service, mapper, repository, or DAO methods?

Use this format:

```text
HTTP endpoint
  -> service method
  -> repository / DAO method
  -> query builder
  -> final query execution API
```

Why this matters:

The direct method may be vulnerable, but CodeQL reports only if it can track tainted data from a recognized source into a known sink.

Evidence to request:

1. Endpoint method.
2. Service method.
3. Repository/DAO method.
4. Query builder/helper method.
5. Final query execution line.

## 4. Sanitization Or Validation

Ask:

1. Is the input validated before it reaches the query?
2. Is there a whitelist, regex, enum conversion, parser, or normalization step?
3. Is there a custom sanitizer method?
4. Is the SQL actually parameterized in the real code?

Examples:

```java
if (!doctype.matches("[A-Z0-9_]+")) {
    throw new BadRequestException();
}
```

```java
query.setParameter(1, doctype);
```

Why this matters:

CodeQL may not report if it determines the flow is sanitized or parameterized.

Evidence to request:

1. Validation methods.
2. Sanitizer/helper methods.
3. Final query construction code.

## 5. CodeQL Workflow Configuration

Ask for the GitHub Actions workflow that runs CodeQL.

Specifically check:

```yaml
uses: github/codeql-action/init@v3
```

```yaml
languages: java
```

```yaml
queries: security-extended
```

```yaml
build-mode: none
```

or:

```yaml
- run: mvn clean package
```

Why this matters:

Java analysis is often better with a real build. If the database is incomplete, CodeQL may miss type resolution, generated code relationships, or framework-specific call resolution.

Evidence to request:

1. Complete CodeQL workflow YAML.
2. Whether CodeQL uses autobuild, manual build, or `build-mode: none`.
3. Maven/Gradle command used during CodeQL analysis.
4. Any custom `paths`, `paths-ignore`, or matrix configuration.

## 6. CodeQL Version And Query Suite

Ask:

1. Which CodeQL version was used?
2. Is code scanning using default setup or advanced setup?
3. Which query suite is enabled?
4. Are `security-extended` or `security-and-quality` enabled?

Why this matters:

We validated with CodeQL CLI 2.25.2. Older versions or different query selections may behave differently.

Evidence to request:

1. Code scanning run logs.
2. CodeQL version from the workflow logs.
3. Query suite configuration.

## 7. Extraction Completeness

Ask:

1. Does the vulnerable file appear in CodeQL's extracted files diagnostics?
2. Are there extraction warnings or build errors?
3. Is the vulnerable code in a module that the workflow actually builds?
4. Is this a monorepo where only part of the repository is analyzed?

Why this matters:

If CodeQL does not extract the file or cannot compile the relevant module, no alert can be produced for that code.

Evidence to request:

1. CodeQL workflow logs.
2. Extraction warnings.
3. Build logs.
4. Module path containing the vulnerable file.

Useful CodeQL diagnostic query:

```ql
import java

from CompilationUnit cu
where cu.getFile().getRelativePath().matches("%DoctypeShareFolderMapping%")
select cu, cu.getFile().getRelativePath()
```

## 8. Branch, PR, And UI Filters

Ask:

1. Which branch contains the vulnerable test code?
2. Is code scanning being reviewed on the same branch?
3. Is the alert hidden by UI filters?
4. Was the alert dismissed earlier?
5. Are they checking PR alerts or default-branch alerts?

Why this matters:

The alert may exist in SARIF or on another branch but not be visible in the current GitHub code scanning view.

Evidence to request:

1. Branch name.
2. Code scanning URL or screenshot with filters visible.
3. Raw SARIF if possible.
4. Alert state filters: open, dismissed, fixed.

## 9. Direct JPA Versus Panache Versus Custom Wrapper

Ask them to classify the final sink into one bucket:

### Bucket A: Direct JPA

```java
entityManager.createNativeQuery(sql)
entityManager.createQuery(jpql)
```

Expected outcome:

Usually detected by baseline CodeQL.

If not detected, focus on source recognition, build completeness, query suite/version, or UI filtering.

### Bucket B: Direct Hibernate

```java
session.createQuery(hql)
session.createNativeQuery(sql)
```

Expected outcome:

Often detected by baseline CodeQL, but validate exact signature and imports.

If not detected, run method-visibility debug queries.

### Bucket C: Quarkus/Panache

```java
list(query)
find(query)
stream(query)
```

Expected outcome:

May be missed by baseline CodeQL and may require model-pack entries.

### Bucket D: Custom DAO / Repository / Query Helper

```java
legacyDao.findByWhereClause(whereClause)
queryHelper.executeHql(hql)
repository.runNativeSql(sql)
```

Expected outcome:

Often requires application-specific modeling if CodeQL cannot see the underlying sink.

## 10. Method Visibility Debug Query

Ask the client to run this if they can use CodeQL CLI:

```ql
import java

from MethodCall call
where call.getMethod().getName() in ["createNativeQuery", "createQuery", "list", "find", "stream"]
select call, call.getMethod().getDeclaringType(), call.getMethod().getQualifiedName()
```

Expected direct JPA output:

```text
createNativeQuery(...) -> jakarta.persistence.EntityManager.createNativeQuery
```

Expected Panache output:

```text
list(...) -> io.quarkus.hibernate.orm.panache.PanacheEntityBase.list
```

Interpretation:

1. If the call is visible and direct JPA, investigate source/taint/configuration.
2. If the call is visible and Panache/custom, investigate missing sink modeling.
3. If the call is not visible, investigate extraction/build completeness.

## 11. Triage Decision Tree

Use this quick path:

```text
1. Is the vulnerable file extracted by CodeQL?
   No -> fix workflow/build/module inclusion.
   Yes -> continue.

2. Is the final query API visible in a debug query?
   No -> fix build/type resolution/extraction.
   Yes -> continue.

3. Is the final API direct JPA/Hibernate?
   Yes -> likely already modeled; check source recognition, query suite, UI filters.
   No -> continue.

4. Is the final API Panache or a custom wrapper?
   Yes -> likely model-pack candidate.
   No -> inspect exact API and compare with CodeQL models.

5. Does modeled analysis add the missing alert?
   Yes -> promote validated tuple to org model pack after false-positive review.
   No -> investigate source modeling or intermediate flow steps.
```

## 12. Minimal Evidence Package To Request

Ask the client for this bundle:

1. Exact vulnerable method.
2. Endpoint/resource/controller method that receives user input.
3. Complete source-to-sink call chain.
4. Imports and class declaration for the vulnerable class.
5. CodeQL workflow YAML.
6. CodeQL code scanning logs.
7. CodeQL version and query suite.
8. Confirmation that the vulnerable file is extracted.
9. Raw SARIF or code scanning screenshot with filters visible.
10. Whether the final sink is JPA, Hibernate, Panache, or custom DAO/repository.
11. Provide an accessible repo with a complete setup

## 13. Customer-Friendly Summary

Use this wording:

> We reproduced the direct `EntityManager.createNativeQuery(sql, Entity.class)` case locally and baseline CodeQL detected it. If the same pattern is not reported in your environment, the likely cause is configuration, database extraction, query suite/version, source recognition, branch/UI filtering, or a difference between the simplified sample and the real source-to-sink path. If the real sink goes through Panache or a custom DAO/repository abstraction, then it may require model-pack support. To confirm which case applies, we need the exact source-to-sink code path and CodeQL workflow details.

## 14. What Not To Conclude Too Early

Do not immediately conclude:

```text
CodeQL does not support Quarkus.
```

or:

```text
CodeQL does not support JBoss.
```

Instead, conclude only after evidence:

```text
This specific source-to-sink pattern is or is not modeled by CodeQL baseline.
```

That is the actionable unit for model-pack work.