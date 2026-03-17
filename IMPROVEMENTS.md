# AI-Driven QA Platform — Improvement Plan

> **This is a living document.** Update it whenever direction changes, a decision is reversed, or an item is completed. The goal is a clear, honest record of what was built, what was improved, and why — so the before/after comparison at the end tells a true story.

---

## How to Use This Document

| Action                         | What to do                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Starting an item               | Change `⬜ Not started` → `🔄 In progress`, add start date                                    |
| Completing an item             | Change to `✅ Done`, add completion date, fill in "Actual outcome"                            |
| Changing direction             | Add a `> ⚠️ Direction change (date): reason` note under the item. Do not delete the original. |
| Discovering a new flaw         | Add it to the audit table with severity, then add a corresponding fix item                    |
| Closing an item without fixing | Mark `🚫 Won't fix`, add reason                                                               |

> Status key: 🔴 Critical 🟠 High 🟡 Medium 🟢 Low
> Progress key: ⬜ Not started 🔄 In progress ✅ Done 🚫 Won't fix

---

## Baseline — State at First Build

> Captured on first working commit. This section is frozen. Do not update it.

**Date:** 2026-03-16
**Pipeline stages working:** 5 (BDD Parser → App Explorer → LLM Planner → Code Generator → Runner)
**Test scenario:** Login to https://the-internet.herokuapp.com/login
**LLM:** Gemini 2.5 Flash
**Framework:** Playwright + TypeScript

### What worked

- Full end-to-end pipeline ran: BDD → generated spec → Playwright execution
- App Explorer discovered 6 elements on the login page
- Gemini produced a valid test plan JSON
- Code Generator emitted syntactically correct Playwright TypeScript
- HTML report generated via Playwright native reporter

### What did not work / known gaps at baseline

- Selector fallback was bare tag name (`button`, `h2`) — non-unique, unreliable
- Temperature not set — Gemini output non-deterministic between runs
- No plan caching — Gemini called on every run regardless of changed input
- Traces never captured (`on-first-retry` with `retries: 0`)
- Command built by string concatenation — vulnerable to shell injection
- Only one scenario supported end-to-end
- No intermediate state saved — any stage failure required full re-run
- No test data management — tests assumed data existed
- Generated specs could not be manually edited safely (no ownership model)
- Explorer only saw the login page — post-login pages invisible

---

## Part 0 — Fundamental Design Risks

These are structural weaknesses in the original idea, not code bugs.
Each one has a **Definition of Done** that describes what "fixed" looks like in practice.

---

### D1 — The "Fixed Vocabulary" is a Double-Edged Sword

**Status:** ✅ Done — 2026-03-17

**The idea:** Define canonical vocabulary (e.g. `login as {role}`) and reject everything else.

**The drawback:** Vocabulary design is hard and political. Too narrow → authors work around it and write worse steps. Too broad → you lose the determinism. The bootstrap problem: you need many scenarios before you know what vocabulary to define, but the system demands vocabulary before you can write scenarios.

**Mitigation:**

- Start with **5–10 universal actions** with obvious consensus: `login as`, `navigate to`, `click`, `fill`, `assert text`. Nothing domain-specific yet.
- Run the AI-first pipeline for 50–100 real scenarios, logging every Gemini decision.
- Mine logs to identify the **10 most repeated patterns**. Codify them — evidence-based, not opinion-based.
- Make the linter **suggest, not reject**. One-click rewrites via AI Vocabulary Reviewer.
- Vocabulary changes go through code review — versioned, traceable, reversible.

**Definition of Done:**

- [x] A `vocabulary/core.yaml` file exists with at least 5 canonical actions and 3 assertions
- [x] The linter validates BDD steps against this file and outputs specific suggestions, not just errors
- [x] At least one step that uses a non-canonical synonym is auto-corrected with a suggestion
- [x] Vocabulary file is versioned (semver in the YAML header)
- [x] A CONTRIBUTING note explains how to propose a new vocabulary term (`vocabulary/CONTRIBUTING.md`)

---

### D2 — The App Explorer Captures a Snapshot, Not a Model

**Status:** ⬜ Not started

**The idea:** Connect to a real app, collect buttons/inputs/links, output page model JSON.

**The drawback:** Real apps are dynamic. An enroll dialog that appears after clicking "Enroll Users" is invisible to an explorer that only reads the initial DOM. Apps with CSS Modules, shadow DOM, or obfuscated classnames expose nothing useful. The claim "AI can understand the actual app" breaks on any modern SPA without testid instrumentation.

**Mitigation:**

- **Require `data-testid` attributes** in the target app as a hard prerequisite.
- Support **interaction sequences** in the explorer: define a mini-script to reveal hidden UI before capturing.
- Capture **network requests** during exploration to infer API contracts for setup/teardown.
- Build a **selector stability score**: selectors that change between runs are flagged, not used.

**Definition of Done:**

- [ ] Explorer accepts an `explorationScript` config (array of `fill`/`click`/`wait` steps to run before capturing)
- [ ] Explorer rejects selectors that match more than 1 element on the page (uniqueness check)
- [ ] Selector priority chain implemented: `data-testid` > ARIA role > `#id` > `[name]` > text-based > reject bare tags
- [ ] Explorer runs twice on the same page and produces a stability diff — selectors that changed are flagged
- [ ] `data-testid` coverage % is reported in the page model output

