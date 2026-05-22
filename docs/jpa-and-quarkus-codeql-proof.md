# CodeQL Proof: JPA Detection and Quarkus/Panache Model Pack Detection

## Executive Summary

This proof separates two different questions that can otherwise get mixed together:

1. Does CodeQL detect a SQL injection when the sink is standard JPA `EntityManager.createNativeQuery`?
2. Can a custom organization-level model pack close a Quarkus/Panache-specific modeling gap?

The answer from this project is:

1. Yes. Baseline CodeQL already detects the direct JPA example.
2. Yes. Baseline CodeQL misses the Panache `list(query)` and `find(query)` examples, and the custom model pack makes CodeQL report them.

This means the direct JPA case is a control case, while the Panache case is the custom-model proof.

## Test Application

The application is a minimal Quarkus 3 project using:

1. Jakarta REST (`@GET`, `@Path`, `@QueryParam`) for user-controlled input.
2. Jakarta Persistence (`EntityManager`) for the direct JPA case.
3. Quarkus Hibernate ORM Panache (`PanacheEntityBase`) for the Quarkus/Panache case.
4. CodeQL Java queries plus a local model pack.

Key files:

1. `src/main/java/com/example/DoctypeShareFolderMappingResource.java`
2. `src/main/java/com/example/DoctypeShareFolderMapping.java`
3. `qlpack.yml`
4. `ql/src/quarkus-sinks.model.yml`
5. `results/baseline.sarif`
6. `results/modeled.sarif`

## Shared Source: User-Controlled Input

Both vulnerable paths start from a REST query parameter:

```java
@QueryParam("doctype") String doctype
```

The direct JPA endpoint is:

```java
@GET
@Path("/unsafe")
public DoctypeShareFolderMapping findUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypeUnsafe(doctype);
}
```

The Quarkus/Panache endpoints are:

```java
@GET
@Path("/panache-unsafe")
public List<DoctypeShareFolderMapping> findPanacheUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypePanacheUnsafe(doctype);
}

@GET
@Path("/panache-find-unsafe")
public List<DoctypeShareFolderMapping> findPanacheFindUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypePanacheFindUnsafe(doctype);
}
```

This is important because it proves the test is not about artificial local variables. The tainted value comes from an externally controlled HTTP input.

## Proof 1: JPA Is Already Detected By Baseline CodeQL

The direct JPA vulnerable method is:

```java
public static DoctypeShareFolderMapping findByDoctypeUnsafe(String doctype) {
    EntityManager em = Arc.container()
            .instance(EntityManager.class)
            .get();

    String sql = "SELECT * FROM doctype_sharefolder_mapping WHERE doctype_id = '" + doctype + "'";

    return (DoctypeShareFolderMapping) em
            .createNativeQuery(sql, DoctypeShareFolderMapping.class)
            .getSingleResult();
}
```

Although this code is inside a Quarkus application, the sink is not Quarkus-specific. The sink is:

```java
jakarta.persistence.EntityManager.createNativeQuery(...)
```

Current CodeQL Java queries already model this JPA API as a SQL injection sink.

### Baseline Command

```powershell
codeql database analyze db-quarkus codeql/java-queries --rerun --format=sarif-latest --output=results/baseline.sarif
```

### Baseline Result

```text
results/baseline.sarif results=1
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:35:36 This query depends on a user-provided value.
```

### Interpretation

This proves that the direct JPA case does not require a custom Quarkus model pack.

Customer-facing wording:

> This vulnerable method is in a Quarkus application, but the SQL execution sink is standard Jakarta Persistence. CodeQL already models `EntityManager.createNativeQuery`, so this specific JPA pattern is detected out of the box.

## Proof 2: Quarkus/Panache Is Missed By Baseline CodeQL

The Panache vulnerable methods are:

```java
public static List<DoctypeShareFolderMapping> findByDoctypePanacheUnsafe(String doctype) {
    String query = "doctypeId = '" + doctype + "'";

    return list(query);
}

public static List<DoctypeShareFolderMapping> findByDoctypePanacheFindUnsafe(String doctype) {
    String query = "doctypeId = '" + doctype + "'";

    return find(query).list();
}
```

Here the sink is no longer a direct JPA method call. The sink is the Quarkus/Panache convenience API:

```java
io.quarkus.hibernate.orm.panache.PanacheEntityBase.list(...)
io.quarkus.hibernate.orm.panache.PanacheEntityBase.find(...)
```

In the baseline run, CodeQL reports only the direct JPA finding. It does not report the Panache `list(query)` or `find(query)` flows.

### Baseline Result

```text
results/baseline.sarif results=1
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:35:36
```

There is no baseline alert for either Panache call.

### Interpretation

This is the Quarkus/Panache modeling gap.

Customer-facing wording:

> The source is still user-controlled and the query string is still built by concatenation, but baseline CodeQL does not treat Panache `list(query)` or `find(query)` as SQL/HQL execution sinks in this test. That is the framework-specific gap.

## Custom Model Pack

The model pack is defined in `qlpack.yml`:

```yaml
name: local/quarkus-models
version: 0.0.1
library: true
extensionTargets:
  codeql/java-all: "*"
dataExtensions:
  - ql/src/quarkus-sinks.model.yml
```

The sink model file is `ql/src/quarkus-sinks.model.yml`.

The important Panache entries are:

```yaml
- ["io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true,
   "list", "", "", "Argument[0]", "sql-injection", "manual"]

- ["io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true,
   "find", "", "", "Argument[0]", "sql-injection", "manual"]
```

These tuples tell CodeQL:

1. The package is `io.quarkus.hibernate.orm.panache`.
2. The declaring type is `PanacheEntityBase`.
3. The method is static from the model perspective (`true`).
4. The methods are `list` and `find`.
5. The query string is `Argument[0]`.
6. The sink kind is `sql-injection`.

The pack does not add a new SQL injection query. It adds framework knowledge that the existing CodeQL Java SQL injection query can consume.

## Proof 3: Modeled Analysis Catches The Panache Cases

### Modeled Command

```powershell
codeql database analyze db-quarkus codeql/java-queries `
  --model-packs=local/quarkus-models `
  --additional-packs=. `
  --rerun `
  --format=sarif-latest `
  --output=results/modeled.sarif
```

### Modeled Result

```text
results/modeled.sarif results=3
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:35:36
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:55:21
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:61:21
```

The first finding is the direct JPA control case.

The second and third findings are the Quarkus/Panache cases:

```java
return list(query);
return find(query).list();
```

### Interpretation

This proves that the model pack closes the Quarkus/Panache gap for both demonstrated API shapes.

Customer-facing wording:

> The baseline run detected only the standard JPA sink. After loading the organization model pack, CodeQL also detected the Panache `list(query)` and `find(query)` sinks. This demonstrates that org-level model packs can extend CodeQL's framework knowledge without changing the application code or writing a new SQL injection query.

## Debug Proof: CodeQL Sees The Framework Method

The debug query confirms the method resolution:

```powershell
codeql query run debug/src/debug-methods.ql --database=db-quarkus --additional-packs=debug
```

Relevant output:

```text
createNativeQuery(...) -> jakarta.persistence.EntityManager.createNativeQuery
list(...)              -> io.quarkus.hibernate.orm.panache.PanacheQuery.list
```

The validation SARIF is the authoritative proof for the model pack. The debug output is still useful as supporting context because it shows the fluent Panache query chain CodeQL extracts around the modeled call.

The argument-position debug query confirms the JPA SQL argument:

```powershell
codeql query run debug/src/debug-native-query-arguments.ql --database=db-quarkus --additional-packs=debug
```

Relevant output:

```text
sql -> Argument[0]
```

## End-To-End Reproduction Steps

### 1. Verify Tools

```powershell
java -version
mvn -version
codeql version
```

Validated environment:

```text
Java 17
Maven 3.9.15
CodeQL CLI 2.25.2
```

### 2. Build The Quarkus Application

```powershell
mvn clean package
```

Expected result:

```text
BUILD SUCCESS
```

### 3. Create The CodeQL Database

```powershell
codeql database create db-quarkus --overwrite --language=java --command="mvn clean package"
```

Expected result:

```text
Successfully created database at ...\db-quarkus
```

### 4. Run Baseline Analysis

```powershell
New-Item -ItemType Directory -Force results | Out-Null
codeql database analyze db-quarkus codeql/java-queries --rerun --format=sarif-latest --output=results/baseline.sarif
```

Expected result:

```text
baseline.sarif results=1
```

Meaning:

1. Direct JPA SQL injection is detected.
2. Panache SQL injection is not detected.

### 5. Run Modeled Analysis

```powershell
codeql database analyze db-quarkus codeql/java-queries --model-packs=local/quarkus-models --additional-packs=. --rerun --format=sarif-latest --output=results/modeled.sarif
```

Expected result:

```text
modeled.sarif results=3
```

Meaning:

1. Direct JPA SQL injection is still detected.
2. Panache `list(query)` SQL injection is now detected because of the model pack.
3. Panache `find(query)` SQL injection is now detected because of the model pack.

### 6. Compare SARIF Counts

```powershell
foreach ($file in 'results/baseline.sarif','results/modeled.sarif') {
  $sarif = Get-Content $file -Raw | ConvertFrom-Json
  $results = @($sarif.runs[0].results)
  Write-Output "$file results=$($results.Count)"
  foreach ($result in $results) {
    $loc = $result.locations[0].physicalLocation
    Write-Output "$($result.ruleId) $($loc.artifactLocation.uri):$($loc.region.startLine):$($loc.region.startColumn) $($result.message.text)"
  }
}
```

Expected result:

```text
results/baseline.sarif results=1
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:35:36 This query depends on a user-provided value.

