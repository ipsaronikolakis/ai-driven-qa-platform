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
**Tracked in:** `IMPROVEMENTS.md` — Phase 5 (items 5.0 – 5.5)

This work must be complete before the platform can be demonstrated, onboarded to a real product area, or presented to Engineering stakeholders.

| Phase 5 item | Status |
|---|---|
| 5.0 Playwright MCP clarification (architecture doc updates) | ⬜ Not started |
| 5.1 UAT — UI + CI/CD end-to-end with real apps and real scenarios | ⬜ Not started |
| 5.2 Multi-app compatibility (TodoMVC, Conduit, UI Testing Playground) | ⬜ Not started |
| 5.3 Behavioral standards audit (observed vs documented standards) | ⬜ Not started |

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
- **UAT is the gate:** A successful UAT (Phase 5 in IMPROVEMENTS.md) — covering both the UI and CI/CD with real apps and real scenarios, followed by fixes and a clean re-test — is the prerequisite before any KR delivery work begins. After that gate is passed, KR 5.1, 5.2, 5.3, and 5.4 can all be driven to completion in a short focused push.
- **UAT against a real product = KR 5.3 + 5.4 evidence:** If the UAT apps are real product areas (not demo sites), the UAT run itself generates the delivery evidence for KR 5.3 (3 real scenarios parsed end-to-end) and KR 5.4 (5 real scenarios executed end-to-end). No separate onboarding step needed.
- **After UAT: what closes each KR:**
  - KR 5.1 → schedule + run live demo, publish findings to Confluence
  - KR 5.2 → publish architecture docs to Confluence, get Engineering stakeholder review on record
  - KR 5.3 → UAT evidence (if real product) + document it
  - KR 5.4 → UAT evidence (if real product) + define stakeholder reporting
  - KR 5.5 → standalone roadmap writing task, independent of UAT
- **Confluence publishing:** KR 5.1 and KR 5.2 both require Confluence as the publication target. Ensure the correct Confluence space and page hierarchy are agreed before writing.
- **Engineering stakeholder:** KR 5.2 requires a named Engineering stakeholder to review the architecture document. Identify this person before drafting to ensure the review can be scheduled promptly after the document is ready.