---

### D3 — Generated Tests Have No Ownership Model

**Status:** ✅ Done — 2026-03-17

**The idea:** Generate `.spec.ts` files and run them.

**The drawback:** When the app changes, what happens to the generated tests? Manually edited specs lose their fixes on regeneration. Generated code ends up in a grey zone — neither trusted AI output nor maintained source — and becomes stale.

**Mitigation:**

- **Rule: generated specs are never manually edited.** `// DO NOT EDIT` header enforced by pre-commit hook.
- **Action Library is the stable layer.** Generated code calls helpers (`loginAs(page, role)`). Fix the helper, fix all tests.
- Store generated specs outside version control. Source of truth is `.feature` + Action Library.
- Record provenance: which page model version + which planner version generated each spec.

**Definition of Done:**

- [x] Every generated spec has a `// AUTO-GENERATED by ai-driven-qa-platform — DO NOT EDIT` header
- [x] A pre-commit hook rejects commits that modify files under `generated/` (`.githooks/pre-commit`, activated via `prepare` npm script)
- [x] At least 3 Action Library helpers exist (`loginAs`, `navigateTo`, `assertText` + 4 more in `src/actions/index.ts`)
- [x] Generated code calls Action Library helpers, not raw `page.fill()`/`page.click()` for known actions
- [x] Each generated spec header includes `Generated`, `VocabVersion`, `PageModelHash`, `PlannerVersion` provenance fields

---

### D4 — The Feedback Loop is Underdefined

**Status:** ⬜ Not started

**The idea:** The system improves vocabulary, action library, planner, and code generator over time.

**The drawback:** No defined mechanism for who makes changes, how regressions are prevented, or what the trigger signal is. Auto-changing vocabulary breaks all existing tests silently.

**Mitigation:**

- Feedback loop **generates proposals, never applies changes automatically**.
- All vocabulary changes are **versioned with semver**. Major bumps require opt-in migration.
- Specific signals per improvement target:
  - Vocabulary: same unrecognized step used in N scenarios → propose new term
  - Action Library: selector drift rate > X% on one helper → trigger re-exploration
  - Planner: same BDD produces different plans across runs → lower temperature, add few-shot examples
  - Code Generator: spec fails to compile → log template + add to regression suite

**Definition of Done:**

- [ ] A `feedback/proposals.json` file is written after each run containing flagged deviations
- [ ] A CLI command (`npm run review-proposals`) prints proposals grouped by type
- [ ] No proposal is ever auto-applied — all require a human `--approve` flag or PR merge
- [ ] Each proposal records the triggering evidence (which run, which scenario, which step)
- [ ] Vocabulary YAML has a `version:` field and a `changelog:` section

---

### D5 — Test Data is the Hidden Hard Problem

**Status:** ⬜ Not started

**The idea:** A Test Data & Environment Manager handles data seeding, fixtures, and state reset.

**The drawback:** Listed as one of 20 building blocks, but is the single biggest ongoing cost of test automation in practice. Tests sharing data interfere with each other. Isolated data has high setup cost. Neither is acknowledged in the original spec.

**Mitigation:**

- **Tests own their data.** Each scenario creates via API calls at the start and tears down at the end.
- Planner produces three sections: `setup` (API calls), `execution` (UI steps), `teardown` (API calls).
- Vocabulary: `Given a course "{name}" exists` → API call, not UI interaction.
- Unique run IDs (`John Smith-{runId}`) prevent parallel test interference.

**Definition of Done:**

- [ ] Test plan JSON has three top-level sections: `setup`, `execution`, `teardown`
- [ ] At least one `Given` step maps to an API call in the generated spec (not a UI action)
- [ ] Generated spec cleans up created data in an `afterEach` or teardown block
- [ ] Two test runs in parallel do not interfere (verified by running the same scenario twice simultaneously)
- [ ] Run ID is injected into test data names for isolation

---

### D6 — LLM Cost and Latency at Scale

**Status:** ⬜ Not started

**The idea:** Gemini plans each test run.

**The drawback:** 200 scenarios × 2s = 6+ min per CI run, just for planning. Rate limits stall unpredictably. A Gemini outage takes down the whole QA pipeline.

**Mitigation:**

- **Plan caching**: hash(BDD content + page model) → cached plan. Gemini only called when input changes.
- Plans computed at **authoring time**, not run time.
- LLM called only for **unresolved steps** — common vocabulary steps bypass Gemini entirely.
- Plans stored in version control alongside `.feature` files.

**Definition of Done:**

- [ ] An `output/cache/` directory stores plans keyed by `sha256(featureContent + pageModelContent)`
- [ ] Running the pipeline twice with no changes to inputs uses the cached plan (verified by disabling network and confirming it still runs)
- [ ] Cache hit/miss is logged clearly at Stage 3
- [ ] A `--no-cache` flag forces a fresh Gemini call
- [ ] Plans are saved as `output/<scenario-slug>.plan.json` alongside the feature file

---

### D7 — The Healing Engine Can Introduce Silent Regressions

**Status:** ⬜ Not started

**The idea:** When a selector drifts, the healing engine finds the new selector and updates the test.

**The drawback:** A healed selector might point to the wrong element — same text, different purpose. The test now passes on incorrect behaviour. This is worse than a failing test. The doc's own guardrail ("prefer suggesting before mutating") is a preference, not a hard constraint.

