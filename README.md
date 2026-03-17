# AI-Driven QA Platform

A proof-of-concept platform that turns BDD feature files into running Playwright tests — with AI-assisted planning, deterministic vocabulary resolution, self-healing selectors, and a browser-based authoring UI.

---

## How it works

```
.feature files
     │
     ▼
[Stage 1] BDD Parser        — parse scenarios, lint against vocabulary
     │
     ▼
[Stage 2] App Explorer      — Playwright crawls the target app, builds page model
     │
     ▼
[Stage 3] Planner           — vocabulary-first resolution; Gemini fallback for unknown steps
     │
     ▼
[Stage 4] Code Generator    — emits Playwright spec calling Action Library helpers
     │
     ▼
[Stage 5] Runner            — executes specs, captures traces/screenshots on failure
     │
     ├── Failure Analyzer   — classifies failures (selector_drift / product_defect / …)
     └── Selector Health    — tracks pass/fail rate per selector across runs
```

---

## Prerequisites

- Node.js 22+
- `npm install`
- A `.env` file (copy `.env.example`):
  ```
  BASE_URL=https://your-app.example.com
  GEMINI_API_KEY=...   # optional — only needed for non-vocabulary steps
  ```
- Install Playwright browsers: `npx playwright install chromium`

---

## Generate pipeline — new tests from BDD

This pipeline reads every `.feature` file in `scenarios/` and produces a runnable Playwright spec for each scenario.

```bash
# Run all scenarios (uses cached page model and plans when inputs unchanged)
npm run generate

# Force full re-run — bypass all caches
npm run fresh

# Run only specific feature files
npm run generate -- --only=login.feature,logout.feature
```

**What gets generated:**

| Output | Description |
|---|---|
| `generated/*.spec.ts` | Playwright specs — **DO NOT EDIT** (see below) |
| `output/stage2-page-model.json` | Cached page model from App Explorer |
| `output/stage3-<scenario>.json` | Cached test plans per scenario |
| `output/playwright-results.json` | Raw Playwright JSON results |
| `output/failure-analysis.json` | Failure classification (on failure) |
| `output/selector-health.json` | Cumulative selector pass/fail history |
| `playwright-report/` | Playwright HTML report |

> **Generated specs are auto-generated — never edit them directly.**
> A pre-commit hook enforces this. Fix selectors or behaviour via `src/actions/index.ts`.
> Each spec records its provenance: scenario name, timestamp, vocab version, page model hash, and platform version.

---

## Heal pipeline — fix failing selectors

When selectors drift (the app changed its DOM), the heal pipeline proposes replacements without modifying any generated file.

```bash
# Requires a recent run with failures in output/playwright-results.json
npm run heal
```

**What it does:**

1. Reads `output/playwright-results.json` to identify failing specs
2. Re-runs the App Explorer to get a fresh page model
3. Diffs old selectors against new elements using text/type similarity scoring
4. Writes `output/heal-proposals/<spec>.patch.json` — one per failing spec

**What it does NOT do:** modify `generated/` — ever.

**Stable selectors are protected:** A selector with ≥20 runs and ≤2% failure rate is never auto-replaced. It is flagged for human investigation (the app may have a real bug, not a drift).

To apply a proposal: update the relevant helper in `src/actions/index.ts`. Fixing the helper heals all tests that use it.

---

## Vocabulary system

Steps in `.feature` files are validated against a canonical vocabulary defined in `vocabulary/core.yaml`.

```bash
# Lint all scenarios against the vocabulary
npm run lint:scenarios

# Auto-fix steps with a close vocabulary match (score ≥ 0.5)
npm run lint:scenarios -- --fix

# Analyse unrecognised steps and generate proposals for new terms
npm run vocab:analyze
```

Unknown steps are logged to `output/lint-log.ndjson`. Steps appearing 5+ times without a match generate a proposal in `vocabulary/proposals/`. See [`vocabulary/proposals/TEMPLATE.md`](vocabulary/proposals/TEMPLATE.md) for how to propose a new term.

---

## Selector health

```bash
# Print stability summary — exits 1 if any selector is unstable
npm run selector-report
```

Selector health is updated automatically after every pipeline run. Selectors with >20% failure rate over the last 10 runs are marked `unstable`.

---

## Web UI

```bash
npm run serve
# → http://localhost:3000
```

Features:
- Monaco editor with Gherkin syntax highlighting
- Load / edit / save `.feature` files from the browser
- Run the pipeline (all files or a single file) with live log streaming
- Pass/fail status badge; "View Report ↗" opens the native Playwright report
- Selector Health and Heal Proposals tabs auto-refresh after each run

---

## Tests

```bash
npm run test:unit          # BDD parser, vocabulary, planner, code generator, analyzer, explorer
npm run test:integration   # Action Library integration + failure classifier verification
npm test                   # both
```

---

## CI/CD

Push or open a PR — GitHub Actions runs unit tests then the full pipeline. See [`.github/workflows/qa-pipeline.yml`](.github/workflows/qa-pipeline.yml).

On pull requests, a comment is posted with the pass/fail table and failure analysis.

---

## Project structure

```
scenarios/          .feature files (source of truth — edit these)
vocabulary/         core.yaml vocabulary + proposals/
src/
  bdd-parser/       Stage 1 — Gherkin parser
  app-explorer/     Stage 2 — Playwright-based page model builder
  planner/          Stage 3 — vocabulary resolver + Gemini fallback
  code-generator/   Stage 4 — spec file generator
  runner/           Stage 5 — Playwright executor
  actions/          Action Library (the stable fix layer)
  analyzer/         Failure categorisation
  health/           Selector health tracking
  healer/           Heal pipeline entry point
  vocabulary/       Registry, linter, vocab-analyze CLI
  server/           Web UI (Express + Monaco)
  utils/            retry, checkpoint, shared utilities
generated/          Auto-generated specs — DO NOT EDIT
output/             Run artifacts (results, analysis, health, proposals)
playwright-report/  Playwright HTML report
```
