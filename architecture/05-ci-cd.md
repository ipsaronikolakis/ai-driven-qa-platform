# CI/CD

This document describes the GitHub Actions workflow — triggers, jobs, individual steps, artifacts, PR comment contents, and what can block a merge.

---

## Workflow File

`.github/workflows/qa-pipeline.yml`

---

## CI/CD Flow

```mermaid
flowchart TD
    T1(["push"]) & T2(["pull_request"]) & T3(["workflow_dispatch"])

    T1 & T2 & T3 --> J1

    subgraph J1 ["Job 1 — Unit Tests · ubuntu-latest"]
        U1["checkout + Node 22 + npm ci"]
        U2["playwright install chromium"]
        U3["npm run test:unit"]
        U1 --> U2 --> U3
    end

    J1 -->|"❌ fail"| STOP(["Pipeline stopped\nno further jobs run"])
    J1 -->|"✅ pass"| J2

    subgraph J2 ["Job 2 — QA Pipeline · ubuntu-latest"]
        Q1["checkout + Node 22 + npm ci\nplaywright install chromium"]
        Q2["npm run lint:scenarios"]
        Q3["npm run fresh\nGEMINI_API_KEY optional"]
        Q4[("Upload playwright-report\nalways · 30 days")]
        Q5[("Upload failure-analysis\non failure · 30 days")]
        Q6["npm run selector-report\nnon-blocking"]
        Q7[("Upload selector-health.html\nalways · ignore if missing")]
        Q8{"pull_request\nevent?"}
        Q9["Post PR comment\ngithub-script"]
        DONE(["Done"])

        Q1 --> Q2 --> Q3
        Q3 --> Q4
        Q3 -->|"on failure"| Q5
        Q4 --> Q6 --> Q7 --> Q8
        Q8 -->|yes| Q9 --> DONE
        Q8 -->|no| DONE
    end

    DONE --> RESULT{"Exit\ncode?"}
    RESULT -->|"0"| PASS(["✅ PR can merge"])
    RESULT -->|"1"| FAIL(["❌ PR blocked"])
```

---

## Triggers

```yaml
on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]
  workflow_dispatch:
```

| Trigger | When it fires |
|---------|--------------|
| `push` | Any commit pushed to any branch |
| `pull_request` | Any PR opened or updated against any branch |
| `workflow_dispatch` | Manual trigger from the GitHub Actions UI |

---

## Job 1: Unit Tests

**Runs on:** `ubuntu-latest`

### Steps

1. **Checkout** — `actions/checkout@v6`
2. **Node setup** — `actions/setup-node@v6`, Node 22, npm cache enabled
3. **Install dependencies** — `npm ci`
4. **Install Playwright browsers** — `npx playwright install --with-deps chromium`
5. **Run unit tests** — `npm run test:unit`

### What `test:unit` Covers

Unit tests live under `src/*/tests/` and cover:

- `bdd-parser` — parser edge cases (malformed Gherkin, missing steps, multi-scenario files)
- `vocabulary` — term matching correctness, partial match ranking
- `planner` — determinism of the vocabulary-only path
- `code-generator` — generated spec structure and provenance header injection
- `analyzer` — failure categorisation logic
- `app-explorer` — selector priority chain, uniqueness checks, browser cleanup

---

## Job 2: QA Pipeline

**Runs on:** `ubuntu-latest`

**Needs:** `unit-tests` — this job only starts if Job 1 passes.

### Steps

1. **Checkout + Node setup + npm ci + Playwright install** — same as Job 1 steps 1–4

2. **Lint scenarios** — `npm run lint:scenarios`
   - Validates all `.feature` files against the vocabulary
   - Fails the job if any unrecognised steps are found

3. **Run full pipeline** — `npm run fresh`
   - Bypasses all caches for a clean CI run
   - `GEMINI_API_KEY` is read from Actions secrets if set (see below)
   - Vocabulary-only scenarios bypass Gemini entirely — the key is not required for them
   - Exits 1 if any generated spec fails