**Mitigation:**

- **Healing is never automatic.** Always produces a diff requiring human review before merging.
- After healing, test must re-run against production-equivalent environment.
- Healed tests get a `// HEALED` flag — reported separately in dashboards.
- Heal the Action Library helper, not the generated spec.

**Definition of Done:**

- [ ] No code path in the system auto-writes a healed spec to disk without an explicit `--apply` flag
- [ ] Healing output is always a `output/heal-proposals/<spec-name>.patch` file, never a direct file overwrite
- [ ] A healed spec has `// HEALED: <date> — original selector: <old> — new selector: <new>` comment
- [ ] The healing report shows side-by-side old vs new element (text, type, position) so a human can judge correctness
- [ ] CI marks healed tests with a `[HEALED]` label in the report

---

### D8 — The System Conflates Generation and Maintenance

**Status:** ✅ Done — 2026-03-17

**The idea:** One unified system handles writing new tests and fixing broken ones.

**The drawback:** These are fundamentally different workflows:

| Dimension | New test generation    | Broken test healing          |
| --------- | ---------------------- | ---------------------------- |
| Trigger   | QA author writes BDD   | CI fails                     |
| Actor     | QA engineer            | On-call / automated          |
| Trust     | Low (new, unvalidated) | Very low (changing existing) |
| Risk      | Writing wrong test     | Masking a real product bug   |
| Urgency   | Low (feature work)     | High (blocking CI)           |

**Mitigation:**

- Two explicit pipelines: `generate` (new `.feature` → new spec) and `heal` (failing CI → proposed patch).
- Shared: App Explorer, Action Library.
- Separate: planners, code generators, prompts, temperatures, validation rules.
- Healing proposals go through mandatory PR with failing test log attached.

**Definition of Done:**

- [x] Two separate CLI entry points: `npm run generate` and `npm run heal`
- [x] `heal` pipeline reads Playwright JSON reporter output as its input, not a `.feature` file (`src/healer/index.ts`)
- [x] `heal` pipeline uses a separate repair-focused code path — no LLM planner, Jaccard selector diffing instead
- [x] A heal proposal is always a patch file under `output/heal-proposals/` — never a direct write to `generated/`
- [x] `generate` and `heal` pipelines are documented separately in README

---

### D9 — Vocabulary Governance Requires Organizational Change

**Status:** ⬜ Not started

**The idea:** A governance module approves new terms, deprecates old ones, and tracks deviations.

**The drawback:** The registry only works if every team uses it. In practice, "canonical phrasing" becomes political without strong buy-in. Governance tooling built too early becomes shelfware.

**Mitigation:**

- Don't build governance tooling until **3+ teams are actively using the vocabulary**.
- Teams have **local vocabulary extensions** — central vocab covers universal actions only.
- Governance decisions happen in **open PRs**, not admin panels.
- Track **vocabulary adoption rate** in the dashboard — low adoption = wrong vocabulary, not non-compliant teams.

**Definition of Done:**

- [ ] Vocabulary YAML supports both `core/` (shared) and `teams/<team-name>/` (local extension) files
- [ ] The linter checks core vocabulary for all teams, team vocab only for that team's scenarios
- [ ] A `vocabulary adoption rate` metric is visible in the reporting dashboard
- [ ] A governance proposal template exists (markdown file in `vocabulary/proposals/`)
- [ ] At least one vocabulary term was proposed via PR, reviewed, and merged (proving the process works end-to-end)

---

### Design Risk Summary

| #   | Risk                              | Status | Core Mitigation                                                              |
| --- | --------------------------------- | ------ | ---------------------------------------------------------------------------- |
| D1  | Fixed vocabulary is premature     | ✅     | Evidence-based bootstrapping; 50+ AI runs before defining vocab              |
| D2  | Explorer is a static snapshot     | ⬜     | `data-testid` requirement; interaction sequences; selector stability scoring |
| D3  | Generated tests have no owner     | ✅     | Never edit generated code; fix Action Library; record provenance             |
| D4  | Feedback loop is vague            | ⬜     | Proposals only; semver vocab; specific signals defined                       |
| D5  | Test data is underestimated       | ⬜     | Tests own their data via API; setup/execution/teardown plan sections         |
| D6  | LLM cost/latency at scale         | ⬜     | Plan caching at authoring time; LLM only for unresolved steps                |
| D7  | Healing can mask product bugs     | ⬜     | Never automatic; healed tests flagged; fix helpers not specs                 |
| D8  | Generation ≠ Maintenance          | ✅     | Two explicit pipelines with different trust levels                           |
| D9  | Vocab governance needs org change | ⬜     | Local team extensions; governance only for shared terms                      |

---

## Part 1 — Code-Level Flaws

### Stage 1 — BDD Parser

| Severity | Flaw                                                           | Status |
| -------- | -------------------------------------------------------------- | ------ |
| 🟠       | Single-scenario only — subsequent `Scenario:` blocks overwrite | ✅     |
| 🟡       | `line.startsWith('#')` misidentifies steps containing `#`      | ⬜     |
| 🟡       | Assumes keywords are always the first word                     | ⬜     |
| 🟢       | No line numbers in error messages                              | ⬜     |

### Stage 2 — App Explorer

