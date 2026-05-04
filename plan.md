## Plan: Bootstrap Quarkus CodeQL Sink Modeling

Set up a minimal Quarkus app and a dedicated CodeQL model pack in this empty workspace, then validate SQL-injection detection by proving a before/after result (no alert before modeling, alert after sink modeling). The primary investigation target is `findByDoctypeUnsafe(String doctype)`, where concatenated user input flows into `EntityManager.createNativeQuery(sql, DoctypeShareFolderMapping.class)`; this starts with EntityManager/Hibernate sinks and expands to Panache in a controlled second pass.

**Steps**
1. Phase 1 - Workspace bootstrap
1. Create a minimal Quarkus Maven project skeleton in the repo root with source, test, and build files. This gives CodeQL analyzable Java bytecode and realistic framework usage.
1. Add one intentionally vulnerable demo endpoint/service path that mirrors your real case: `findByDoctypeUnsafe(String doctype)` builds SQL by string concatenation and calls `EntityManager.createNativeQuery(sql, DoctypeShareFolderMapping.class)`; also include `createQuery` coverage for parity.
1. Add optional second vulnerable path using Hibernate Session.createQuery/createNativeQuery if Hibernate API is directly available.
1. Phase 2 - Baseline CodeQL run (before custom model)
1. Create CodeQL database from Maven build and run standard Java security queries without custom model. Capture baseline SARIF as evidence that the Quarkus-specific sink is currently missed or under-reported.
1. Save baseline artifacts and note exact query IDs and file locations for comparison.
1. Phase 3 - Model pack creation
1. Initialize a dedicated model pack (org-scoped naming) and set dependencies on codeql/java-all.
1. Add model file defining sinkModel entries for:
1. jakarta.persistence EntityManager createNativeQuery Argument[0]
1. jakarta.persistence EntityManager createQuery Argument[0]
1. org.hibernate Session createQuery Argument[0]
1. org.hibernate Session createNativeQuery Argument[0]
1. Keep Panache modeling out of the first pass unless baseline POC already succeeds.
1. Phase 4 - Analyze with custom model
1. Run CodeQL analysis using both the model pack and Java query pack.
1. Generate SARIF output dedicated to modeled run and compare against baseline.
1. Confirm expected alert: user-controlled data flow into createNativeQuery (and createQuery where applicable).
1. Phase 5 - Debug and harden
1. If expected alert is missing, run a method-visibility query to confirm createNativeQuery/createQuery calls are recognized.
1. Run taint-flow inspection query to validate source-to-sink flow shape.
1. Correct model tuple details (package/type/method/Argument index/kind) and rerun until deterministic detection is achieved.
1. Phase 6 - Incremental expansion
1. Add Panache sink candidates in a separate model file or separate commit to isolate precision impacts.
1. Validate Panache additions against false positives and missed cases before promoting to shared org model pack.
1. Document coverage matrix (modeled API, expected sink, confirmed query IDs, known gaps).

**Relevant files**
- c:/Users/squintelier/tmp/quarkus/pom.xml - Maven build and dependencies for Quarkus + JPA/Hibernate used by the POC.
- c:/Users/squintelier/tmp/quarkus/src/main/java/... - vulnerable and control-path Java code used to validate detection behavior.
- c:/Users/squintelier/tmp/quarkus/qlpack.yml - model pack metadata and dependencies.
- c:/Users/squintelier/tmp/quarkus/ql/src/quarkus-sinks.model.yml - sinkModel tuples for Quarkus/JPA/Hibernate APIs.
- c:/Users/squintelier/tmp/quarkus/debug/qlpack.yml - separate query pack for debug queries that need `codeql/java-all` dependencies.
- c:/Users/squintelier/tmp/quarkus/debug/src/debug-methods.ql - temporary call-discovery query for method visibility checks.
- c:/Users/squintelier/tmp/quarkus/debug/src/debug-native-query-arguments.ql - temporary query that verifies `createNativeQuery` receives SQL at `Argument[0]`.
- c:/Users/squintelier/tmp/quarkus/results/baseline.sarif - pre-model analysis output.
- c:/Users/squintelier/tmp/quarkus/results/modeled.sarif - post-model analysis output.
- c:/Users/squintelier/tmp/quarkus/docs/codeql-modeling-notes.md - decisions, coverage, and customer-facing explanation.

**Verification**
1. Build succeeds locally with Maven and produces compilable bytecode.
2. CodeQL database creation succeeds against the Maven build.
3. Baseline run produces SARIF and does not yet prove the target Quarkus sink path strongly.
4. Modeled run produces SARIF with the expected SQL injection alert(s) for the exact path `findByDoctypeUnsafe(String doctype)` -> concatenated `sql` -> `createNativeQuery(sql, DoctypeShareFolderMapping.class)` (and `createQuery` where applicable).
5. Debug queries confirm method calls are visible and taint flows reach modeled sinks.
6. Side check: no large spike of unrelated SQL-injection false positives after adding sinks.


