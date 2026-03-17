# AI-Driven QA Platform — Overview

**Audience:** QA engineers, product managers, engineering stakeholders.
**Purpose:** Explain what the system is, why it exists, and how it works — without requiring any knowledge of the implementation.

---

## What Is the AI-Driven QA Platform?

The AI-Driven QA Platform is a system that takes human-readable BDD test scenarios — written in plain English using the Gherkin format — connects to your web application to understand its UI, and automatically generates, runs, and maintains Playwright test specs. QA engineers never write any test code by hand.

A QA author describes what the application should do in natural language. The platform handles everything else: it reads the live UI, writes the code, executes it, and reports the result.

---

## The Problem It Solves

Automated UI testing has a well-known maintenance problem:

- **Writing and maintaining automated UI tests is the biggest bottleneck in QA.** Test suites grow faster than the team's capacity to maintain them.
- **Selectors break when the app changes.** A button gets renamed, a `div` gets an extra wrapper, and suddenly 40 tests are failing — not because the product is broken, but because the test code is out of date.
- **Test code diverges from the BDD scenarios it was supposed to reflect.** Developers edit the spec files to make tests pass, and within a few weeks the code no longer matches what the scenario describes.
- **QA engineers spend more time fixing broken tests than writing new ones.** The original value proposition of automated testing erodes.

This platform addresses all four problems by treating the BDD scenario as the authoritative source of truth, generating all test code from it, and providing a structured process for handling the inevitable drift.

---

## How It Works

The platform is a pipeline. Each stage receives output from the previous one and passes its own output to the next. Here is a concrete example:

A QA author wants to verify that logging in to the application works.

**Step 1 — BDD Authoring**
The author opens the web editor and writes:

```gherkin
Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter username "tomsmith"
    And I enter password "SuperSecretPassword!"
    And I click the login button
    Then I should see "You logged into a secure area!"
```

**Step 2 — Vocabulary Linting**
Before the scenario reaches any code-generation step, the Vocabulary Linter checks it against a shared dictionary of approved step phrasings. If the author wrote "And I type my username" instead of the canonical "enter username {value}", the linter flags it and suggests the correct wording. This keeps all scenarios consistent across the entire suite.

**Step 3 — Scenario Parsing**
The plain-text scenario is converted into a structured data object: a list of steps, each tagged with its keyword (Given / When / Then), its text, and the line it appears on. This structured form is what the rest of the pipeline operates on.

**Step 4 — App Exploration**
A headless browser launches and navigates to the real, running application. It visits the login page, reads every interactive element — every button, input field, link, and form — and records each one with a selector that uniquely identifies it. It prioritises selectors that are stable by design (`data-testid` attributes), and avoids fragile positional selectors wherever possible.

**Step 5 — Planning**
The Planning Engine maps each BDD step to a concrete action. For known, well-defined steps, it resolves this locally using the vocabulary dictionary — no AI is involved. For novel or ambiguous steps, it sends the scenario and the page map to Gemini to determine what action to take and which element to target. The plan records, for every action, whether it was resolved locally or by the AI.

**Step 6 — Code Generation**
The plan is turned into a valid Playwright TypeScript test file. The generated file calls shared helper functions (`fillInput`, `clickElement`, etc.) rather than using the raw Playwright API directly. This means all generated specs follow the same structure and can be updated in one place. A provenance header is written at the top of every file recording when it was generated, which vocabulary version was used, and a fingerprint of the page model.

**Step 7 — Execution**
The generated spec is executed by Playwright. On failure, Playwright captures a screenshot and a full trace for inspection. Results are written to a structured JSON file.

**Step 8 — Failure Analysis**
If any tests fail, the Failure Analyzer reads the error output and classifies what went wrong into one of five categories: a selector that no longer matches an element, a timing/network issue, a code generation error, a missing data or environment problem, or a genuine product defect where the application behaved differently than specified. Each failure gets a plain-language suggestion explaining the recommended next step.

**Step 9 — Reporting**
Results are surfaced in multiple places: the Web UI shows pass/fail with links to the Playwright HTML report; a Selector Health dashboard tracks which selectors are becoming unreliable over time; a Feedback panel aggregates patterns (repeated linting failures, high-failure-rate selectors, common failure categories) into prioritised improvement proposals.

---

## Two Workflows

The platform has two distinct pipelines, each invoked separately.

**Generate pipeline** (`npm run pipeline` or the "Run Pipeline" button in the Web UI)

Takes a BDD scenario through the full sequence: lint → parse → explore → plan → generate → execute → analyse → report. This is the primary day-to-day workflow.

**Heal pipeline** (`npm run heal`)

Takes the output of a failing CI run and compares the selectors in the generated specs against the current state of the application. For each selector that no longer matches, it proposes a replacement. Proposals are written to a file for human review. Nothing is changed automatically.

---

## Key Design Principles

**AI is a last resort, not the first step.**
The platform attempts to resolve every BDD step using local vocabulary rules before making any AI API call. In a mature vocabulary, the majority of scenarios require zero AI involvement. This keeps costs low, keeps latency low, and makes the system predictable.

**Nothing is auto-changed. Every proposal requires human review.**
Selector replacements, vocabulary corrections, and plan adjustments are always written as proposals, not applied directly. A QA lead reviews and approves them. This is a deliberate safety boundary.

**Selectors are treated as the number-one reliability risk.**
Every selector produced by the App Explorer is tracked across runs. Pass/fail rates are recorded. Selectors that exceed a 20% failure rate are flagged in the health dashboard. Selectors using `data-testid` are explicitly preferred, and test coverage of `data-testid` adoption is reported per page.

**Generated test code is never manually edited.**
The `DO NOT EDIT` comment in every generated spec file is enforced by a pre-commit hook. Any fix to test behaviour happens in the shared helper library or by regenerating the spec from an updated BDD scenario. This keeps the BDD scenario and the test code permanently in sync.

**The system improves over time through a structured feedback loop.**
Every lint warning is logged. Every selector failure is counted. Every failure category is tracked. The Feedback Engine aggregates this data across runs and surfaces the highest-value improvements: vocabulary gaps to fill, data-testid attributes to add, timing issues to fix.

---

## Who Uses It and How

**QA Author**
Opens the Web UI, writes or edits BDD scenarios in the Monaco editor, uses the vocabulary autocomplete to stay consistent, runs the pipeline with one click, and reviews the pass/fail results and Playwright report.

**QA Lead**
Reviews feedback proposals (vocabulary gaps, high-failure-rate selectors), approves or rejects vocabulary changes, reviews heal proposals after CI failures, and monitors the Selector Health dashboard for trending problems.

**Engineering Team**
Reviews architecture decisions, approves new vocabulary terms via pull request, and adds `data-testid` attributes to application components when the platform reports low testid coverage on a page.
