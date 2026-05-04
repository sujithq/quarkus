# Quarkus, Panache, JPA, and Hibernate For .NET Developers

## Why This Document Exists

This project uses Java technologies that map loosely to concepts you may know from .NET:

1. Quarkus
2. Jakarta REST
3. JPA / Jakarta Persistence
4. Hibernate ORM
5. Panache

The names can be confusing because they sit at different layers. The CodeQL proof depends on understanding which layer owns the vulnerable API.

## Quick Mental Model

| Java / Quarkus Term | Rough .NET Analogy | What It Does |
| --- | --- | --- |
| Quarkus | ASP.NET Core host/runtime | Application framework and runtime optimized for cloud/native Java apps |
| Jakarta REST / JAX-RS | ASP.NET Core MVC / Minimal APIs | Defines HTTP endpoints, route attributes, query params, request handling |
| `@QueryParam` | `[FromQuery]` / query string binding | Binds HTTP query string input into a method parameter |
| JPA / Jakarta Persistence | Entity Framework abstraction concepts | Standard Java persistence API: entities, entity manager, queries |
| `EntityManager` | Roughly `DbContext`, but lower-level | Creates and executes persistence queries |
| Hibernate ORM | Entity Framework Core provider/ORM engine | Actual ORM implementation commonly used behind JPA |
| Panache | EF-style convenience/repository helpers | Quarkus convenience API on top of Hibernate ORM |

The analogy is not perfect, but it is good enough for security-scanning discussions.

## The Stack In One Picture

```text
HTTP request
  -> Quarkus application runtime
  -> Jakarta REST resource method
  -> @QueryParam binds user input
  -> Application/entity/repository method
  -> Persistence API
       Option A: direct JPA EntityManager
       Option B: Quarkus Panache helper
  -> Hibernate ORM
  -> Database
```

## What Is Quarkus?

Quarkus is the application framework/runtime.

In .NET terms, think of it as being closer to ASP.NET Core plus hosting/runtime conventions. It provides dependency injection, HTTP endpoint hosting, build-time optimization, configuration, native-image support, and integrations with persistence libraries.

In this POC, Quarkus is visible in two places:

```java
import io.quarkus.arc.Arc;
```

and:

```java
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
```

`Arc` is Quarkus dependency injection. `PanacheEntityBase` is a Quarkus persistence convenience base class.

## What Is Jakarta REST?

Jakarta REST, also known as JAX-RS, is the Java API used to define REST endpoints.

In .NET terms, this is similar to controller actions or Minimal API handlers.

Example from this project:

```java
@GET
@Path("/panache-unsafe")
public List<DoctypeShareFolderMapping> findPanacheUnsafe(@QueryParam("doctype") String doctype) {
    return DoctypeShareFolderMapping.findByDoctypePanacheUnsafe(doctype);
}
```

The relevant pieces are:

1. `@GET`: this handles an HTTP GET request.
2. `@Path("/panache-unsafe")`: this is the route segment.
3. `@QueryParam("doctype")`: this binds `?doctype=value` from the URL.

.NET-ish equivalent:

```csharp
[HttpGet("panache-unsafe")]
public IActionResult FindPanacheUnsafe([FromQuery] string doctype)
{
    return Ok(DoctypeShareFolderMapping.FindByDoctypePanacheUnsafe(doctype));
}
```

From a CodeQL perspective, `@QueryParam("doctype") String doctype` is the user-controlled source.

## What Is JPA / Jakarta Persistence?

JPA stands for Java Persistence API. The modern name is Jakarta Persistence.

It is a standard API, not Quarkus-specific.

In .NET terms, it is closest to persistence abstractions you use around Entity Framework, but with Java-specific concepts and APIs.

The important JPA type in this POC is:

```java
jakarta.persistence.EntityManager
```

`EntityManager` can create and execute queries.

Example:

```java
EntityManager em = Arc.container()
        .instance(EntityManager.class)
        .get();

String sql = "SELECT * FROM doctype_sharefolder_mapping WHERE doctype_id = '" + doctype + "'";

return (DoctypeShareFolderMapping) em
        .createNativeQuery(sql, DoctypeShareFolderMapping.class)
        .getSingleResult();
```

The dangerous sink is:

```java
em.createNativeQuery(sql, DoctypeShareFolderMapping.class)
```

This is similar in spirit to raw SQL APIs in .NET, for example:

```csharp
context.Database.SqlQueryRaw<DoctypeShareFolderMapping>(sql)
```

or old-style raw command execution:

```csharp
command.CommandText = sql;
command.ExecuteReader();
```