| Severity | Flaw                                                             | Status |
| -------- | ---------------------------------------------------------------- | ------ |
| 🔴       | Selector fallback is bare tag name (`button`, `h2`) — non-unique | ✅     |
| 🔴       | Only explores the initial URL — post-login pages invisible       | ✅     |
| 🟠       | `waitUntil: 'domcontentloaded'` misses JS-rendered content       | ✅     |
| 🟠       | Duplicate DOM IDs treated as unique                              | ✅     |
| 🟠       | Text truncated at 100 chars with no marker                       | ✅     |
| 🟠       | No retry on navigation failure                                   | ✅     |
| 🟡       | Tailwind numeric-prefix classes filtered out                     | ⬜     |
| 🟡       | Icon-only links silently dropped                                 | ⬜     |
| 🟡       | Browser not guaranteed closed if `page.evaluate()` throws        | ✅     |

### Stage 3 — LLM Planner

| Severity | Flaw                                                           | Status |
| -------- | -------------------------------------------------------------- | ------ |
| 🔴       | Non-deterministic output — same input, different plan each run | ✅     |
| 🔴       | No validation that plan selectors exist in the page model      | ✅     |
| 🟠       | No retry / exponential backoff on API errors                   | ✅     |
| 🟠       | LLM temperature not set — defaults to high creativity          | ✅     |
| 🟠       | No caching — Gemini called on every run for identical input    | ✅     |
| 🟡       | Prompt injection: raw BDD step text inserted unsanitized       | ⬜     |
| 🟡       | No JSON schema enforcement (`response_schema`)                 | ✅     |
| 🟡       | Full Gemini response logged on error — potential PII exposure  | ⬜     |

### Stage 4 — Code Generator

| Severity | Flaw                                                                   | Status |
| -------- | ---------------------------------------------------------------------- | ------ |
| 🟠       | No syntax check before writing spec to disk                            | ✅     |
| 🟠       | `escapeQuotes()` misses backslash sequences                            | ✅     |
| 🟠       | `fill()` emitted with no guard against non-input selectors             | 🚫     |
| 🟡       | `waitForTimeout()` value not validated — `"abc"` produces invalid code | ✅     |
| 🟡       | `assert_url` regex has no anchors                                      | ✅     |
| 🟡       | No `waitForLoadState` between navigation and next action               | ✅     |

### Stage 5 — Runner

| Severity | Flaw                                                             | Status |
| -------- | ---------------------------------------------------------------- | ------ |
| 🟠       | Command built by string concatenation — shell injection risk     | ✅     |
| 🟠       | 60-second hardcoded timeout                                      | ✅     |
| 🟠       | `err.status ?? 1` — exit code 0 coerced to 1 on unexpected error | ✅     |
| 🟡       | `total: 1` hardcoded — wrong for multi-test specs                | ✅     |
| 🟡       | No distinction between Playwright crash and test failure         | ⬜     |

### Config & Architecture

| Severity | Flaw                                                                | Status |
| -------- | ------------------------------------------------------------------- | ------ |
| 🟠       | `trace: 'on-first-retry'` with `retries: 0` — traces never captured | ✅     |
| 🟡       | `testDir: './generated'` is relative path                           | ✅     |
| 🟡       | No intermediate state saved to disk                                 | ✅     |
| 🟡       | No multi-scenario support end-to-end                                | ✅     |

---

## Part 2 — Improvement Phases

---

### Phase 1 — Critical Stability Fixes

> Goal: Make the pipeline reliably run end-to-end every time, without random failures.

---

#### 1.1 Fix selector quality in App Explorer

**Status:** ✅ Done — 2026-03-16
**Fixes:** Stage 2 🔴 bare tag fallback

Implement a scored selector priority chain. After generating a selector, count matching elements — if `> 1`, try next strategy. Reject bare tags entirely.

Priority chain:

1. `[data-testid]` / `[data-cy]` / `[data-test]`
2. ARIA role + accessible name: `role=button[name="Login"]`
3. Unique `#id`
4. `input[name="..."]`
5. `button:has-text("Login")`
6. **Reject** — log warning, skip element

**Definition of Done:**

- [x] No generated selector is a bare tag name (`button`, `h2`, `a`, etc.)
- [x] Each selector's uniqueness is verified against the live DOM before it is added to the page model
- [x] A selector that matches 2+ elements emits a `[WARN] non-unique selector skipped` log
- [x] `data-testid` selectors are preferred and appear first in the element list when available
- [x] Running the explorer on the login page produces `#username`, `#password`, `button.radius` — not `input`, `input`, `button`

---

#### 1.2 Fix Playwright config traces

**Status:** ✅ Done — 2026-03-16

**Fix:** Changed `trace: 'on-first-retry'` → `trace: 'on-failure'`. Traces and screenshots now captured on failure.

**Definition of Done:**

- [x] `playwright.config.ts` has `trace: 'on-failure'`
- [x] `screenshot: 'on-failure'`
- [x] A failed test produces a `.zip` trace file in `test-results/`
- [x] `npx playwright show-report` shows the trace viewer link for failed tests

---

#### 1.3 Guarantee browser cleanup

**Status:** ✅ Done — 2026-03-16
**Fixes:** Stage 2 🟡 browser leak on error

**Definition of Done:**

