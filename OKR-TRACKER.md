# OKR Tracker — Objective 5: AI-Driven QA Platform (POC to MVP)

**Last updated:** 2026-03-17

---

## Summary

| KR | Title | Status | % Complete |
|----|-------|--------|-----------|
| KR 5.1 | POC Completed and Demonstrated | 🔄 In progress | 60% |
| KR 5.2 | Core Architecture Defined and Validated | 🔄 In progress | 40% |
| KR 5.3 | MVP Phase 1 Delivered: Specification and Governance Layer | ✅ Done | 100% |
| KR 5.4 | MVP Phase 2 Delivered: Test Synthesis and Execution Layer | 🔄 In progress | 75% |
| KR 5.5 | Platform Roadmap for 2027 Published | ⬜ Not started | 0% |

---

## Next Priority Actions

These are the highest-leverage actions needed to close remaining OKR gaps:

1. **Schedule and run the live POC demo** — [QA Lead] Book a team or cross-team session; the demo content is ready. This unblocks KR 5.1 completion.
2. **Publish findings and limitations to Confluence** — [QA Lead] Write up POC learnings, known gaps, and LLM fallback behaviour post-demo.
3. **Publish the formal architecture document to Confluence** — [QA Lead] Formalise what exists in IMPROVEMENTS.md and code into the required component-level doc.
4. **Get Engineering stakeholder review on record** — [QA Lead + Eng] Schedule a review session for the architecture document; record sign-off.
5. **Write the 2027 roadmap document** — [QA Lead] Cover second-phase subsystems with effort estimates, dependency mapping, and Engineering collaboration proposal.
6. **Onboard at least one real product area** — [QA Lead + Eng] Replace the-internet.herokuapp.com demo scenarios with real product scenarios to satisfy KR 5.3 and KR 5.4 delivery requirements.
7. **Define and implement stakeholder results reporting** — [QA Lead + Eng] Establish how pass/fail results are surfaced to stakeholders beyond PR comments.

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

**Overall: 40% complete**

All 10 MVP subsystems exist in code and are described informally in IMPROVEMENTS.md. The gap is a formal, published architecture document and a recorded Engineering stakeholder review.

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
| Formal architecture document published to Confluence | ⬜ Not started | Only code + IMPROVEMENTS.md exist |
| Document covers component responsibilities | ⬜ Not started | Depends on document being created |
| Document covers integration points | ⬜ Not started | Depends on document being created |
| Document covers phased build sequence | ⬜ Not started | Depends on document being created |
| Engineering stakeholder review completed | ⬜ Not started | No review scheduled |
| Review sign-off recorded | ⬜ Not started | Depends on review being run |

### Action Items

- [ ] [QA Lead] Draft the formal architecture document covering all 10 MVP subsystems: component responsibilities, integration points, data flow, and phased build sequence. Use IMPROVEMENTS.md as a source.
- [ ] [QA Lead] Publish the architecture document to Confluence in the appropriate space.
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
