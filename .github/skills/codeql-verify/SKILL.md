---
name: codeql-verify
description: Run executable CodeQL three-way validation (baseline / reference / generated) and append a `verify_result` block to the analysis doc. Mirrors `.github/workflows/verify-model-pack.md`.
---

# Skill: codeql-verify

Canonical source: [.github/workflows/verify-model-pack.md](../../workflows/verify-model-pack.md).

## When to use

After codeql-propose set `status: MODEL_GENERATED` and `next: VERIFY`.

## Precondition

`docs/codeql-gap-analysis.md` contains `status: MODEL_GENERATED` AND `.codeql/models/generated-sql-injection-sinks.yaml` exists. Otherwise STOP.

## Required tools

Java, Maven, CodeQL CLI. If `codeql` is not on `PATH`, bootstrap the bundle locally into `.aw-verify/tools` (do NOT commit). On Windows hosts use the matching `codeql-bundle-win64.zip`. Confirm each external command before running it.

```bash
mkdir -p .aw-verify/tools
curl -L https://github.com/github/codeql-action/releases/latest/download/codeql-bundle-linux64.tar.gz \
  -o .aw-verify/codeql-bundle-linux64.tar.gz
tar -xzf .aw-verify/codeql-bundle-linux64.tar.gz -C .aw-verify/tools
export PATH="$PWD/.aw-verify/tools/codeql:$PATH"
codeql version
```

If bootstrap fails: stop, record the failure, set `status: VERIFICATION_BLOCKED`.

## Procedure

1. **Build + DB**:
   ```bash
   mvn clean package
   codeql database create .aw-verify/db-quarkus --overwrite --language=java --command="mvn clean package"
   ```
2. **Baseline** (no pack):
   ```bash
   mkdir -p .aw-verify/results
   codeql database analyze .aw-verify/db-quarkus codeql/java-queries --rerun \
     --format=sarif-latest --output=.aw-verify/results/baseline.sarif
   ```
3. **Reference** (existing `ql/src` pack):
   ```bash
   codeql pack install
   codeql database analyze .aw-verify/db-quarkus codeql/java-queries \
     --model-packs=local/quarkus-models --additional-packs=. --rerun \
     --format=sarif-latest --output=.aw-verify/results/reference-modeled.sarif
   ```
4. **Generated** — copy `.codeql/models/generated-sql-injection-sinks.yaml` into a throwaway `.aw-verify/generated-pack/` with:
   ```yaml
   name: local/generated-quarkus-models
   version: 0.0.1
   library: true
   extensionTargets:
     codeql/java-all: "*"
   dataExtensions:
     - generated-sql-injection-sinks.yaml
   ```
   Then:
   ```bash
   codeql pack install .aw-verify/generated-pack
   codeql database analyze .aw-verify/db-quarkus codeql/java-queries \
     --model-packs=local/generated-quarkus-models --additional-packs=.aw-verify/generated-pack --rerun \
     --format=sarif-latest --output=.aw-verify/results/generated-modeled.sarif
   ```

## Expected pattern (this repo)

- Baseline: 4 results (JPA/Hibernate controls)
- Reference: 6 results (controls + Panache)
- Generated: 6 results (controls + Panache, including `PanacheEntityBase.list` and `PanacheEntityBase.find` at `src/main/java/com/example/DoctypeShareFolderMapping.java`)

## Row classification

For each row in the generated pack:

- `proven` — generated SARIF has a repo-local finding for the row's type/method
- `unproven` — row loads but repo has no exercising flow
- `failed` — row was expected to prove an observed gap but no matching result appeared

Minimum proven rows: both Panache `list` and `find` Argument[0].

## Output — append to `docs/codeql-gap-analysis.md`

```markdown
## Validation Results

### Summary
- Generated model file applied: yes
- Executable CodeQL validation: <passed | blocked | failed>
- Reference `ql/src` proof compared: yes

### Baseline: No Model Pack
- Result count: <n>
- Panache finding present: <yes | no>

### Reference: Existing `ql/src` Model Pack
- Result count: <n>
- Panache finding present: <yes | no>

### Generated Model Pack
- Result count: <n>
- Panache finding present: <yes | no>
- Generated sink exercised: <Class.method>

### Generated Row Proof

```yaml
verify_result:
  status: <VERIFIED | VERIFICATION_BLOCKED | VERIFICATION_FAILED>
  baseline_count: <n>
  reference_count: <n>
  generated_count: <n>
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
```

## Confidence rules

- **high** — three-way SARIF pattern matches expected AND every generated row with a repo-local flow is proven.
- **medium** — generated pack loads and adds a SQL-injection result, but location differs from the reference proof.
- **low** — pack structure looks correct, but executable validation could not run.

## Constraints

- DO execute the real comparison. Never claim VERIFIED without it.
- Do NOT commit `.aw-verify`.
- Do NOT modify model files or queries.

## Done when

`docs/codeql-gap-analysis.md` has the Validation Results section, a `verify_result` YAML block, and ends with `status: VERIFIED` / `next: COMPLETE`.