results/modeled.sarif results=3
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:35:36 This query depends on a user-provided value.
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:55:21 This query depends on a user-provided value.
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:61:21 This query depends on a user-provided value.
```

## What This Proves

### JPA Proof

The direct JPA sink is already detected by CodeQL.

```text
@QueryParam -> string concatenation -> EntityManager.createNativeQuery(sql, Entity.class)
```

This is not a Quarkus modeling gap.

### Quarkus/Panache Proof

The Panache sink is not detected by baseline CodeQL in this test.

```text
@QueryParam -> string concatenation -> PanacheEntityBase.list(query)
@QueryParam -> string concatenation -> PanacheEntityBase.find(query)
```

After adding model pack entries for `PanacheEntityBase.list(Argument[0])` and `PanacheEntityBase.find(Argument[0])`, CodeQL reports both issues.

This is the org-level modeling proof.

## Customer Explanation

Use this wording:

> We separated the problem into two cases. The direct `EntityManager.createNativeQuery` case is standard JPA and is already detected by CodeQL. The Quarkus/Panache `list(query)` and `find(query)` cases were not detected in the baseline run because CodeQL did not treat those framework helpers as SQL execution sinks in this test. After adding an organization-level CodeQL model pack that marks `PanacheEntityBase.list(Argument[0])` and `PanacheEntityBase.find(Argument[0])` as SQL injection sinks, the standard CodeQL SQL injection query reported both vulnerabilities. This proves that organization-level model packs can close framework-specific modeling gaps without writing a custom query or changing application code.

## Important Caveats

1. This model is intentionally simple and should be reviewed before broad rollout.
2. Panache APIs have multiple overloads and query styles; each important usage should be validated.
3. Modeling `list` and `find` broadly may increase false positives if constant query fragments or safe parameterized overloads are not distinguished.
4. A production model pack should include a coverage matrix, false-positive review, and tests for representative repository patterns.
5. Legacy JBoss/Hibernate stacks should be assessed separately because many direct Hibernate/JPA sinks are already modeled, while application-specific DAO wrappers may not be.

## Legacy JBoss / JBoss EAP Scope

This proof does not yet validate a legacy JBoss EAP application. It validates Quarkus 3 plus JPA plus Panache.

For legacy JBoss stacks, split the investigation into two categories:

1. Standard Java persistence APIs that CodeQL likely already knows.
2. Legacy application/framework abstractions that may need model-pack support.

Examples that are likely already covered by baseline CodeQL, depending on exact version and call shape:

```java
entityManager.createNativeQuery(sql)
entityManager.createQuery(jpql)
session.createQuery(hql)
session.createNativeQuery(sql)
```

Examples that may need custom modeling in legacy JBoss applications:

```java
legacyDao.findByWhereClause(whereClause)
queryHelper.createNative(sql)
repository.executeHql(hql)
genericFinder.listByQuery(queryText)
```

The recommended customer position is:

> We have proven the model-pack mechanism on a Quarkus/Panache gap. We have not yet proven coverage for legacy JBoss EAP. For JBoss, the next step is to create a small representative EAP/Hibernate sample or extract real DAO/repository patterns from the application, then run the same baseline-vs-modeled comparison.

Suggested JBoss validation matrix:

| Pattern | Expected Baseline Result | Model Pack Needed? |
| --- | --- | --- |
| `EntityManager.createNativeQuery(sql)` | Likely detected | Usually no |
| `EntityManager.createQuery(jpql)` | Likely detected | Usually no |
| `org.hibernate.Session.createQuery(hql)` | Likely detected | Usually no |
| `org.hibernate.Session.createNativeQuery(sql)` | Likely detected | Usually no |
| Custom DAO method wrapping query execution | Unknown | Possibly yes |
| Shared query helper / repository framework | Unknown | Possibly yes |
| String-built HQL passed through internal abstraction | Unknown | Possibly yes |

So for legacy JBoss, the question is probably less "Does CodeQL support JBoss?" and more:

> Are the application's legacy DAO and repository wrappers modeled as sinks or flow steps?

## Recommended Next Work

1. Add Panache `stream`, `find`, `list`, `count`, `delete`, and `update` coverage gradually.
2. Add custom repository and DAO wrapper examples from the real application.
3. Run baseline and modeled analysis against each example.
4. Promote only validated low-noise model tuples to the organization-level model pack.
5. Document known covered APIs and known gaps for Java 8, 17, 21, Quarkus 3, and legacy JBoss EAP.
6. Build a separate legacy JBoss/EAP proof case before making coverage claims for that stack.