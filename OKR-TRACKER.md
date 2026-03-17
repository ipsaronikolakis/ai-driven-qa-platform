# OKR Tracker — Objective 5: AI-Driven QA Platform (POC to MVP)

**Last updated:** 2026-03-17 (architecture docs + diagrams complete; testing & hardening added as top priority)

---

## Summary

| KR | Title | Status | % Complete |
|----|-------|--------|-----------|
| KR 5.1 | POC Completed and Demonstrated | 🔄 In progress | 60% |
| KR 5.2 | Core Architecture Defined and Validated | 🔄 In progress | 65% |
| KR 5.3 | MVP Phase 1 Delivered: Specification and Governance Layer | ✅ Done | 100% |
| KR 5.4 | MVP Phase 2 Delivered: Test Synthesis and Execution Layer | 🔄 In progress | 75% |
| KR 5.5 | Platform Roadmap for 2027 Published | ⬜ Not started | 0% |

---

## Next Priority Actions

These are the highest-leverage actions needed to close remaining OKR gaps:

1. **[NEW] Clarify and document Playwright MCP vs platform Playwright** — [Eng] Document the distinction between the two Playwright contexts so the team is unambiguous: (a) Playwright MCP = Claude Code's interactive browser tool used only during dev/demo sessions with the AI assistant, never in CI/CD; (b) Platform Playwright = `npx playwright test` running generated `.spec.ts` files, used in every pipeline run and in CI. Add a short explainer to `architecture/05-ci-cd.md` and `architecture/04-web-ui.md`.
2. **[NEW] Comprehensive service testing — make it robust and reliable** — [Eng] This is the current #1 engineering priority. See the full breakdown in the "Service Hardening & Testing" section below.
3. **Schedule and run the live POC demo** — [QA Lead] Book a team or cross-team session; the demo content is ready. This unblocks KR 5.1 completion.
4. **Publish findings and limitations to Confluence** — [QA Lead] Write up POC learnings, known gaps, and LLM fallback behaviour post-demo.
5. **Publish the architecture docs to Confluence** — [QA Lead] The `architecture/` suite (5 docs + Mermaid diagrams) is complete in the repo; publish it to the agreed Confluence space.
6. **Get Engineering stakeholder review on record** — [QA Lead + Eng] Schedule a review session for the architecture document; record sign-off.
7. **Onboard at least one real product area** — [QA Lead + Eng] Replace the-internet.herokuapp.com demo scenarios with real product scenarios to satisfy KR 5.3 and KR 5.4 delivery requirements.
8. **Define and implement stakeholder results reporting** — [QA Lead + Eng] Establish how pass/fail results are surfaced to stakeholders beyond PR comments.
9. **Write the 2027 roadmap document** — [QA Lead] Cover second-phase subsystems with effort estimates, dependency mapping, and Engineering collaboration proposal.

---

---

## 🔧 Service Hardening & Testing  *(pre-delivery blocker)*

**Status: ⬜ Not started**

This work is a prerequisite before the platform can be confidently demonstrated, onboarded to a real product area, or presented to Engineering stakeholders. A service that isn't robustly tested against multiple real apps cannot be considered delivery-ready.

---

### 1. Playwright MCP Clarification  *(documentation task)*