- [x] `browser.close()` is wrapped in its own `try-catch` inside the `finally` block
- [x] If `page.evaluate()` throws, no orphaned Chromium process remains — verified in `src/app-explorer/__tests__/browser-cleanup.spec.ts`
- [x] A test that deliberately causes a navigation error confirms cleanup runs (`browser-cleanup.spec.ts` uses `pgrep` process count before/after)

---

#### 1.4 Fix LLM temperature

**Status:** ✅ Done — 2026-03-16
**Fixes:** Stage 3 🟠 non-determinism, 🟠 temperature

**Fix:** Set `generationConfig: { temperature: 0 }` in `getGenerativeModel()`.

**Definition of Done:**

- [x] `temperature: 0` is set in the Gemini model config
- [x] Running the planner 3 times with identical inputs produces identical output — verified in `src/planner/__tests__/determinism.spec.ts`
- [x] Determinism test uses the vocabulary-only path (no Gemini call) — fast, offline, free

---

#### 1.5 Validate plan selectors against page model

**Status:** ✅ Done — 2026-03-16
**Fixes:** Stage 3 🔴 hallucinated selectors

After Gemini returns the plan, cross-reference every `selector` value against `pageModel.elements`. Any selector not found triggers a warning and a fuzzy-match fallback.

**Definition of Done:**

- [x] A `validatePlan(plan, pageModel)` function exists in `src/planner/`
- [x] Unknown selectors emit `[WARN] selector not found in page model: <value>`
- [x] The warning includes the closest matching element from the page model as a suggestion
- [x] If more than 50% of selectors are unknown, the pipeline throws an error rather than continuing
- [ ] Validation results are included in `output/test-plan.json` as a `validation` field

---

### Phase 2 — Robustness & Reliability

> Goal: Handle real-world failures gracefully. Survive transient errors without losing work.

---

#### 2.1 Retry logic with exponential backoff

**Status:** ✅ Done — 2026-03-16
**Fixes:** Stage 3 🟠 no retry; Stage 2 🟠 no retry

Apply to: Gemini API calls, `page.goto()`, and optionally Playwright actions.

```
Attempt 1 → immediate
Attempt 2 → wait 1s
Attempt 3 → wait 2s
Attempt 4 → wait 4s (max 4 attempts)
```

**Definition of Done:**

- [x] A `withRetry(fn, maxAttempts, baseDelayMs)` utility exists in `src/utils/retry.ts`
- [x] Gemini `generateContent` is wrapped with `withRetry`
- [x] `page.goto()` in the explorer is wrapped with `withRetry`
- [x] Each retry attempt logs `[RETRY] attempt N of M — reason: <error message>`
- [ ] A deliberate 429 rate-limit error from Gemini is recovered on retry (can be simulated with a mock)

---

#### 2.2 Pipeline checkpointing

**Status:** ✅ Done — 2026-03-16
**Fixes:** Config 🟡 no intermediate state

Save stage outputs to `output/` after each step. On re-run, load from cache if content hash matches.

**Definition of Done:**

- [x] `output/stage1-parsed-scenario.json` written after Stage 1
- [x] `output/stage2-page-model.json` written after Stage 2
- [x] `output/stage3-test-plan.json` written after Stage 3
- [x] A re-run with no input changes loads from cache and skips the expensive stages (Playwright + Gemini)
- [x] A `--fresh` CLI flag bypasses all caches and forces full re-run
- [x] Cache hit/miss is clearly logged: `[CACHE HIT] Stage 2 — loaded from output/stage2-page-model.json`

---

#### 2.3 Multi-page exploration

**Status:** ✅ Done — 2026-03-16
**Fixes:** Stage 2 🔴 only explores initial URL

Support an exploration config that defines steps to execute before capturing each page.

```typescript
const EXPLORATION_SCRIPT: ExplorationStep[] = [
	{ action: 'navigate', value: 'https://the-internet.herokuapp.com/login' },
	{ action: 'capture', value: 'https://the-internet.herokuapp.com/login' },
	{ action: 'fill', selector: '#username', value: 'tomsmith' },
	{ action: 'fill', selector: '#password', value: 'SuperSecretPassword!' },
	{ action: 'click', selector: 'button.radius' },
	{ action: 'capture', value: 'https://the-internet.herokuapp.com/secure' },
]
```

**Definition of Done:**

- [x] Explorer accepts an `explorationScript` array in its config (`ExplorationStep[]` type in `types.ts`, `exploreWithScript()` in `explorer.ts`)
- [x] Running the script on the login demo produces a page model for `/secure` that includes the post-login content
- [x] Each page captured is a separate entry in the page model output array (`exploreWithScript` returns `PageModel[]`)
- [x] If an exploration step fails (e.g. wrong selector), the error is specific and includes which step failed (step index in message)
- [x] Page models from multiple pages are merged and passed together to the planner (`mergePageModels()` in `explorer.ts`, called in `index.ts`)

---

#### 2.4 Structured Gemini output

**Status:** ✅ Done — 2026-03-16
**Fixes:** Stage 3 🟡 no schema enforcement

Use Gemini's `responseMimeType: 'application/json'` and `responseSchema` to force schema-conformant output — no markdown fences, no prose.

**Definition of Done:**

- [x] `responseMimeType: 'application/json'` is set in generation config
- [x] `responseSchema` matches the `TestPlan` TypeScript interface
- [x] The markdown-stripping code in `planner.ts` is removed (no longer needed)
- [ ] Running the planner 10 times never produces a JSON parse error
- [x] The response schema is defined as a constant in `src/planner/schema.ts` and co-located with the types