**Signature Checklist**
1. Package must match exactly in sink tuple (`jakarta.persistence` for `EntityManager`, `org.hibernate` for `Session`), with no `javax`/`jakarta` mix-up.
2. Declaring type must be the concrete owner expected by CodeQL dispatch (`EntityManager`, `Session`); if using interfaces vs impls, verify call target resolution with debug query before changing tuples.
3. Method name must match exactly (`createNativeQuery`, `createQuery`) with correct case.
4. Overload handling: ensure the model covers the overload used in code (`createNativeQuery(String, Class)` in your target flow) and does not assume only one-arg signatures.
5. Argument index must match the tainted SQL carrier (`Argument[0]`), even for two-arg overloads; do not shift index because of result class parameter.
6. Sink kind must align to query suite expectations (`sql-injection`) so existing Java SQL injection queries consume the model.
7. Source type / static flag field in tuple must match member form (instance method for `EntityManager`/`Session`, not static).
8. If no hit appears, validate tuple against observed callsite metadata from debug queries before broadening sinks.

**Known Mismatch Patterns**
1. Namespace drift (javax vs jakarta):
Wrong: ["javax.persistence", "EntityManager", false, "createNativeQuery", "", "", "Argument[0]", "sql-injection", "manual"]
Right: ["jakarta.persistence", "EntityManager", false, "createNativeQuery", "", "", "Argument[0]", "sql-injection", "manual"]
2. Wrong declaring type for actual call target:
Wrong: ["io.quarkus.hibernate.orm.panache", "PanacheEntityBase", false, "createNativeQuery", "", "", "Argument[0]", "sql-injection", "manual"]
Right: ["jakarta.persistence", "EntityManager", false, "createNativeQuery", "", "", "Argument[0]", "sql-injection", "manual"]
3. Overload confusion with two-arg createNativeQuery:
Wrong assumption: model only one-arg usage and miss call createNativeQuery(sql, DoctypeShareFolderMapping.class)
Right handling: keep sink on method createNativeQuery with Argument[0] so SQL string is modeled for both one-arg and two-arg overload usage seen in code.
4. Argument index shift due to result class parameter:
Wrong: Argument[1]
Right: Argument[0] (the tainted SQL string)
5. Sink kind typo or mismatch:
Wrong: "command-injection" or custom unsupported kind
Right: "sql-injection" to align with Java SQL injection query expectations
6. Static flag mismatch:
Wrong: true for EntityManager or Session query methods
Right: false, because these are instance methods


**Implementation Status**
1. Created Maven Quarkus POC with the exact target flow in `DoctypeShareFolderMapping.findByDoctypeUnsafe(String doctype)`.
2. Created REST source path using `@QueryParam("doctype")` in `DoctypeShareFolderMappingResource.findUnsafe(...)`.
3. Created safe comparator path using parameter binding to help distinguish vulnerable vs safe native-query usage.
4. Created CodeQL model pack metadata in `qlpack.yml`.
5. Created JPA/Hibernate sink tuples in `ql/src/quarkus-sinks.model.yml`.
6. Created debug queries for call-target discovery and `Argument[0]` SQL argument verification.
7. Created execution notes in `docs/codeql-modeling-notes.md`.
8. Local validation completed with Java 17, Maven 3.9.15, and CodeQL CLI 2.25.2.
9. Maven build succeeded and CodeQL database creation succeeded.
10. Baseline SARIF and modeled SARIF both report `java/sql-injection` at `src/main/java/com/example/DoctypeShareFolderMapping.java:34:36` for the exact target flow.
11. Key finding: current CodeQL already models `jakarta.persistence.EntityManager.createNativeQuery(sql, Class)`, so this exact JPA case is a control case rather than a before/after model-only demo.
12. Debug queries confirm `createNativeQuery` resolves to `jakarta.persistence.EntityManager.createNativeQuery` and the SQL expression is `Argument[0]`.

**Validated Commands**
1. `mvn clean package`
2. `codeql database create db-quarkus --overwrite --language=java --command="mvn clean package"`
3. `codeql database analyze db-quarkus codeql/java-queries --format=sarif-latest --output=results/baseline.sarif`
4. `codeql database analyze db-quarkus codeql/java-queries --model-packs=local/quarkus-models --additional-packs=. --rerun --format=sarif-latest --output=results/modeled.sarif`
5. `codeql query run debug/src/debug-methods.ql --database=db-quarkus --additional-packs=debug`
6. `codeql query run debug/src/debug-native-query-arguments.ql --database=db-quarkus --additional-packs=debug`


**Decisions**
- Included now: end-to-end POC from empty folder through repeatable detection proof using JPA/Hibernate sinks.
- Deferred to next iteration: deep Panache modeling and custom repository/DAO abstractions.
- Recommended packaging: keep model pack and app sample in same repo initially for fast iteration; split later into reusable org pack once stable.

**Further Considerations**
1. Project bootstrap choice: Quarkus CLI generation vs minimal hand-written Maven skeleton. Recommendation: Quarkus CLI if available for realistic defaults; fallback to hand-written skeleton.
2. Packaging strategy after POC: separate repository for organization-wide model pack vs monorepo subfolder. Recommendation: separate repo after first successful validated version.
3. Demo quality: whether to include before/after SARIF diff script. Recommendation: yes, to strengthen customer demo reproducibility.