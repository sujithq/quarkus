---
on:
  workflow_dispatch:

permissions:
  contents: read

engine: copilot
network:
  allowed:
    - defaults
    - github
    - java

safe-outputs:
  create-pull-request:
    max: 1
    allowed-files:
      - docs/codeql-gap-analysis.md

---

# VERIFY CodeQL Model Pack (SQL Injection)

Validate that the generated CodeQL model pack improves SQL injection detection by reproducing the project's documented before/after CodeQL proof.

---

## Instructions

When this workflow is manually run:

---

### 1. Read input file

- docs/codeql-gap-analysis.md

---

### 2. Validate precondition

- Continue ONLY if:
  status: MODEL_GENERATED

- Otherwise:
  STOP

---

### 3. Branch behaviour (CRITICAL)

- Work on the existing branch created by DETECT
- Continue on the same pull request
- Do NOT create a new branch
- Do NOT create a new pull request
- All updates must be committed to the current branch

---

### 4. Identify target model file

Check:

.codeql/models/generated-sql-injection-sinks.yaml

If NOT present:
- STOP (nothing to verify)

---

### 5. Read the repository's existing verification proof

Use these files as the verification pattern:

- docs/jpa-and-quarkus-codeql-proof.md
- docs/codeql-modeling-notes.md
- qlpack.yml
- ql/src/quarkus-sinks.model.yml

The clean proof is:

- Baseline CodeQL run without a model pack reports the standard JPA control finding only.
- Reference modeled run with the existing `ql/src/quarkus-sinks.model.yml` pack reports the JPA control finding plus the Quarkus/Panache finding.
- Generated modeled run with `.codeql/models/generated-sql-injection-sinks.yaml` must report the same Quarkus/Panache finding as the reference model pack.

---

### 6. Perform executable CodeQL validation

Run the actual project verification. If the CodeQL CLI is not already available, install it into `.aw-verify/tools` before validating.

Required tools:

- Java
- Maven
- CodeQL CLI

Linux GitHub-hosted runners should already include Java and Maven. Maven still needs network access to resolve project dependencies from Maven Central during `mvn clean package` and `codeql database create`. The workflow network allowlist includes the `java` ecosystem for Maven Central and related Java package infrastructure.

The GitHub Actions execution environment may not have `codeql` on `PATH`. In that case, bootstrap the official CodeQL bundle locally and add it to `PATH` for the current shell session. Do not commit the downloaded tools. The workflow network allowlist includes the `github` ecosystem so GitHub release asset redirects are permitted.

On Linux runners, use:

```bash
mkdir -p .aw-verify/tools
curl -L https://github.com/github/codeql-action/releases/latest/download/codeql-bundle-linux64.tar.gz \
  -o .aw-verify/codeql-bundle-linux64.tar.gz
tar -xzf .aw-verify/codeql-bundle-linux64.tar.gz -C .aw-verify/tools
export PATH="$PWD/.aw-verify/tools/codeql:$PATH"
codeql version
```

If the bundle download or extraction fails, stop executable validation, record the exact failure, and set `status: VERIFICATION_BLOCKED`.

Commands to run:

1. Verify tools:

```bash
java -version
mvn -version
if ! command -v codeql >/dev/null 2>&1; then
  mkdir -p .aw-verify/tools
  curl -L https://github.com/github/codeql-action/releases/latest/download/codeql-bundle-linux64.tar.gz \
    -o .aw-verify/codeql-bundle-linux64.tar.gz
  tar -xzf .aw-verify/codeql-bundle-linux64.tar.gz -C .aw-verify/tools
  export PATH="$PWD/.aw-verify/tools/codeql:$PATH"
fi
codeql version
```

2. Build and create a fresh CodeQL database:

```bash
mvn clean package
codeql database create .aw-verify/db-quarkus --overwrite --language=java --command="mvn clean package"
```

3. Run baseline analysis without any model pack:

```bash
mkdir -p .aw-verify/results
codeql database analyze .aw-verify/db-quarkus codeql/java-queries --rerun --format=sarif-latest --output=.aw-verify/results/baseline.sarif
```

4. Run reference modeled analysis using the existing project model pack from `ql/src`:

```bash
codeql pack install
codeql database analyze .aw-verify/db-quarkus codeql/java-queries --model-packs=local/quarkus-models --additional-packs=. --rerun --format=sarif-latest --output=.aw-verify/results/reference-modeled.sarif
```

5. Run generated modeled analysis using `.codeql/models/generated-sql-injection-sinks.yaml`.

Create a temporary CodeQL pack under `.aw-verify/generated-pack` whose `qlpack.yml` references a copied version of the generated model file. Do not commit this temporary pack.

Example temporary pack shape:

```yaml
name: local/generated-quarkus-models
version: 0.0.1
library: true
extensionTargets:
  codeql/java-all: "*"
dataExtensions:
  - generated-sql-injection-sinks.yaml
```

Then run:

```bash
codeql pack install .aw-verify/generated-pack
codeql database analyze .aw-verify/db-quarkus codeql/java-queries --model-packs=local/generated-quarkus-models --additional-packs=.aw-verify/generated-pack --rerun --format=sarif-latest --output=.aw-verify/results/generated-modeled.sarif
```

---

### 7. Compare SARIF results

Compare all three SARIF files:

- .aw-verify/results/baseline.sarif
- .aw-verify/results/reference-modeled.sarif
- .aw-verify/results/generated-modeled.sarif

Expected result pattern:

- Baseline: 1 SQL injection result, the standard JPA control case.
- Reference modeled: 2 SQL injection results, JPA plus Quarkus/Panache.
- Generated modeled: 2 SQL injection results, JPA plus Quarkus/Panache.

The generated pack is verified only if the generated modeled run reports the Panache `list(query)` finding at `src/main/java/com/example/DoctypeShareFolderMapping.java` in addition to the JPA control finding.

If tools are unavailable or a command fails, do not claim verification succeeded. Record the failure, command, and observed output in the analysis document and set `status: VERIFICATION_BLOCKED`.

Also compare generated model rows with the observed findings. For each row in `.codeql/models/generated-sql-injection-sinks.yaml`, classify it as:

- proven: the generated modeled SARIF contains a repo-local finding that exercises the row's type/method intent
- unproven: the row loads successfully, but this repository does not contain an exercised vulnerable flow proving that specific row
- failed: the row was expected to prove an observed gap but no matching generated result appeared

At minimum, the Panache `PanacheEntityBase.list Argument[0]` row must be proven by the generated modeled SARIF result at `src/main/java/com/example/DoctypeShareFolderMapping.java`.

---

### 8. Classify validation confidence

- high:
  - baseline/reference/generated SARIF comparison matches the expected pattern
  - generated model pack reports the same Panache finding as the `ql/src` reference pack

- medium:
  - generated model pack loads and produces an additional SQL injection result, but the exact location differs from the reference proof

- low:
  - generated model pack structure matches the expected sink, but executable validation could not be completed

---

### 9. Update analysis file

Append to:

docs/codeql-gap-analysis.md

---

### 10. Append content (STRICT)

## Validation Results

### Summary

- Generated model file applied: <yes | no>
- Executable CodeQL validation: <passed | blocked | failed>
- Reference `ql/src` proof compared: <yes | no>

### Baseline: No Model Pack

- Result count: <number>
- Expected: JPA control finding only
- Panache finding present: <yes | no>

### Reference: Existing `ql/src` Model Pack

- Result count: <number>
- Expected: JPA control finding plus Panache finding
- Panache finding present: <yes | no>

### Generated Model Pack

- Result count: <number>
- Expected: JPA control finding plus Panache finding
- Panache finding present: <yes | no>
- Generated sink exercised: <Class.method>

### Generated Row Proof

```yaml
verify_result:
  status: <VERIFIED | VERIFICATION_BLOCKED | VERIFICATION_FAILED>
  baseline_count: <number>
  reference_count: <number>
  generated_count: <number>
  generated_matches_reference: <true | false>
  proven_generated_rows:
    - <Package.Type.method Argument[n]>
  unproven_generated_rows:
    - <Package.Type.method Argument[n]>
  failed_generated_rows:
    - <Package.Type.method Argument[n]>
```

### Validation Confidence

- <high | medium | low>

status: <VERIFIED | VERIFICATION_BLOCKED | VERIFICATION_FAILED>
next: <COMPLETE | FIX_GENERATED_MODEL | RERUN_WITH_TOOLING>

---

### 11. Submit changes

- If validation results were added:
  - use the create-pull-request safe output
  - include the updated docs/codeql-gap-analysis.md file
  - do NOT use noop after updating files

- Use noop ONLY when:
  - precondition not met
  - OR no model file exists

---

## Constraints

- Do execute the real CodeQL comparison; install CodeQL CLI locally first when it is missing from `PATH`
- Do NOT commit `.aw-verify` or other temporary verification files
- Do NOT modify model files
- Do NOT introduce new sinks
- Only validate what was generated
- Do NOT report `status: VERIFIED` unless executable CodeQL validation ran and the generated model proves the observed gap

---

## Success Criteria

- docs/codeql-gap-analysis.md updated with:
  - Validation Results section
  - Generated Row Proof section
  - status: VERIFIED
  - next: COMPLETE

- No new PR created
- Existing PR updated with final validation