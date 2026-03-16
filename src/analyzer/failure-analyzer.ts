import * as fs from 'fs';
import * as path from 'path';
import { FailureAnalysis, FailureCategory, FailureRecord } from '../types';

// ---------------------------------------------------------------------------
// Playwright JSON reporter output types (subset we use)
// ---------------------------------------------------------------------------

interface PWError {
  message?: string;
  stack?: string;
}

interface PWResult {
  status: 'passed' | 'failed' | 'timedOut' | 'interrupted' | 'skipped';
  error?: PWError;
  /** All errors including per-step call-log details — richer than `error` alone. */
  errors?: PWError[];
}

interface PWTest {
  results: PWResult[];
}

interface PWSpec {
  title: string;
  ok: boolean;
  tests: PWTest[];
}

interface PWSuite {
  title: string;
  file?: string;
  specs: PWSpec[];
  suites?: PWSuite[];
}

interface PWReport {
  suites: PWSuite[];
}

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

const SUGGESTIONS: Record<FailureCategory, string> = {
  selector_drift:  'Re-run the App Explorer to refresh the page model, then regenerate the spec.',
  timing:          'Add waitForLoadState or increase timeouts; check network / environment.',
  bad_generation:  'Re-prompt Gemini with the compile error as context; check code generator templates.',
  missing_data:    'Verify seed data exists in the target environment; check 404 responses.',
  product_defect:  'Assertion mismatch — review whether the UI changed intentionally; flag for human review.',
};

/**
 * Classifies a failure using all available error data from the result.
 *
 * `errors` (plural) contains richer per-step call-log details; `error`
 * (singular) only holds the top-level summary. We combine them all.
 *
 * Precedence (most unambiguous → most general):
 *   1. bad_generation  — compile / module / syntax errors
 *   2. timing          — navigation / network errors
 *   3. missing_data    — 404 / empty content
 *   4. selector_drift  — "waiting for locator" in call log, or page.action timeout
 *   5. timing          — any other timeout / timedOut status
 *   6. product_defect  — everything else (assertion mismatch)
 */
function classify(result: PWResult): FailureCategory {
  // Combine all error messages — `errors[]` has call-log detail `error` lacks
  const allErrors = [result.error, ...(result.errors ?? [])].filter(Boolean) as PWError[];
  const raw = allErrors.map(e => [(e.message ?? ''), (e.stack ?? '')].join('\n')).join('\n');
  const msg = raw.toLowerCase();

  if (/cannot find module|syntaxerror|unexpected token|ts\d{4}|compilation failed/i.test(raw)) {
    return 'bad_generation';
  }
  if (/navigation timeout|net::err_|err_connection|neterr|failed to load resource/i.test(msg)) {
    return 'timing';
  }
  if (/404|page not found|no such element|empty page/i.test(msg)) {
    return 'missing_data';
  }
  // Assertion failures — catch these before the generic timeout rule because
  // Playwright embeds "Timeout: Xms" in toContainText/toBeVisible errors too.
  if (result.status === 'failed' && /tocontaintext|tobevisible|tohaveurl|tohavetext|toequal|expect.*failed/i.test(msg)) {
    return 'product_defect';
  }
  // Selector drift: locator wait log or page.action() timeout with a locator hint
  if (/waiting for locator|page\.(click|fill|press|hover|check|type).*timeout|strict mode violation|element is not attached/i.test(msg)) {
    return 'selector_drift';
  }
  // General timeout (navigation, test-level) without a locator signal
  if (result.status === 'timedOut' || /timeout|timed out/i.test(msg)) {
    return 'timing';
  }
  return 'product_defect';
}

// ---------------------------------------------------------------------------
// Report walker
// ---------------------------------------------------------------------------

/** Recursively collects all failing specs from a suite tree. */
function collectFailures(suite: PWSuite, results: FailureRecord[]): void {
  for (const spec of suite.specs ?? []) {
    if (spec.ok) continue;

    for (const test of spec.tests) {
      for (const result of test.results) {
        if (result.status === 'passed') continue;

        const category = classify(result);
        // Use the richest error message available for the summary
        const summaryError =
          (result.errors ?? []).find(e => e.message && e.message !== result.error?.message) ??
          result.error ??
          { message: `Test ${result.status}` };
        const errorSummary = (summaryError.message ?? 'No error message')
          .replace(/\u001b\[\d+m/g, '')  // strip ANSI colour codes
          .split('\n')[0]
          .trim();

        results.push({
          test:    spec.title,
          file:    suite.file ?? suite.title,
          category,
          suggestion: SUGGESTIONS[category],
          errorSummary,
        });
      }
    }
  }

  for (const child of suite.suites ?? []) {
    collectFailures(child, results);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads the Playwright JSON reporter output and writes a categorised failure
 * analysis to `output/failure-analysis.json`.
 *
 * Returns the analysis object, or null if the JSON reporter file does not
 * exist (i.e. the run succeeded and Playwright may not have written it yet).
 */
export function analyzeFailures(
  playwrightJsonPath: string,
  specFilePath: string,
  outputDir: string,
): FailureAnalysis | null {
  if (!fs.existsSync(playwrightJsonPath)) {
    return null;
  }

  let report: PWReport;
  try {
    report = JSON.parse(fs.readFileSync(playwrightJsonPath, 'utf-8')) as PWReport;
  } catch {
    console.warn('[Analyzer] Could not parse Playwright JSON report — skipping analysis.');
    return null;
  }

  const failures: FailureRecord[] = [];
  for (const suite of report.suites ?? []) {
    collectFailures(suite, failures);
  }

  if (failures.length === 0) return null;

  const analysis: FailureAnalysis = {
    runAt: new Date().toISOString(),
    specFile: specFilePath,
    totalFailed: failures.length,
    failures,
  };

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outPath = path.join(outputDir, 'failure-analysis.json');
  fs.writeFileSync(outPath, JSON.stringify(analysis, null, 2), 'utf-8');
  return analysis;
}

/**
 * Formats a FailureAnalysis for console output.
 */
export function formatAnalysis(analysis: FailureAnalysis): string {
  const lines: string[] = [
    `  Failure analysis (${analysis.totalFailed} failure${analysis.totalFailed !== 1 ? 's' : ''}):`,
  ];

  for (const f of analysis.failures) {
    lines.push(`    [${f.category}] "${f.test}"`);
    lines.push(`      Error:      ${f.errorSummary}`);
    lines.push(`      Suggestion: ${f.suggestion}`);
  }

  return lines.join('\n');
}