| Item | Status |
|------|--------|
| Document the distinction: Playwright MCP (Claude's interactive tool) vs Platform Playwright (`npx playwright test`) | ⬜ Not started |
| Add explainer to `architecture/04-web-ui.md` — how the pipeline run is triggered, what Playwright is actually invoked | ⬜ Not started |
| Add explainer to `architecture/05-ci-cd.md` — confirm Playwright MCP plays no role in CI/CD | ⬜ Not started |
| Add a FAQ entry: "Can I use Playwright MCP in CI?" (answer: no, and you don't need to) | ⬜ Not started |

**Action items:**
- [ ] [Eng] Add a "Two Playwright Contexts" section to `architecture/05-ci-cd.md` explaining the distinction with a clear table.
- [ ] [Eng] Add a note to `architecture/04-web-ui.md` clarifying that the "Run Pipeline" button triggers `npx playwright test` (not the Playwright MCP).

---

### 2. Unit Test Coverage — Platform Source Code

Current unit tests exist but coverage is uneven. Every subsystem must have tests before the service is reliable.

| Subsystem | Unit Tests | Status |
|-----------|-----------|--------|
| BDD Parser | Edge cases (multi-scenario, Scenario Outline, malformed files) | 🔄 Partial |
| Vocabulary Registry | matchStep(), findClosest(), version loading | 🔄 Partial |
| Vocabulary Linter | Warnings, --fix rewrites, lint-log output | 🔄 Partial |
| Planning Engine — deterministic path | All vocabulary step types | 🔄 Partial |
| Planning Engine — LLM path | Mock Gemini responses, schema validation | ⬜ Not started |
| Code Generator | Spec structure, provenance header, escapeQuotes() | 🔄 Partial |
| Spec Validator | Syntax errors caught before file write | ⬜ Not started |
| Execution Runner | crashedBeforeTests flag, count reading from JSON report | ⬜ Not started |
| Failure Analyzer | All 5 category classifications | ⬜ Not started |
| Selector Health | Pass/fail accumulation, unstable threshold logic | ⬜ Not started |
| Feedback Aggregator | Priority assignment, deduplication | ⬜ Not started |
| Heal Engine | Jaccard scoring, stable selector protection, patch file shape | ⬜ Not started |

**Action items:**
- [ ] [Eng] Audit existing unit test coverage (`npm run test:unit`) and identify gaps.
- [ ] [Eng] Write missing unit tests for Execution Runner, Failure Analyzer, Spec Validator, Selector Health, and Heal Engine.
- [ ] [Eng] Add mock Gemini response fixtures for Planning Engine LLM path tests (no real API calls in unit tests).
- [ ] [Eng] Set a coverage threshold in Vitest config and enforce it in CI.

---

### 3. Integration Tests — Pipeline End-to-End

Full pipeline runs against controlled, predictable targets. These catch regressions that unit tests cannot.

| Test scenario | Target app | Status |
|--------------|-----------|--------|
| Full pipeline: login scenario (happy path) | the-internet.herokuapp.com/login | 🔄 Manual only |
| Full pipeline: broken selector recovery | Mock app with selector changes between runs | ⬜ Not started |
| Full pipeline: LLM fallback path | Scenario with a step not in vocabulary | ⬜ Not started |
| Full pipeline: crash detection (bad spec) | Intentionally malformed generated spec | ⬜ Not started |
| Full pipeline: multi-scenario feature file | Feature with 3+ scenarios | ⬜ Not started |
| Heal pipeline: proposal generation | Known-broken selector + re-explored app | ⬜ Not started |
| Heal pipeline: stable selector protection | Selector with ≥20 runs, ≤2% fail rate | ⬜ Not started |

**Action items:**
- [ ] [Eng] Create a lightweight local mock app (static HTML, no backend required) with known, predictable elements for integration test targets.
- [ ] [Eng] Write integration test scripts (or npm scripts) that run the full pipeline against the mock app and assert on outputs (generated spec content, pass/fail counts, failure-analysis.json shape).
- [ ] [Eng] Add an integration test run to CI as a separate job that runs after unit tests.

---

### 4. UI Testing — Web Interface

The Web UI (Monaco editor, run controls, bottom tabs, SSE stream) needs its own test coverage.

| Area | What to test | Status |
|------|-------------|--------|
| File picker | Load .feature file into editor | ⬜ Not started |
| Monaco editor | Save with Ctrl+S, content persists to disk | ⬜ Not started |
| Vocabulary autocomplete | Typing "When " triggers suggestions; selecting inserts canonical term | ⬜ Not started |
| Lint button | Warnings appear in Lint Output tab | ⬜ Not started |
| Run Pipeline button | SSE log streams, status badge updates | ⬜ Not started |
| --fresh checkbox | Pipeline runs with --fresh flag when checked | ⬜ Not started |
| Stop button | Pipeline subprocess is killed | ⬜ Not started |
| Selector Health tab | Table renders after pipeline run | ⬜ Not started |
| Feedback tab | Proposals render after feedback:update | ⬜ Not started |
| Heal Proposals tab | Proposals render after heal run | ⬜ Not started |
| Page Model info bar | Updates after pipeline run, colour coding correct | ⬜ Not started |

**Action items:**
- [ ] [Eng] Write Playwright E2E tests for the Web UI using the mock app as the pipeline target (so tests are fast and deterministic).
- [ ] [Eng] Cover: file load/save, autocomplete trigger + selection, lint button, full run + SSE stream completion, all four bottom tabs.
- [ ] [Eng] Add UI tests to CI (requires `npm run serve` to be started as a background service step before the tests run).

---

### 5. Multi-App Compatibility

The platform must work against apps other than the-internet.herokuapp.com. Each app will expose new edge cases in the explorer, planner, and selector logic.

| App type | Status |
|----------|--------|
| the-internet.herokuapp.com (current demo target) | ✅ Working |
| Single-page app (React/Vue with client-side routing) | ⬜ Not tested |
| App with dynamic content / lazy-loaded elements | ⬜ Not tested |
| App with shadow DOM components | ⬜ Not tested |
| App with no data-testid attributes (selector fallback stress test) | ⬜ Not tested |
| App requiring authentication (session handling) | ⬜ Not tested |
| App with iframes | ⬜ Not tested |

**Action items:**
- [ ] [Eng] Run the pipeline against at least 2 additional publicly accessible demo apps and document which edge cases break (e.g. TodoMVC, Conduit, Hacker News SPA).
- [ ] [Eng] Identify the top 3 failure modes from multi-app testing and create issues/tasks to fix them before the real product onboarding.
- [ ] [Eng] Document app compatibility assumptions in `architecture/02-components.md` (App Explorer section).

---

### 6. CI/CD Hardening

| Item | Status |
|------|--------|
| Unit tests run in CI and block merge on failure | ✅ Done |
| Full pipeline runs in CI | ✅ Done |
| Pipeline timeout configured (120s per spec) | ✅ Done |
| Integration tests run in CI | ⬜ Not started |
| UI tests run in CI | ⬜ Not started |
| Test coverage threshold enforced in CI | ⬜ Not started |
| Flaky test detection (Playwright retries configured) | ✅ Done (retries: 1) |
| Parallel spec execution | ⬜ Not configured |
| Pipeline run time monitored / baseline established | ⬜ Not started |

**Action items:**
- [ ] [Eng] Add integration test job to `.github/workflows/qa-pipeline.yml`.
- [ ] [Eng] Add UI test job (start server, run Playwright against it, tear down).
- [ ] [Eng] Add coverage threshold check to unit test job.
- [ ] [Eng] Measure and document baseline pipeline run time. Set an alert threshold.

---

## KR 5.1 — AI-Driven QA Platform POC Completed and Demonstrated (Q2)

**Overall: 60% complete**

The full pipeline is built and functional end-to-end. The blocker is that no live demo has been run and findings have not been published.

### What's Done vs What's Left

| Item | Status | Notes |
|------|--------|-------|
| BDD scenario input stage implemented | ✅ Done | Web UI with Monaco editor, Gherkin highlighting, vocab autocomplete |
| App Explorer output implemented | ✅ Done | Multi-page exploration, selector priority chain, testid coverage |
| Planner-generated action plan implemented | ✅ Done | 2-pass planning (vocab-deterministic + Gemini LLM fallback), plan caching |
| Code Generator output implemented | ✅ Done | TypeScript Playwright spec output with provenance headers |
| At least one Playwright spec executed with visible pass or partial result | ✅ Done | Execution Runner produces JSON + HTML reports; pass/fail captured |
| Live demo scheduled | ⬜ Not started | No demo session booked |
| Live demo run with team or cross-team audience | ⬜ Not started | Depends on scheduling |
| Findings and limitations documented in Confluence | ⬜ Not started | No Confluence page published |

### Action Items

- [ ] [QA Lead] Schedule a live demo session with team or cross-team audience — identify attendees, book calendar slot, and prepare demo script covering the full pipeline.
- [ ] [QA Lead] Run the live demo and record the session if possible.
- [ ] [QA Lead] Write and publish a Confluence page covering POC findings: what worked, known limitations, LLM fallback behaviour, selector stability observations, and open questions.

---

## KR 5.2 — Core Architecture Defined and Validated (Q2)

**Overall: 65% complete**

All 10 MVP subsystems exist in code. A full formal architecture suite has now been written in `architecture/` covering all subsystems with flow diagrams. The remaining gaps are Confluence publishing and an Engineering stakeholder review.

### What's Done vs What's Left

| Item | Status | Notes |
|------|--------|-------|
| Vocabulary Registry subsystem implemented | ✅ Done | core.yaml v1.1.0, versioned, vocab:analyze CLI |
| BDD Authoring subsystem implemented | ✅ Done | Web UI with Monaco editor |
| Vocabulary Linter subsystem implemented | ✅ Done | Deterministic, step-level warnings, closest canonical match, --fix flag |
| Scenario Parser subsystem implemented | ✅ Done | Full multi-scenario, Scenario Outline support, BDDStep.line numbers |
| Action Library subsystem implemented | ✅ Done | 7 helpers covering core interactions and assertions |
| Planning Engine subsystem implemented | ✅ Done | 2-pass, plan caching, validation against page model |
| Code Generator subsystem implemented | ✅ Done | TypeScript Playwright spec, pre-write syntax check |
| Execution Runner subsystem implemented | ✅ Done | No shell injection, JSON + HTML reports, crash vs failure distinction |
| Failure Analyzer subsystem implemented | ✅ Done | 5 categories classified |
| Reporting subsystem implemented | ✅ Done | HTML report, selector health HTML, PR comments |
| Document covers component responsibilities | ✅ Done | `architecture/02-components.md` — all 10 subsystems with inputs/outputs/examples |
| Document covers integration points | ✅ Done | `architecture/02-components.md` — component interaction map with Mermaid diagram |
| Document covers phased build sequence | ✅ Done | `architecture/03-pipelines.md` — Generate + Heal pipelines with full flow diagrams |
| Architecture doc includes non-technical overview | ✅ Done | `architecture/01-overview.md` — for QA engineers and stakeholders |
| Architecture doc includes Web UI guide | ✅ Done | `architecture/04-web-ui.md` — layout, SSE flow, API endpoints |
| Architecture doc includes CI/CD guide | ✅ Done | `architecture/05-ci-cd.md` — triggers, jobs, artifacts, merge gates |
| Formal architecture document published to Confluence | ⬜ Not started | `architecture/` exists in repo; Confluence publishing pending |
| Engineering stakeholder review completed | ⬜ Not started | No review scheduled |
| Review sign-off recorded | ⬜ Not started | Depends on review being run |

### Action Items

- [x] [QA Lead] Draft the formal architecture document covering all 10 MVP subsystems — **done** (`architecture/` directory, 5 docs + Mermaid flow diagrams).
- [ ] [QA Lead] Publish the architecture docs to Confluence in the appropriate space.
- [ ] [QA Lead + Eng] Schedule and run a review session with at least one Engineering stakeholder.
- [ ] [QA Lead] Record that the review took place (e.g. Confluence comment, meeting notes attached to the doc, or Asana task update).

---

## KR 5.3 — MVP Phase 1 Delivered: Specification and Governance Layer (Q3)

**Overall: 100% complete (technical)**

> **Note:** All subsystems are operational and the pipeline runs end-to-end. However, all demonstrated scenarios run against the-internet.herokuapp.com (a public demo site). If "real app context against at least one product area" is interpreted strictly, this KR requires onboarding a real product area. The 100% rating reflects technical readiness; consider revisiting if product onboarding is treated as a hard requirement.

### What's Done vs What's Left

| Item | Status | Notes |
|------|--------|-------|
| Vocabulary Registry operational with defined, versioned action vocabulary | ✅ Done | core.yaml v1.1.0 with lint + analysis tooling |
| BDD Authoring interface operational | ✅ Done | Web UI with Monaco editor and vocab autocomplete |
| Vocabulary Linter producing deterministic validation output | ✅ Done | Step-level warnings, closest canonical match suggestions, --fix flag |
| Scenario Parser producing structured JSON from validated BDD | ✅ Done | Multi-scenario, Scenario Outline support, line numbers |
| At least 3 real product scenarios parsed end-to-end | 🔄 In progress | Scenarios exist against demo site; no real product area onboarded yet |

### Action Items

- [ ] [QA Lead + Eng] Identify a real product area to onboard. Write at least 3 BDD scenarios against it, run them through the full Specification and Governance Layer, and confirm structured JSON output.
- [ ] [QA Lead] Document the onboarded scenarios as the formal evidence of KR 5.3 delivery.

---

## KR 5.4 — MVP Phase 2 Delivered: Test Synthesis and Execution Layer (Q4)

**Overall: 75% complete**

All subsystems are built and operational. The gaps are: no real product scenarios have been executed end-to-end (only demo site scenarios), the Failure Analyzer covers only 3 of the required "at least 3" categories (5 are implemented, so this is met), and there is no defined mechanism for reporting results to stakeholders beyond PR comments.

### What's Done vs What's Left

| Item | Status | Notes |
|------|--------|-------|
| Planning Engine operational, mapping parsed scenarios to executable action sequences | ✅ Done | 2-pass planning with Gemini fallback and plan caching |
| Code Generator producing Playwright specs from plans | ✅ Done | TypeScript output with syntax validation and provenance headers |
| Execution Runner running generated specs with pass/fail results captured | ✅ Done | Runs in CI, JSON + HTML reports, crash vs failure distinction |
| Failure Analyzer classifying at least 3 failure categories | ✅ Done | 5 categories: selector_drift, timing, bad_generation, missing_data, product_defect |
| At least 5 real product scenarios generated and executed end-to-end | ⬜ Not started | Demo site scenarios exist; no real product area onboarded |
| Results reported to stakeholders | 🔄 In progress | PR comments implemented; no broader stakeholder notification defined |

### Action Items

- [ ] [QA Lead + Eng] Onboard a real product area (coordinate with KR 5.3 action item). Execute at least 5 real product scenarios end-to-end through Planning Engine, Code Generator, and Execution Runner.
- [ ] [QA Lead] Capture the results (pass/fail + failure analysis) as formal evidence of KR 5.4 delivery.
- [ ] [QA Lead + Eng] Define and implement a stakeholder results reporting mechanism — decide whether PR comments are sufficient or whether a dashboard, email summary, or Confluence report page is required.
- [ ] [QA Lead] Notify stakeholders of results after first real product area execution run.

---

## KR 5.5 — Platform Roadmap for 2027 Published (Q4)

**Overall: 0% complete**

No roadmap document exists. This is a standalone deliverable requiring dedicated writing time.

### What's Done vs What's Left

| Item | Status | Notes |
|------|--------|-------|
| App Exploration Engine covered in roadmap | ⬜ Not started | Subsystem exists in code but not documented in a roadmap format |
| AI Vocabulary Reviewer covered in roadmap | ⬜ Not started | — |
| Healing Engine covered in roadmap | ⬜ Not started | Self-Healing Engine exists in code; roadmap framing not written |
| Feedback Loop covered in roadmap | ⬜ Not started | Feedback Loop exists in code; roadmap framing not written |
| Developer Experience Layer covered in roadmap | ⬜ Not started | — |
| Effort estimates included for each subsystem | ⬜ Not started | — |
| Dependency mapping included | ⬜ Not started | — |
| Engineering collaboration proposal included | ⬜ Not started | — |
| Roadmap document published | ⬜ Not started | — |

### Action Items

- [ ] [QA Lead] Draft the 2027 roadmap document covering all five second-phase subsystems: App Exploration Engine, AI Vocabulary Reviewer, Healing Engine, Feedback Loop, and Developer Experience Layer.
- [ ] [QA Lead] Include effort estimates (e.g. T-shirt sizing or sprint estimates) for each subsystem.
- [ ] [QA Lead] Include a dependency map showing which subsystems depend on MVP Phase 1 and Phase 2 being stable.
- [ ] [QA Lead] Include a section on whether Engineering collaboration is required for scale and what form that would take.
- [ ] [QA Lead + Eng] Review the roadmap with at least one Engineering stakeholder before publishing.
- [ ] [QA Lead] Publish the final roadmap document to Confluence (or equivalent agreed location).

---

## Notes and Context

- **Technical vs delivery completion:** The platform is technically more advanced than the OKR targets require. The remaining gaps are almost entirely in the delivery, documentation, and stakeholder engagement dimensions — not in code.
- **Demo site dependency:** Using the-internet.herokuapp.com was appropriate for POC development but is a blocker for claiming real-world delivery on KR 5.3 and KR 5.4. Onboarding a real product area is the single most impactful action for closing multiple KRs simultaneously.
- **Confluence publishing:** KR 5.1 and KR 5.2 both require Confluence as the publication target. Ensure the correct Confluence space and page hierarchy are agreed before writing.
- **Engineering stakeholder:** KR 5.2 requires a named Engineering stakeholder to review the architecture document. Identify this person before drafting to ensure the review can be scheduled promptly after the document is ready.