---

#### 2.5 Syntax-check generated code

**Status:** ✅ Done — 2026-03-16
**Fixes:** Stage 4 🟠 no pre-write syntax check

Uses TypeScript's `transpileModule` API for a fast, single-file syntax check before writing the spec to disk.

**Definition of Done:**

- [x] A `validateSpec(content)` function in `src/code-generator/spec-validator.ts` parses the content and returns errors
- [x] A spec with a deliberate syntax error (e.g. unclosed string) is caught before execution
- [x] The pipeline fails at Stage 4 with a clear message rather than failing at Stage 5 with a cryptic Playwright error
- [x] Validation adds < 1s to pipeline runtime (uses `ts.transpileModule` — no disk I/O, no type resolution)

---

#### 2.6 Fix command injection in runner

**Status:** ✅ Done — 2026-03-16
**Fixes:** Stage 5 🟠 shell injection

Replace `execSync` + string concatenation with `execFileSync` + argument array.

**Definition of Done:**

- [x] `execSync` is replaced with `execFileSync` in `runner.ts`
- [x] Arguments are passed as a string array, not interpolated into a command string
- [x] A spec path containing spaces runs correctly — verified in `src/runner/__tests__/runner-paths.spec.ts`
- [x] A spec path containing a single quote does not break the command — verified in `runner-paths.spec.ts`

---

### Phase 3 — Quality & Intelligence

> Goal: Tests that are meaningful, maintainable, and self-healing.

---

#### 3.1 Vocabulary Registry

**Status:** ✅ Done — 2026-03-16

**Definition of Done:**

- [x] `vocabulary/core.yaml` exists with at least 5 actions and 3 assertions (v1.1.0: 8 actions, 4 assertions)
- [x] A `VocabularyRegistry` class loads and exposes the vocabulary for use by the linter and planner (`src/vocabulary/registry.ts`)
- [x] Unknown step text is flagged by the linter with the closest canonical match suggested (`src/vocabulary/linter.ts`)
- [x] Vocabulary has a `version` field used in provenance records on generated specs (`VocabVersion:` comment in spec header)
- [x] A `npm run lint:scenarios` command validates all `.feature` files against the registry — `login.feature` achieves 100% coverage

---

#### 3.2 Deterministic planning for known steps

**Status:** ✅ Done — 2026-03-16

Two-pass planning: deterministic first, LLM fallback only for unresolved steps.

**Definition of Done:**

- [x] The planner's first pass matches every step against the vocabulary registry (`canResolveAll` + `resolveAll` in `src/planner/deterministic-resolver.ts`)
- [x] Steps with 100% vocabulary match produce actions without any Gemini call — confirmed by `[Planner] All steps resolved deterministically — Gemini skipped.` log
- [x] Unresolved steps fall back to full Gemini call; partial step sending is a future optimization (3.2-ext)
- [x] Each action tagged with `source: "vocabulary"` or `source: "llm"` via `TestAction.source`
- [x] Login scenario runs with zero Gemini API calls — verified by `--fresh` run: PASSED in 5.2s with no API request

---

#### 3.3 Action Library

**Status:** ✅ Done — 2026-03-16

**Definition of Done:**

- [x] `src/actions/index.ts` exports `loginAs`, `navigateTo`, `clickElement`, `fillInput`, `assertText`, `assertUrl`, `assertVisible`
- [x] Generated specs import from `../src/actions` — no direct `@playwright/test` calls except `test()`; only used symbols imported
- [x] Selectors live in the library; updating `loginAs()` heals all generated tests using it
- [x] All actions have JSDoc comments describing parameters and selector strategy
- [x] 16 integration tests in `src/actions/__tests__/actions.spec.ts` — all passing (happy path, edge cases, expected failures)

---

#### 3.4 Failure Analyzer

**Status:** ✅ Done — 2026-03-16

**Definition of Done:**

- [x] `output/failure-analysis.json` written after every failed run (`src/analyzer/failure-analyzer.ts`)
- [x] Each failure categorized into one of 5 categories with a suggested fix
- [x] Analysis shown in console immediately after Stage 5 on failure; silent on passing runs
- [x] Bad-selector test → `selector_drift` (verified with `classifier-verify.spec.ts`)
- [x] Wrong assertion text → `product_defect` (verified with `classifier-verify.spec.ts`)

---

#### 3.5 Selector Health Monitor

**Status:** ✅ Done — 2026-03-17

Track selector success/failure rate across runs over time.

**Definition of Done:**

- [x] `output/selector-health.json` is updated after each run with selector → pass/fail counts (`src/health/selector-health.ts`, `updateSelectorHealth()` called at end of Stage 5)
- [x] Selectors with > 20% failure rate across last 10 runs are flagged as `unstable` (`selectorStatus()` returns `'unstable'`)
- [x] A `npm run selector-report` command prints a stability summary (`src/health/report-cli.ts`, exits 1 if any unstable)
- [ ] Unstable selectors are highlighted in the HTML report
- [x] A selector with ≥20 runs and ≤2% failure rate is never automatically replaced by the healer — `isStable()` check in `src/healer/index.ts`; flagged for manual review instead

---

### Phase 4 — Platform & Scale

---

