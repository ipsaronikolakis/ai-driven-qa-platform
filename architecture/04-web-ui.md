# Web UI

This document describes the Web UI — what it does, how each panel works, keyboard shortcuts, and the API endpoints that back it.

---

## Starting the UI

```
npm run serve
# Opens at http://localhost:3000
```

---

## Layout Overview

The UI is divided into three panels:

- **Left panel (55% width):** file tree and Monaco editor for authoring BDD scenarios
- **Right panel:** pipeline run controls and live log output
- **Bottom panel (220px):** tabbed data panel showing selector health, heal proposals, lint output, and feedback

---

## Left Panel — BDD Scenario Editor

### File Picker

A dropdown at the top of the panel lists all `.feature` files found in `scenarios/`. Selecting "All files" shows a read-only summary of all features and their scenarios. Selecting a single file enables editing in the Monaco editor below.

### Monaco Editor Features

**Gherkin syntax highlighting**
- BDD keywords (`Feature`, `Scenario`, `Given`, `When`, `Then`, `And`, `But`) are rendered in colour
- Quoted strings within step text are highlighted
- Comment lines are dimmed

**Vocabulary autocomplete**
- Type a BDD keyword followed by a space to trigger a dropdown of all canonical vocabulary terms
- Type partial text to filter the list
- Press Enter to insert the selected term
- `{param}` placeholders are inserted as literal text for the author to fill in

**Save**
- Keyboard shortcut: `Ctrl+S`
- Button: "Save"
- Sends `PUT /api/scenarios/:name` with the current editor content

**Lint**
- Button: "Lint"
- Sends `POST /api/lint` with the current editor content
- Warnings are displayed in the Lint Output tab in the bottom panel

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save current file |

---

## Right Panel — Pipeline Runner

### Run Toolbar

| Control | Behaviour |
|---------|-----------|
| "Run Pipeline" button | Sends `POST /api/run`; streams output via SSE |
| "Stop" button | Aborts the SSE stream and kills the pipeline subprocess |
| `--fresh` checkbox | When checked, passes `--fresh` to the pipeline, bypassing all caches |
| Status badge | Shows current state: Idle / Running / Passed (green) / Failed (red) |
| "View Report" link | Appears after a run completes; opens `/api/report` in a new tab |

### Page Model Info Bar

Displayed between the run toolbar and the log area. Updated on page load and after each pipeline run by reading `output/stage2-page-model.json`.

Format:
```
Page model: N elements | testid coverage: X% | N unstable selectors
```

Colour coding:
- testid coverage: green if ≥ 80%, yellow if ≥ 40%, red if < 40%
- unstable selectors: green if 0, yellow if ≤ 3, red if > 3

### Run Log

- Streams SSE output line by line as the pipeline executes
- Rendered in a monospace font
- Auto-scrolls to the bottom as new lines arrive

---

## Bottom Panel — Tabs

### Selector Health Tab

Displays a table of all selectors tracked by the platform.

| Column | Description |
|--------|-------------|
| Selector | The selector string |
| Runs | Total number of test runs that used this selector |
| Failures | Number of runs in which this selector failed |
| Fail Rate | Failures / Runs as a percentage |
| Status | Pill: `stable` / `unstable` / `new` |

- Sorted by fail rate descending
- Auto-refreshes after each pipeline run
- Data source: `GET /api/selector-health`

### Heal Proposals Tab

Displays replacement suggestions produced by the heal pipeline.

| Column | Description |
|--------|-------------|
| Old Selector | The selector that is failing |
| Suggested Replacement | The proposed new selector from the healer |
| Confidence % | Healer confidence score (0–100%) |

- Populated from `output/heal-proposals/*.patch.json`
- Run `npm run heal` to generate or refresh proposals
- Data source: `GET /api/output` + individual patch files

### Lint Output Tab

Shows warnings from the most recent "Lint" button click.

- Each warning is prefixed with a warning symbol: `⚠ <warning message>`
- When no issues are found: `No warnings — all steps canonical`

### Feedback Tab

Shows improvement proposals aggregated by `npm run feedback:update`.

- Proposals are grouped by type: `vocab-gap`, `selector-instability`, `repeated-failures`
- Each proposal shows a priority pill (`high` / `medium` / `low`), evidence, and a suggestion
- Run `npm run feedback:update` to populate or refresh
- Data source: `GET /api/feedback-proposals`

---

## API Endpoints

All endpoints are defined in `server.ts`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/scenarios` | List all `.feature` files with their content |
| `GET` | `/api/scenarios/:name` | Read a single `.feature` file |
| `PUT` | `/api/scenarios/:name` | Save a `.feature` file |
| `POST` | `/api/lint` | Lint posted content; returns a `warnings` array |
| `GET` | `/api/vocabulary` | List all vocabulary terms (used for autocomplete) |
| `POST` | `/api/run` | Run the pipeline; streams SSE output |
| `GET` | `/api/report` | Serve the Playwright HTML report (dark mode CSS injected) |
| `GET` | `/api/report-ready` | Returns `{ ready: bool }` indicating whether a report is available |
| `GET` | `/api/output` | List all files under `output/` |
| `GET` | `/api/output/*path` | Read a specific file from `output/` |
| `GET` | `/api/selector-health` | Return the contents of `output/selector-health.json` |
| `GET` | `/api/feedback-proposals` | Return the contents of `output/feedback/proposals.json` |
