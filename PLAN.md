# AI-Driven QA Platform — Build Plan

> This document tracks what was built during the PoC, the pipeline architecture, and file reference.
> For improvements and future phases, see IMPROVEMENTS.md.
> For the original idea, see INITIAL-PLAN.md.

---

## Overview

End-to-end pipeline: write a BDD scenario → AI explores the app → AI plans the test → generates Playwright code → runs it.

**Demo target app:** https://the-internet.herokuapp.com/login
**LLM:** Google Gemini 2.5 Flash
**Test framework:** Playwright (TypeScript)

---

## Pipeline Architecture

```
scenarios/login.feature
        ↓
[Stage 1] BDD Parser         → ParsedScenario (JSON)
        ↓
[Stage 2] App Explorer       → PageModel (JSON)       ← Playwright crawls target URL
        ↓
[Stage 3] LLM Planner        → TestPlan (JSON)        ← Gemini API
        ↓
[Stage 4] Code Generator     → generated/*.spec.ts    ← deterministic template
        ↓
[Stage 5] Runner             → pass/fail report       ← Playwright executes spec
```

---

## PoC Deliverables

| # | Deliverable | Status | File(s) |
|---|-------------|--------|---------|
| 1 | Project scaffold (package.json, tsconfig, playwright.config) | ✅ Done | `package.json`, `tsconfig.json`, `playwright.config.ts` |
| 2 | Shared type definitions | ✅ Done | `src/types.ts` |
| 3 | BDD Parser | ✅ Done | `src/bdd-parser/parser.ts` |
| 4 | App Explorer (Playwright-based page scraper) | ✅ Done | `src/app-explorer/explorer.ts` |
| 5 | LLM Planner (Gemini integration) | ✅ Done | `src/planner/planner.ts` |
| 6 | Code Generator (plan → Playwright spec) | ✅ Done | `src/code-generator/generator.ts` |
| 7 | Pipeline Runner (exec generated spec) | ✅ Done | `src/runner/runner.ts` |
| 8 | Pipeline Orchestrator | ✅ Done | `src/index.ts` |
| 9 | Example BDD scenario (login) | ✅ Done | `scenarios/login.feature` |
| 10 | End-to-end pipeline verified (`npm start`) | ✅ Done | — |

---

## What is Hardcoded (PoC scope)

Intentionally hardcoded to prove the concept, not for generality:

- Target URL: `https://the-internet.herokuapp.com/login`
- One scenario: login flow
- One browser: Chromium
- One code template: Playwright TypeScript
- No drag-and-drop, iframes, file uploads, or complex widgets
- Credentials in scenario steps (not secrets manager)

---

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Pipeline orchestrator — start here |
| `src/types.ts` | All shared TypeScript interfaces |
| `src/bdd-parser/parser.ts` | Gherkin → `ParsedScenario` |
| `src/app-explorer/explorer.ts` | URL → `PageModel` via Playwright |
| `src/planner/planner.ts` | `ParsedScenario` + `PageModel` → `TestPlan` via Gemini |
| `src/code-generator/generator.ts` | `TestPlan` → `generated/*.spec.ts` |
| `src/runner/runner.ts` | Executes spec, returns `RunResult` |
| `scenarios/login.feature` | Example BDD scenario |
| `playwright.config.ts` | Playwright config (points at `./generated`) |
| `.env.example` | Env var template |

---

## How to Run

```bash
npm install
npx playwright install chromium
cp .env.example .env   # add GEMINI_API_KEY and GEMINI_MODEL
npm start
```