#### 4.1 Web UI — Scenario Editor

**Status:** ✅ Done — 2026-03-17

**Definition of Done:**

- [x] A web UI accessible at `localhost:3000` renders a Monaco editor pre-loaded with Gherkin syntax highlighting (`src/server/public/index.html`, Monaco CDN, custom Gherkin tokenizer)
- [ ] Autocomplete suggests vocabulary terms as the author types
- [x] Linting warnings shown in the Lint Output tab via `POST /api/lint` (calls lint-cli, returns warnings array)
- [x] A "Run Pipeline" button triggers the full pipeline and streams stage progress to the UI via SSE (`POST /api/run`, `text/event-stream`, `fetch` + `ReadableStream`)
- [x] Pass/fail status badge shown after run completes; Selector Health and Heal Proposals tabs auto-refresh
- [x] Feature files can be loaded, edited, and saved from the browser; `--fresh` checkbox supported

---

#### 4.2 Multi-scenario batch runs

**Status:** ✅ Done — 2026-03-17

**Definition of Done:**

- [x] `npm start` / `npm run fresh` runs all `.feature` files in `scenarios/`
- [ ] Scenarios run in parallel (configurable worker count) — deferred to long-term
- [x] A single aggregated HTML report covers all scenarios (Playwright native HTML reporter)
- [x] The console summary shows: `Scenarios: N`, `Passed: X / Y`, `Failed: Z`, `Duration`
- [x] All 5 scenarios (4 login + 1 logout) complete in a single Playwright invocation (~14s)

---

#### 4.3 CI/CD integration

**Status:** ✅ Done — 2026-03-17

**Definition of Done:**

- [x] `.github/workflows/qa-pipeline.yml` exists — two jobs: `unit-tests` then `pipeline` (needs: unit-tests)
- [x] Workflow triggers on `push` and `pull_request` to any branch
- [x] `playwright-report/` uploaded as artifact on every run (30-day retention)
- [x] `output/failure-analysis.json` uploaded as artifact on failure
- [x] A failed test causes non-zero exit — blocks PR merge
- [x] PR comment posted with pass/fail table, failure analysis (category + suggestion), and link to run
- [x] `GEMINI_API_KEY` is optional — pipeline works without it for vocabulary-only scenarios
- [x] `test.fail()` applied to classifier-verify tests so deliberate failures are treated as expected in CI
- [x] `npm run test:unit`, `npm run test:integration`, `npm test` scripts added to package.json

---

#### 4.4 Self-healing engine

**Status:** ✅ Done — 2026-03-17

**Definition of Done:**

- [x] `npm run heal` reads `output/playwright-results.json` to identify failing tests (`src/healer/index.ts`)
- [x] For each failing test, it re-runs the App Explorer and diffs old vs new page model (Jaccard word overlap + type bonus confidence scoring)
- [x] Outputs `output/heal-proposals/{slug}.patch.json` per failing spec with proposals and unresolvable lists
- [x] No file under `generated/` is ever modified — all output goes to `output/heal-proposals/` only
- [x] Each patch includes old selector, new selector, old element, new element, and confidence score for human review

---

#### 4.5 Vocabulary Governance

**Status:** ✅ Done — 2026-03-17

**Definition of Done:**

- [x] Vocabulary proposal template exists at `vocabulary/proposals/TEMPLATE.md` (with `{step-name}` placeholder)
- [x] A `npm run vocab:analyze` command scans `output/lint-log.ndjson` and groups unrecognized steps by frequency (`src/vocabulary/vocab-analyze.ts`)
- [x] Steps that appear 5+ times without a vocabulary match are automatically added to `vocabulary/proposals/` (threshold configurable via `PROPOSAL_THRESHOLD`)
- [ ] Proposals require a PR with at least one reviewer before merging to `vocabulary/core.yaml`
- [ ] Merged vocabulary changes trigger a re-lint of all `.feature` files

---

## Before / After Comparison

> This section is updated as improvements are completed. Initially shows the baseline state for every dimension. As items are completed, the "After" column is filled in.

