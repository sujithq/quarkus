# Quarkus CodeQL Sink Model Report

This report explains the entries in [ql/src/quarkus-sinks.model.yml](../ql/src/quarkus-sinks.model.yml) in plain language. The file teaches CodeQL which Quarkus, JPA, and Hibernate methods should be treated as places where unsafe database queries can happen.

## Big Picture

The risk being modeled is SQL injection. SQL injection happens when text from a user is pasted directly into a database query. If an attacker controls part of that text, they may be able to change what the database query does.

A CodeQL finding usually has three parts:

- Source: where outside input enters the application, such as an HTTP query parameter.
- Data flow: how that input moves through the code.
- Sink: the database method that receives the unsafe query text.

The model file does not create a vulnerability by itself. It tells CodeQL, "if user-controlled data reaches this method argument, report it as SQL injection risk."

## Entry 1: JPA Native SQL Query

Model entry:

```yaml
["jakarta.persistence", "EntityManager", false, "createNativeQuery", "", "", "Argument[0]", "sql-injection", "manual"]
```

Plain-English meaning:

CodeQL should treat the first value passed to `EntityManager.createNativeQuery(...)` as a dangerous database-query location. This method runs raw SQL, so a query built by joining together user input and SQL text can be unsafe.

Where this appears in the sample app:

- Source: the user supplies `doctype` in the HTTP request at [src/main/java/com/example/DoctypeShareFolderMappingResource.java](../src/main/java/com/example/DoctypeShareFolderMappingResource.java#L15).
- Data flow: the endpoint passes `doctype` into `findByDoctypeUnsafe(...)` at [src/main/java/com/example/DoctypeShareFolderMappingResource.java](../src/main/java/com/example/DoctypeShareFolderMappingResource.java#L16).
- Query construction: the code pastes `doctype` directly into a SQL string at [src/main/java/com/example/DoctypeShareFolderMapping.java](../src/main/java/com/example/DoctypeShareFolderMapping.java#L31).
- Sink: the completed SQL string is passed to `createNativeQuery(...)` at [src/main/java/com/example/DoctypeShareFolderMapping.java](../src/main/java/com/example/DoctypeShareFolderMapping.java#L35).

Simple flow:

```text
User request parameter "doctype"
  -> findUnsafe(doctype)
  -> findByDoctypeUnsafe(doctype)
  -> SQL string is built using that value
  -> createNativeQuery(sql, ...)
```

Why it matters:

If a user sends unexpected text as `doctype`, that text becomes part of the SQL command. The safer version uses a placeholder and `setParameter(...)`, which keeps the user value separate from the SQL command.

## Entry 2: JPA JPQL Query

Model entry:

```yaml
["jakarta.persistence", "EntityManager", false, "createQuery", "", "", "Argument[0]", "sql-injection", "manual"]
```

Plain-English meaning:

CodeQL should treat the first value passed to `EntityManager.createQuery(...)` as a dangerous query location. This method usually runs JPQL, which is a Java object-style query language rather than raw SQL, but it can still be vulnerable if user input is pasted into the query text.

Where this appears in the sample app:

This exact method is modeled, but the current sample app does not call `EntityManager.createQuery(...)`.

Example of what this entry is meant to catch:

```java
String query = "from DoctypeShareFolderMapping where doctypeId = '" + doctype + "'";
em.createQuery(query);
```

Why it matters:

Even though JPQL is not raw SQL, the same basic problem exists: user text should not be pasted into query instructions. A parameterized query is safer.

## Entry 3: Hibernate Session JPQL Query

Model entry:

```yaml
["org.hibernate", "Session", false, "createQuery", "", "", "Argument[0]", "sql-injection", "manual"]
```

Plain-English meaning:

CodeQL should treat the first value passed to `org.hibernate.Session.createQuery(...)` as a dangerous query location. This covers applications that use Hibernate's `Session` API directly instead of JPA's `EntityManager` API.

Where this appears in the sample app:

This exact method is modeled, but the current sample app does not call `Session.createQuery(...)`.

Example of what this entry is meant to catch:

```java
String query = "from DoctypeShareFolderMapping where doctypeId = '" + doctype + "'";
session.createQuery(query);
```

Why it matters:

Hibernate queries can be unsafe when query text is assembled from user input. This entry helps CodeQL recognize that risk for the direct Hibernate API.

## Entry 4: Hibernate Session Native SQL Query

Model entry:

```yaml
["org.hibernate", "Session", false, "createNativeQuery", "", "", "Argument[0]", "sql-injection", "manual"]
```

Plain-English meaning:

CodeQL should treat the first value passed to `org.hibernate.Session.createNativeQuery(...)` as a dangerous database-query location. Like the JPA native-query method, this runs raw SQL.

Where this appears in the sample app:

This exact method is modeled, but the current sample app does not call `Session.createNativeQuery(...)`.

Example of what this entry is meant to catch:

```java
String sql = "SELECT * FROM doctype_sharefolder_mapping WHERE doctype_id = '" + doctype + "'";
session.createNativeQuery(sql);
```

Why it matters:

Raw SQL is powerful, but it is risky when user text is inserted directly into the command. This model entry helps CodeQL flag that pattern when the code uses Hibernate `Session` instead of JPA `EntityManager`.

## Entry 5: Quarkus Panache List Query

Model entry:

```yaml
["io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true, "list", "", "", "Argument[0]", "sql-injection", "manual"]
```

Plain-English meaning:

CodeQL should treat the first value passed to Panache `list(...)` as a dangerous query location. Panache is a Quarkus convenience layer for database access. Its query methods are shorter to write, but unsafe query text can still be a problem.

The `true` value means this model applies to subclasses of `PanacheEntityBase`, not only to the base class itself. In this app, `DoctypeShareFolderMapping` extends `PanacheEntityBase`, so the model applies to calls like `list(query)` inside that class.

Where this appears in the sample app:

- Source: the user supplies `doctype` in the HTTP request at [src/main/java/com/example/DoctypeShareFolderMappingResource.java](../src/main/java/com/example/DoctypeShareFolderMappingResource.java#L27).
- Data flow: the endpoint passes `doctype` into `findByDoctypePanacheUnsafe(...)` at [src/main/java/com/example/DoctypeShareFolderMappingResource.java](../src/main/java/com/example/DoctypeShareFolderMappingResource.java#L28).
- Query construction: the code pastes `doctype` directly into a Panache query string at [src/main/java/com/example/DoctypeShareFolderMapping.java](../src/main/java/com/example/DoctypeShareFolderMapping.java#L53).
- Sink: the completed query string is passed to `list(query)` at [src/main/java/com/example/DoctypeShareFolderMapping.java](../src/main/java/com/example/DoctypeShareFolderMapping.java#L55).

Simple flow:

```text
User request parameter "doctype"
  -> findPanacheUnsafe(doctype)
  -> findByDoctypePanacheUnsafe(doctype)
  -> Panache query string is built using that value
  -> list(query)
```

Why it matters:

The query looks shorter than raw SQL, but the risk is similar. User text is becoming part of the query instructions. The safer version calls `list("doctypeId", doctype)`, which passes the value separately.

## Entry 6: Quarkus Panache Find Query

Model entry:

```yaml
["io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true, "find", "", "", "Argument[0]", "sql-injection", "manual"]
```

Plain-English meaning:

CodeQL should treat the first value passed to Panache `find(...)` as a dangerous query location. This catches unsafe Panache lookup queries.

Where this appears in the sample app:

This exact method is modeled, but the current sample app does not call Panache `find(...)`.

Example of what this entry is meant to catch:

```java
String query = "doctypeId = '" + doctype + "'";
DoctypeShareFolderMapping.find(query);
```

Why it matters:

Panache `find(...)` is commonly used for quick database lookups. If the lookup query is assembled from user text, the query can be changed by the user. A parameterized form is safer.

## What The Current Results Show

The modeled CodeQL results show two actual unsafe flows in this sample application:

- `EntityManager.createNativeQuery(...)` receives a SQL string built from the `doctype` request parameter.
- Panache `list(...)` receives a query string built from the `doctype` request parameter.

The other four entries are still useful because they cover similar unsafe patterns that may appear in real Quarkus, JPA, or Hibernate codebases.

## Safe Pattern To Prefer

The safest pattern is to keep the query instructions separate from the user's value.

Risky pattern:

```java
String sql = "... WHERE doctype_id = '" + doctype + "'";
```

Safer pattern:

```java
em.createNativeQuery("... WHERE doctype_id = ?1", DoctypeShareFolderMapping.class)
        .setParameter(1, doctype);
```

For Panache, prefer passing the value separately instead of building the query text yourself:

```java
list("doctypeId", doctype);
```
