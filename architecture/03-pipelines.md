# Pipelines

This document explains the two main pipelines — Generate and Heal — end-to-end, including what happens at each stage, what files are written, and where caching occurs. Supporting pipelines are covered at the end.

---

## The Generate Pipeline

**Commands:** `npm run pipeline` · `npm run fresh` · Web UI "Run Pipeline" button

**Entry point:** `src/index.ts`

The following walkthrough uses a concrete example: a login scenario running against `the-internet.herokuapp.com`.

---

### Stage 1 — Parse

- Reads all `.feature` files from `scenarios/`
- Runs `parseAllScenarios()` on each → produces `ParsedScenario[]`
- Runs `lintScenario()` on each → logs warnings to the console; appends unrecognised steps to `output/lint-log.ndjson`
- Output: structured scenario objects held in memory (also written to `output/stage1-parsed-scenario.json` for single-scenario runs)
- Cache: none — this stage is fast and only reads files

---

### Stage 2 — Explore

- Runs `exploreWithScript(EXPLORATION_SCRIPT)` → launches headless Chromium
- The exploration script executes a sequence of steps: navigate → capture → fill → click → capture (repeated across multiple pages as needed)
- Each `capture` step calls `capturePageElements()`, which applies a selector priority chain (test-id → role → label → CSS fallback) and runs a uniqueness check followed by a stability re-check
- `mergePageModels()` combines all captures into a single page model
- Cache key: `JSON.stringify(EXPLORATION_SCRIPT)` — the hash is stored in a checkpoint file
- Output: `output/stage2-page-model.json` (or loaded from the checkpoint with a `[CACHE HIT]` log line)
- The `--fresh` flag bypasses the cache unconditionally

---

### Stage 3 — Plan (per scenario)

- **Deterministic pass:** if every step in the scenario matches a known vocabulary entry, the plan is built locally with no API call
- **LLM pass:** when a step falls outside the vocabulary, Gemini 2.5 Flash is called with `temperature=0` and JSON schema enforcement
- `validatePlan()` cross-references selectors against the page model and writes a `validation` field into the result
- Cache key: `sha256(featureFileContent + JSON.stringify(pageModel))`
- Output: `output/stage3-<slug>.json` per scenario

---

### Stage 4 — Generate (per scenario)

- `generateSpecFile()` writes `generated/<slug>.spec.ts`
- A pre-write syntax check is performed via `ts.transpileModule()` — malformed output is rejected before touching the filesystem
- A provenance header is injected at the top of each generated file
- A pre-commit hook blocks manual edits to anything under `generated/`

---

### Stage 5 — Run

- `runSpecs([...all generated specs])` issues a single `npx playwright test` invocation covering all generated specs
- Reads pass/fail/skip counts from `output/playwright-results.json`
- On failure: `analyzeFailures()` → writes `output/failure-analysis.json`
- Always: `updateSelectorHealth()` → writes `output/selector-health.json`
- Exits 0 if all specs pass; exits 1 if any spec fails

---

### Checkpoint File Map

| Stage | Output file | Cache key | Skipped when |
|-------|-------------|-----------|--------------|
| 1 — Parse | `output/stage1-parsed-scenario.json` (single-scenario) | none | — |
| 2 — Explore | `output/stage2-page-model.json` | `sha256(JSON.stringify(EXPLORATION_SCRIPT))` | Checkpoint hash matches and `--fresh` not set |
| 3 — Plan | `output/stage3-<slug>.json` | `sha256(featureFileContent + JSON.stringify(pageModel))` | Checkpoint hash matches and `--fresh` not set |
| 4 — Generate | `generated/<slug>.spec.ts` | derived from Stage 3 output | Regenerated on every run (no independent cache) |
| 5 — Run | `output/playwright-results.json`, `output/failure-analysis.json`, `output/selector-health.json` | none | — |

---

## The Heal Pipeline

**Command:** `npm run heal`

**Entry point:** `src/healer/index.ts`

The heal pipeline reads the results of the last generate pipeline run, re-explores the application, and produces selector replacement proposals. It never modifies source files directly.

---

### Steps

1. Reads `output/playwright-results.json` → identifies failing spec files
2. Loads the old page model from `output/stage2-page-model.json`
3. Re-runs `exploreWithScript(EXPLORATION_SCRIPT)` → produces a fresh page model
4. For each failing spec:
   - a. Extracts selectors from the spec using regex patterns that match Action Library call signatures
   - b. For each extracted selector:
     - Checks whether the selector is still valid in the new page model
     - Checks whether the selector is stable (≥ 20 recorded runs and ≤ 2% fail rate) — if so, skips auto-replace and flags it for manual review
     - Finds the closest element in the new page model using Jaccard word overlap on element text plus a 0.2 type-match bonus
   - c. Writes `output/heal-proposals/<slug>.patch.json`
5. Stops — never modifies `generated/` or `src/actions/index.ts` directly

---

### Confidence Scoring

Similarity between an old element and a candidate replacement is calculated as:

```
score = jaccard(words(oldElement.text), words(candidate.text)) + (0.2 if types match)
```

Only candidates with a score of ≥ 0.4 are included in proposals.

---

### Stable Selector Protection

Selectors with ≥ 20 recorded runs and a fail rate of ≤ 2% are considered stable. The healer never auto-replaces these. Instead, they are included in the proposals file with the flag `[stable — manual review required]`.

---

### Patch File Structure

Each `output/heal-proposals/<slug>.patch.json` has the following shape:

```json
{
  "generatedAt": "<ISO timestamp>",
  "specFile": "generated/<slug>.spec.ts",
  "proposals": [
    {
      "specFile": "generated/<slug>.spec.ts",
      "oldSelector": "<original selector string>",
      "newSelector": "<proposed replacement selector>",
      "oldElement": { "...element fields from old page model..." },
      "newElement": { "...element fields from new page model..." },
      "confidence": 0.75,
      "healedComment": "// HEALED: <oldSelector> → <newSelector> (confidence 0.75)"
    }
  ],
  "unresolvable": [
    "<selector that could not be matched to any element in the new page model>"
  ]
}
```

---

### Applying a Proposal

1. Review `output/heal-proposals/<slug>.patch.json`
2. Update the relevant helper in `src/actions/index.ts` with the `newSelector`
3. Paste the `healedComment` string on the line above the changed selector
4. Re-run `npm run pipeline` to verify the fix

---

## Supporting Pipelines

### `npm run feedback:update` — Feedback Aggregator

Aggregates signals from multiple output files and produces prioritised improvement proposals. It never auto-applies anything.

- Reads:
  - `output/lint-log.ndjson` — unrecognised steps from Stage 1
  - `output/selector-health.json` — per-selector fail rates from Stage 5
  - `output/failure-analysis.json` — failure categories from Stage 5
- Produces: `output/feedback/proposals.json` with proposals tagged `high`, `medium`, or `low` priority

---

### `npm run selector-report`

Generates a human-readable selector stability report.

- Reads `output/selector-health.json`
- Prints a stability table to the console (Selector / Runs / Failures / Fail Rate / Status)
- Writes `output/selector-health.html`
- Exits 1 if any unstable selectors are found (useful for CI non-blocking checks)

---

### `npm run vocab:analyze`

Analyses the lint log to surface vocabulary gaps.

- Reads `output/lint-log.ndjson`
- Groups unrecognised steps by frequency
- Steps appearing ≥ 5 times → auto-creates proposal files in `vocabulary/proposals/`
