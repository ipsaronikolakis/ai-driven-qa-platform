import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectorRecord {
  passes: number;
  failures: number;
  lastSeen: string;
  /** Last 10 run results — used for per-run trending. */
  history: Array<{ runAt: string; passed: boolean }>;
}

export interface SelectorHealthMap {
  [selector: string]: SelectorRecord;
}

export type SelectorStatus = 'stable' | 'unstable' | 'new';

// ---------------------------------------------------------------------------
// Selectors are extracted from generated spec files by matching action library
// call patterns. These regexes match the code generator's single-quote style.
// ---------------------------------------------------------------------------

const SELECTOR_PATTERNS = [
  /fillInput\(page,\s*'([^']+)'/g,
  /clickElement\(page,\s*'([^']+)'/g,
  /assertVisible\(page,\s*'([^']+)'/g,
];

function extractSelectors(specContent: string): string[] {
  const selectors = new Set<string>();
  for (const re of SELECTOR_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(specContent)) !== null) {
      selectors.add(m[1]);
    }
  }
  return [...selectors];
}

// ---------------------------------------------------------------------------
// Report shape from Playwright JSON reporter
// ---------------------------------------------------------------------------

interface PWSpec { title: string; ok: boolean; tests: unknown[] }
interface PWSuite { title: string; file?: string; specs: PWSpec[]; suites?: PWSuite[] }
interface PWReport { suites?: PWSuite[] }

function collectSpecResults(suite: PWSuite, results: Map<string, boolean>): void {
  for (const spec of suite.specs ?? []) {
    const file = suite.file ?? suite.title;
    // ok=true means all retries passed; ok=false means it failed
    results.set(file, spec.ok && (results.get(file) !== false));
  }
  for (const child of suite.suites ?? []) {
    collectSpecResults(child, results);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads the Playwright JSON report and the generated spec files to extract
 * which selectors were used in passing vs failing tests. Updates
 * output/selector-health.json with cumulative pass/fail counts.
 *
 * Safe to call even when the report or spec files are missing — logs a
 * warning and returns without throwing so the pipeline exit code is unaffected.
 */
export function updateSelectorHealth(pwJsonPath: string, outputDir: string): void {
  if (!fs.existsSync(pwJsonPath)) return;

  let report: PWReport;
  try {
    report = JSON.parse(fs.readFileSync(pwJsonPath, 'utf-8')) as PWReport;
  } catch {
    console.warn('[SelectorHealth] Could not parse Playwright JSON report — skipping.');
    return;
  }

  // Collect pass/fail per spec file
  const specResults = new Map<string, boolean>();
  for (const suite of report.suites ?? []) {
    collectSpecResults(suite, specResults);
  }

  // Load existing health map
  const healthPath = path.join(outputDir, 'selector-health.json');
  let health: SelectorHealthMap = {};
  if (fs.existsSync(healthPath)) {
    try {
      health = JSON.parse(fs.readFileSync(healthPath, 'utf-8')) as SelectorHealthMap;
    } catch { /* start fresh */ }
  }

  const runAt = new Date().toISOString();

  // For each spec file, extract selectors and update health records
  for (const [specFile, passed] of specResults) {
    if (!fs.existsSync(specFile)) continue;

    let content: string;
    try {
      content = fs.readFileSync(specFile, 'utf-8');
    } catch { continue; }

    const selectors = extractSelectors(content);
    for (const selector of selectors) {
      const existing = health[selector];
      if (!existing) {
        health[selector] = {
          passes: passed ? 1 : 0,
          failures: passed ? 0 : 1,
          lastSeen: runAt,
          history: [{ runAt, passed }],
        };
      } else {
        if (passed) existing.passes++;
        else        existing.failures++;
        existing.lastSeen = runAt;
        existing.history.push({ runAt, passed });
        if (existing.history.length > 10) existing.history.shift();
      }
    }
  }

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(healthPath, JSON.stringify(health, null, 2), 'utf-8');
  console.log(`[SelectorHealth] Updated ${Object.keys(health).length} selector(s) in output/selector-health.json`);
}

/**
 * Computes the display status of a selector record.
 *   new      — fewer than 3 total runs (not enough data)
 *   unstable — failure rate > 20% with >= 3 runs
 *   stable   — failure rate <= 20% with >= 3 runs
 */
export function selectorStatus(record: SelectorRecord): SelectorStatus {
  const total = record.passes + record.failures;
  if (total < 3) return 'new';
  return record.failures / total > 0.2 ? 'unstable' : 'stable';
}