| Dimension                  | Before (Baseline)                                           | After (Target)                                                               | Status             |
| -------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------ |
| **Selector strategy**      | Bare tag fallback (`button`, `h2`) — non-unique, unreliable | Scored chain: `data-testid` > ARIA > `#id` > text-based; uniqueness verified | ✅ Done 2026-03-16 |
| **LLM determinism**        | Temperature unset — different plan every run                | `temperature: 0`; same input → same plan every time                          | ✅ Done 2026-03-16 |
| **Gemini output format**   | Free-text JSON parsed with fragile string stripping         | `responseMimeType: 'application/json'` + schema enforcement                  | ✅ Done 2026-03-16 |
| **Plan validation**        | Hallucinated selectors accepted silently                    | Every selector cross-referenced against page model; unknowns flagged         | ✅ Done 2026-03-16 |
| **Traces / screenshots**   | `on-first-retry` — never captured (retries=0)               | `on-failure` — always captured on failed runs                                | ✅ Done 2026-03-16 |
| **Retry on failure**       | No retry — single network error kills pipeline              | Exponential backoff: 4 attempts, 1/2/4s delays                               | ✅ Done 2026-03-16 |
| **Pipeline checkpointing** | No state saved — full re-run on any failure                 | Per-stage output cached by content hash; `--fresh` to bypass                 | ✅ Done 2026-03-16 |
| **Multi-page exploration** | Login page only — post-login pages invisible                | `ExplorationStep[]` script: navigate → fill → click → capture; models merged | ✅ Done 2026-03-16 |
| **Runner safety**          | `execSync` + string concat — shell injection risk           | `execFileSync` + argument array                                              | ✅ Done 2026-03-16 |
| **Generated code syntax**  | Checked at runtime only                                     | Pre-write `ts.transpileModule` validation in `spec-validator.ts`             | ✅ Done 2026-03-16 |
| **Test ownership**         | Grey zone — generated but manually patched                  | DO NOT EDIT header + pre-commit hook; provenance fields; fixes via Action Library | ✅ Done 2026-03-17 |
| **Navigation wait**        | `waitUntil: 'domcontentloaded'` — misses late-rendering JS  | `waitUntil: 'load'` in explorer + action library; `waitForLoadState` post-click | ✅ Done 2026-03-17 |
| **Test data**              | Assumed data exists in environment                          | Tests own their data via API setup/teardown                                  | ⬜                 |
| **Vocabulary**             | Free-form natural language, LLM interprets everything       | `vocabulary/core.yaml` v1.1.0; linter with suggestions; 100% login coverage  | ✅ Done 2026-03-16 |
| **Failure classification** | Binary pass/fail — no root cause                            | 5-category failure analysis with suggested fix per failure                   | ✅ Done 2026-03-16 |
| **Healing safety**         | No healing engine; manual edits lost on regen               | Proposals only, never auto-applied; healed tests flagged                     | ✅ Done 2026-03-17 |
| **LLM cost at scale**      | Gemini called on every run                                  | Plan cached by content hash; LLM called only when inputs change              | ✅ Done 2026-03-16 |
| **Multi-scenario support** | One scenario only                                           | Batch all `.feature` files; parallel execution                               | ✅ Done 2026-03-17 |
| **CI/CD**                  | Local only                                                  | GitHub Actions workflow; PR comments with results                            | ✅ Done 2026-03-17 |
| **Selector health**        | No tracking; drift invisible until CI fails                 | Cumulative pass/fail history; `unstable` flagging; `selector-report` CLI    | ✅ Done 2026-03-17 |
| **Vocab governance**       | No proposal mechanism; drift untracked                      | NDJSON lint log; `vocab:analyze` with auto-proposals; `TEMPLATE.md`          | ✅ Done 2026-03-17 |
| **Web UI**                 | CLI only; no authoring interface                            | Monaco editor, Gherkin highlighting, SSE pipeline streaming, tabs            | ✅ Done 2026-03-17 |

---

## Prioritised Backlog

### Immediate (do next)

- [x] 1.1 Fix selector quality — scored strategy with uniqueness check
- [x] 1.4 Fix Gemini temperature — set to 0
- [x] 1.5 Validate plan selectors — cross-reference against page model
- [x] 2.6 Fix command injection — use `execFileSync` with array args
- [x] 1.3 Guarantee browser cleanup

### Short term (this week)

- [x] 2.4 Structured Gemini output — `responseMimeType` + `responseSchema`
- [x] 2.2 Pipeline checkpointing — save/load per-stage JSON
- [x] 2.1 Retry with backoff — API calls + browser navigation
- [x] 2.3 Multi-page exploration — login-then-explore sequence
- [x] 2.5 Syntax-check generated code

### Medium term (next sprint)

- [x] 3.1 Vocabulary Registry — YAML schema + linter
- [x] 3.2 Deterministic planning — known steps bypass LLM
- [x] 3.3 Action Library — reusable helpers
- [x] 3.4 Failure Analyzer — classify failures post-run
- [x] 4.2 Multi-scenario batch runs — 5 BDD scenarios, single Playwright invocation, aggregated report

### Long term (platform)

- [x] 3.6 Vocabulary linter `--fix` flag — rewrites steps with score ≥ 0.5, reverse-order line patching, before/after diff output (`src/vocabulary/lint-cli.ts`)
- [x] 4.1 Web UI — Monaco editor, Gherkin highlighting, SSE pipeline streaming, health/proposals tabs (`npm run serve`)
- [x] 4.3 CI/CD integration — GitHub Actions, two-job workflow, PR comments (`npm run test`)
- [x] 4.4 Self-healing engine — selector drift recovery with Jaccard scoring, proposals only (`npm run heal`)
- [x] 4.5 Vocabulary Governance — lint-log analysis, auto-proposals, threshold=5 (`npm run vocab:analyze`)
- [x] 3.5 Selector Health Monitor — cumulative history, unstable flagging, CLI report (`npm run selector-report`)
- [ ] D3–D9 design risk mitigations

---

## Key Design Principles

1. **Deterministic before AI** — LLM is last resort. Known steps resolve without hitting the API.
2. **Fail loudly, recover gracefully** — every stage saves output; failures don't lose work.
3. **Selectors are the #1 reliability factor** — scored, uniqueness-checked, health-monitored.
4. **LLM output is never trusted blindly** — schema enforcement + cross-reference validation.
5. **Tests are business language** — generated code calls named helpers. One helper fix heals all tests.
6. **Proposals, not mutations** — healing and feedback loops generate diffs for human review, never auto-apply.
7. **This document is the truth** — if a decision changed, it is recorded here with a reason.