4. **Upload Playwright report artifact**
   - Path: `playwright-report/`
   - Uploaded: always
   - Retention: 30 days

5. **Upload failure analysis artifact**
   - Path: `output/failure-analysis.json`
   - Uploaded: on failure only
   - Retention: 30 days

6. **Generate selector health report** — `npm run selector-report || true`
   - Non-blocking: the `|| true` means a non-zero exit does not fail the job
   - Writes `output/selector-health.html`

7. **Upload selector health HTML artifact**
   - Path: `output/selector-health.html`
   - Uploaded: always, with `continue-on-error: true` in case the file was not produced
   - Retention: 30 days

8. **Post PR comment** — runs only on `pull_request` events (see below)

---

## PR Comment Contents

When the workflow runs on a pull request, a comment is posted automatically. The comment is regenerated on each push to the PR.

```mermaid
flowchart TD
    SCRIPT(["github-script\nreads output files"])

    SCRIPT --> C1[/"playwright-results.json\n→ status badge + counts table"/]
    C1 --> C2{"Any\nfailures?"}
    C2 -->|yes| C3[/"failure-analysis.json\n→ category + suggestion\nper failure"/]
    C2 -->|no| C4
    C3 --> C4{"Unstable selectors?\nfail rate > 20%"}
    C4 -->|yes| C5[/"selector-health.json\n→ unstable selector list"/]
    C4 -->|no| C6
    C5 --> C6{"HEALED comments\nin src/actions/index.ts?"}
    C6 -->|yes| C7[/"scan for // HEALED: lines\n→ list for human review"/]
    C6 -->|no| C8
    C7 --> C8["Append workflow run link"]
    C8 --> POST(["Post comment on PR"])
```

### Status Section

```
✅ PASSED   or   ❌ FAILED

| Total | Passed | Failed | Skipped |
|-------|--------|--------|---------|
|   N   |   N    |   N    |    N    |
```

### Failure Analysis Section

Included only when one or more specs fail.

For each failure:
```
[category] <error summary>
Suggestion: <suggested fix>
```

Categories map to the values written by `analyzeFailures()` into `output/failure-analysis.json`.

### Unstable Selectors Section

Lists any selector from `output/selector-health.json` with a fail rate above 20%.

```
Unstable selectors detected:
- <selector> (fail rate: X%)
```

### [HEALED] Selectors Section

Lists selectors that carry a `// HEALED:` annotation in `src/actions/index.ts`. These were replaced by the healing engine and are flagged here for human review before merging.

```
[HEALED] selectors found in src/actions/index.ts — please review before merging:
- <old selector> → <new selector>
```

### Workflow Link

A link to the full workflow run is included at the bottom of every comment.

---

## GEMINI_API_KEY Handling

The key is provided as a GitHub Actions secret:

```
Repository Settings → Secrets and variables → Actions → New repository secret
Name: GEMINI_API_KEY
```

- Not required for vocabulary-only scenarios — the deterministic resolver handles those without an API call
- Required only when a BDD step in a scenario does not match any vocabulary entry and must be resolved by the LLM (Stage 3 LLM pass)
- If the key is absent and an LLM call is attempted, Stage 3 will error and the pipeline exits 1

---

## What Blocks a PR Merge

| Condition | Blocks merge? |
|-----------|--------------|
| Any unit test failure (Job 1) | Yes |
| Any generated spec failure (`npm run fresh` exits 1) | Yes |
| Lint failures (`npm run lint:scenarios`) | No — informational only |
| Unstable selectors in selector health report | No — informational only |

---

## Artifacts Available After Each Run

| Artifact name | Contents | Retention | Uploaded when |
|---------------|----------|-----------|---------------|
| `playwright-report` | Full Playwright HTML report with traces and screenshots | 30 days | Always |
| `failure-analysis` | `output/failure-analysis.json` | 30 days | On failure only |
| `selector-health-report` | `output/selector-health.html` | 30 days | Always (if the file exists) |
