# Quarkus CodeQL Sink Modeling Notes

## Target Flow

The primary proof case is `DoctypeShareFolderMapping.findByDoctypeUnsafe(String doctype)`.

The tainted value comes from `DoctypeShareFolderMappingResource.findUnsafe(@QueryParam("doctype") String doctype)`, flows into string concatenation, and reaches:

```java
em.createNativeQuery(sql, DoctypeShareFolderMapping.class)
```

The sink is the SQL string at `Argument[0]`. The result class parameter is `Argument[1]` and must not be modeled as the SQL sink.

## Runbook

Prerequisites:

1. Java 17 or later on `PATH`.
2. Maven on `PATH`.
3. CodeQL CLI on `PATH`.

Build the project:

```powershell
mvn clean package
```

Create the CodeQL database:

```powershell
codeql database create db-quarkus --overwrite --language=java --command="mvn clean package"
```

Run baseline analysis without the model pack:

```powershell
New-Item -ItemType Directory -Force results | Out-Null
codeql database analyze db-quarkus codeql/java-queries --format=sarif-latest --output=results/baseline.sarif
```

Install the model pack dependencies:

```powershell
codeql pack install
```

Run modeled analysis:

```powershell
codeql database analyze db-quarkus codeql/java-queries --model-packs=local/quarkus-models --additional-packs=. --rerun --format=sarif-latest --output=results/modeled.sarif
```

## Debug Queries

Confirm CodeQL sees the call target:

```powershell
codeql query run debug/src/debug-methods.ql --database=db-quarkus --additional-packs=debug
```

Confirm the SQL argument is the first argument:

```powershell
codeql query run debug/src/debug-native-query-arguments.ql --database=db-quarkus --additional-packs=debug
```

## Validated Result

Validation was run with CodeQL CLI 2.25.2, Java 17, and Maven 3.9.15.

Baseline analysis already reports the target issue:

```text
results/baseline.sarif
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:34:36 This query depends on a user-provided value.
```

Modeled analysis with `--model-packs=local/quarkus-models` reports the same target issue:

```text
results/modeled.sarif
java/sql-injection src/main/java/com/example/DoctypeShareFolderMapping.java:34:36 This query depends on a user-provided value.
```

Important interpretation: the exact `jakarta.persistence.EntityManager.createNativeQuery(sql, Class)` sink is already covered by the current CodeQL Java queries. The custom model pack is valid and loads successfully, but this specific JPA sink no longer provides a before/after demo because the baseline already detects it.

For a stronger customer demo, keep this as the control case and add a genuinely unmodeled Quarkus/Panache/custom repository wrapper as the model-only case.

Debug query results confirmed:

```text
createNativeQuery(...) -> jakarta.persistence.EntityManager.createNativeQuery
sql -> Argument[0]
"SELECT * FROM doctype_sharefolder_mapping WHERE doctype_id = ?1" -> Argument[0]
```

## Success Criteria

Modeled analysis should report SQL injection for the flow:

```text
@QueryParam("doctype") -> findByDoctypeUnsafe(String doctype) -> sql concatenation -> createNativeQuery(sql, DoctypeShareFolderMapping.class)
```

If no alert appears, first run the debug queries and compare the observed package/type/method metadata to `ql/src/quarkus-sinks.model.yml`.