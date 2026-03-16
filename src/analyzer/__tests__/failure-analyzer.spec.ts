/**
 * Unit tests for the failure analyzer.
 * No browser required — reads/writes temp JSON files.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { analyzeFailures, formatAnalysis } from '../failure-analyzer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpDir(): string {
  const d = path.join(os.tmpdir(), `qa-analyzer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function writePWReport(dir: string, report: object): string {
  const p = path.join(dir, 'playwright-results.json');
  fs.writeFileSync(p, JSON.stringify(report), 'utf-8');
  return p;
}

/** Builds a minimal Playwright JSON reporter output with one failing test. */
function buildReport(opts: {
  status?: 'passed' | 'failed' | 'timedOut';
  errorMessage?: string;
  errorsArray?: Array<{ message?: string; stack?: string }>;
}): object {
  return {
    suites: [{
      title: 'test file',
      file: 'generated/test.spec.ts',
      specs: [{
        title: 'test name',
        ok: false,
        tests: [{
          results: [{
            status: opts.status ?? 'failed',
            error: opts.errorMessage ? { message: opts.errorMessage, stack: '' } : undefined,
            errors: opts.errorsArray ?? [],
          }],
        }],
      }],
      suites: [],
    }],
  };
}

// ---------------------------------------------------------------------------
// analyzeFailures — null cases
// ---------------------------------------------------------------------------

test('analyzer — returns null when report file does not exist', () => {
  const outDir = tmpDir();
  const result = analyzeFailures('/no/such/file.json', 'spec.ts', outDir);
  expect(result).toBeNull();
  fs.rmSync(outDir, { recursive: true });
});

test('analyzer — returns null when report is invalid JSON', () => {
  const dir = tmpDir();
  const reportPath = path.join(dir, 'playwright-results.json');
  fs.writeFileSync(reportPath, 'not valid json {{{', 'utf-8');
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result).toBeNull();
  fs.rmSync(dir, { recursive: true });
});

test('analyzer — returns null when report has no failures', () => {
  const dir = tmpDir();
  const report = {
    suites: [{
      title: 'suite',
      file: 'test.spec.ts',
      specs: [{ title: 'passing test', ok: true, tests: [] }],
      suites: [],
    }],
  };
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result).toBeNull();
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

test('analyzer — classifies "cannot find module" as bad_generation', () => {
  const dir = tmpDir();
  const report = buildReport({ errorMessage: 'Cannot find module \'../src/actions\'' });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result).not.toBeNull();
  expect(result!.failures[0].category).toBe('bad_generation');
  fs.rmSync(dir, { recursive: true });
});

test('analyzer — classifies "SyntaxError: Unexpected token" as bad_generation', () => {
  const dir = tmpDir();
  const report = buildReport({ errorMessage: 'SyntaxError: Unexpected token \'{\'  at line 3' });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result!.failures[0].category).toBe('bad_generation');
  fs.rmSync(dir, { recursive: true });
});

test('analyzer — classifies "navigation timeout" as timing', () => {
  const dir = tmpDir();
  const report = buildReport({ errorMessage: 'Navigation timeout of 30000ms exceeded' });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result!.failures[0].category).toBe('timing');
  fs.rmSync(dir, { recursive: true });
});

test('analyzer — classifies net::ERR_CONNECTION as timing', () => {
  const dir = tmpDir();
  const report = buildReport({ errorMessage: 'net::ERR_CONNECTION_REFUSED at https://example.com' });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result!.failures[0].category).toBe('timing');
  fs.rmSync(dir, { recursive: true });
});

test('analyzer — classifies "404 page not found" as missing_data', () => {
  const dir = tmpDir();
  const report = buildReport({ errorMessage: '404 Not Found: Page not found at /admin' });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result!.failures[0].category).toBe('missing_data');
  fs.rmSync(dir, { recursive: true });
});

test('analyzer — classifies toContainText assertion failure as product_defect', () => {
  const dir = tmpDir();
  const report = buildReport({
    status: 'failed',
    errorMessage: 'expect(received).toContainText(expected)\nExpected: "Welcome"\nReceived: "Login"',
  });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result!.failures[0].category).toBe('product_defect');
  fs.rmSync(dir, { recursive: true });
});