The key point: this sink is JPA, not Quarkus/Panache. CodeQL already knows this JPA API.

## What Is Hibernate ORM?

Hibernate ORM is the ORM implementation.

In .NET terms, if JPA is the standard abstraction, Hibernate is like the concrete ORM engine/provider doing the real work underneath.

Quarkus commonly uses Hibernate ORM for persistence. Panache is a Quarkus convenience layer built on top of Hibernate ORM.

So the stack is roughly:

```text
JPA API
  -> Hibernate ORM implementation
  -> Database
```

or, with Panache:

```text
Panache helper
  -> Hibernate ORM
  -> Database
```

## What Is Panache?

Panache is a Quarkus-specific convenience API for persistence.

It reduces boilerplate around common entity and repository operations.

In this project, the entity extends:

```java
public class DoctypeShareFolderMapping extends PanacheEntityBase
```

That inheritance gives the entity helper methods like:

```java
list(...)
find(...)
stream(...)
```

The Panache vulnerable method is:

```java
public static List<DoctypeShareFolderMapping> findByDoctypePanacheUnsafe(String doctype) {
    String query = "doctypeId = '" + doctype + "'";

    return list(query);
}
```

.NET-ish equivalent:

```csharp
public static List<DoctypeShareFolderMapping> FindByDoctypeUnsafe(string doctype)
{
    var whereClause = "doctypeId = '" + doctype + "'";
    return Repository.List(whereClause);
}
```

The important difference is that CodeQL already knew the JPA raw SQL API, but did not report this Panache `list(query)` case until we taught it that `PanacheEntityBase.list(Argument[0])` should be treated as a SQL/HQL injection sink.

## Why The First Example Is Not Really A Quarkus Gap

The direct example is:

```java
em.createNativeQuery(sql, DoctypeShareFolderMapping.class)
```

Even though the code runs in Quarkus, the vulnerable sink is standard JPA.

CodeQL baseline detected it:

```text
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:35:36
```

So this proves:

```text
CodeQL already supports this standard JPA sink.
```

It does not prove a Quarkus modeling gap.

## Why The Panache Example Is The Quarkus Proof

The Panache example is:

```java
return list(query);
```

That `list` method comes from:

```java
io.quarkus.hibernate.orm.panache.PanacheEntityBase.list
```

Baseline CodeQL did not report it.

After adding this model pack entry:

```yaml
- ["io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true,
   "list", "", "", "Argument[0]", "sql-injection", "manual"]
```

CodeQL reported the Panache issue:

```text
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:55:29
```

This proves:

```text
CodeQL could already track the user input.
The missing part was framework-specific sink knowledge.
The model pack supplied that knowledge.
The standard SQL injection query then reported the issue.
```

## How This Maps To CodeQL Concepts

CodeQL SQL injection detection needs two main things:

1. A source: where untrusted data enters the program.
2. A sink: where that data becomes dangerous.

In this POC:

| CodeQL Concept | JPA Case | Panache Case |
| --- | --- | --- |
| Source | `@QueryParam("doctype")` | `@QueryParam("doctype")` |
| Flow | Method call into entity helper | Method call into entity helper |
| Sink | `EntityManager.createNativeQuery(sql, ...)` | `PanacheEntityBase.list(query)` |
| Baseline result | Detected | Missed |
| With model pack | Detected | Detected |

The model pack only changes sink knowledge for Panache. It does not change the application and it does not replace CodeQL's SQL injection query.

## Simple Explanation For Customers

Use this:

> Quarkus is the application framework. JPA is the standard persistence API. Hibernate is the ORM implementation. Panache is a Quarkus convenience layer on top of Hibernate. In our test, CodeQL already detected the direct JPA raw-query sink. The gap appeared when the query went through the Quarkus/Panache helper `list(query)`. By adding a model pack entry for `PanacheEntityBase.list(Argument[0])`, we taught CodeQL that this framework helper is also a SQL/HQL execution sink. The standard CodeQL SQL injection query then detected the vulnerability.

## One-Line Version

```text
JPA direct raw query = already known by CodeQL.
Quarkus/Panache helper query = needs extra framework modeling.
```

## Practical Takeaway

For rollout discussions:

1. Do not describe every Quarkus finding as unsupported by CodeQL.
2. Separate standard Java/JPA/Hibernate APIs from Quarkus/Panache convenience APIs.
3. Use baseline CodeQL to prove what is already covered.
4. Use model packs for project-specific or framework-specific APIs that baseline misses.
5. Promote only validated model entries to an organization-level model pack.