test('analyzer — classifies toHaveURL assertion failure as product_defect', () => {
  const dir = tmpDir();
  const report = buildReport({
    status: 'failed',
    errorMessage: 'expect(locator).toHaveURL(expected)\nExpected: /secure\nReceived: /login',
  });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result!.failures[0].category).toBe('product_defect');
  fs.rmSync(dir, { recursive: true });
});

test('analyzer — classifies "waiting for locator" in errors[] as selector_drift', () => {
  // This simulates the real Playwright behaviour where errors[1] has the call-log detail
  const dir = tmpDir();
  const report = buildReport({
    status: 'failed',
    errorMessage: 'Test timeout of 30000ms exceeded.',
    errorsArray: [
      { message: 'Test timeout of 30000ms exceeded.', stack: '' },
      {
        message: 'page.click: Test timeout of 30000ms exceeded.\nwaiting for locator(\'#bad-selector\')',
        stack: '',
      },
    ],
  });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result!.failures[0].category).toBe('selector_drift');
  fs.rmSync(dir, { recursive: true });
});

test('analyzer — classifies timedOut status (no locator) as timing', () => {
  const dir = tmpDir();
  const report = buildReport({
    status: 'timedOut',
    errorMessage: 'Test timeout of 30000ms exceeded.',
  });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result!.failures[0].category).toBe('timing');
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// analyzeFailures — output file
// ---------------------------------------------------------------------------

test('analyzer — writes failure-analysis.json to output dir', () => {
  const dir = tmpDir();
  const report = buildReport({ errorMessage: 'Cannot find module' });
  const reportPath = writePWReport(dir, report);
  analyzeFailures(reportPath, 'spec.ts', dir);
  expect(fs.existsSync(path.join(dir, 'failure-analysis.json'))).toBe(true);
  fs.rmSync(dir, { recursive: true });
});

test('analyzer — written analysis is valid JSON with expected shape', () => {
  const dir = tmpDir();
  const report = buildReport({ errorMessage: 'Cannot find module' });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  expect(result).not.toBeNull();
  const written = JSON.parse(fs.readFileSync(path.join(dir, 'failure-analysis.json'), 'utf-8'));
  expect(written.totalFailed).toBe(1);
  expect(written.failures[0]).toMatchObject({ category: 'bad_generation' });
  fs.rmSync(dir, { recursive: true });
});

test('analyzer — analysis includes suggestion for every failure category', () => {
  const dir = tmpDir();
  const report = buildReport({ errorMessage: 'Cannot find module' });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir);
  for (const f of result!.failures) {
    expect(f.suggestion.length).toBeGreaterThan(0);
  }
  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// formatAnalysis
// ---------------------------------------------------------------------------

test('formatAnalysis — contains failure count', () => {
  const dir = tmpDir();
  const report = buildReport({ errorMessage: 'Cannot find module' });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir)!;
  const formatted = formatAnalysis(result);
  expect(formatted).toContain('1 failure');
  fs.rmSync(dir, { recursive: true });
});

test('formatAnalysis — contains category name', () => {
  const dir = tmpDir();
  const report = buildReport({ errorMessage: 'Cannot find module' });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir)!;
  const formatted = formatAnalysis(result);
  expect(formatted).toContain('bad_generation');
  fs.rmSync(dir, { recursive: true });
});

test('formatAnalysis — contains suggestion', () => {
  const dir = tmpDir();
  const report = buildReport({ errorMessage: 'Cannot find module' });
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir)!;
  const formatted = formatAnalysis(result);
  expect(formatted).toContain('Suggestion:');
  fs.rmSync(dir, { recursive: true });
});

test('formatAnalysis — pluralises failures correctly', () => {
  // Build a report with 2 failing specs
  const dir = tmpDir();
  const report = {
    suites: [{
      title: 'suite',
      file: 'test.spec.ts',
      specs: [
        {
          title: 'test 1',
          ok: false,
          tests: [{ results: [{ status: 'failed', error: { message: 'Cannot find module', stack: '' }, errors: [] }] }],
        },
        {
          title: 'test 2',
          ok: false,
          tests: [{ results: [{ status: 'failed', error: { message: 'Cannot find module', stack: '' }, errors: [] }] }],
        },
      ],
      suites: [],
    }],
  };
  const reportPath = writePWReport(dir, report);
  const result = analyzeFailures(reportPath, 'spec.ts', dir)!;
  const formatted = formatAnalysis(result);
  expect(formatted).toContain('2 failures');
  fs.rmSync(dir, { recursive: true });
});
