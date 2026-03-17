import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GeneratedCode, RunResult } from '../types';

const PW_JSON_REPORT = path.resolve(__dirname, '..', '..', 'output', 'playwright-results.json');

/**
 * Executes one or more generated Playwright specs in a single Playwright run.
 * Reads actual pass/fail counts from the JSON reporter output.
 */
export function runSpecs(generatedList: GeneratedCode[]): RunResult {
  const startTime = Date.now();
  const projectRoot = path.resolve(__dirname, '..', '..');
  const configPath = path.resolve(projectRoot, 'playwright.config.ts');

  const specPaths = generatedList.map(g => g.specFilePath);
  const args = ['playwright', 'test', '--config', configPath, ...specPaths];

  console.log(`[Runner] Executing: npx playwright test ${specPaths.map(p => path.relative(projectRoot, p)).join(' ')}`);

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execFileSync('npx', args, {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: { ...process.env },
      timeout: 120000,
    });
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; status?: number };
    stdout = execErr.stdout || '';
    stderr = execErr.stderr || '';
    exitCode = typeof execErr.status === 'number' ? execErr.status : 1;
  }

  const durationMs = Date.now() - startTime;
  const combinedOutput = [stdout, stderr].filter(Boolean).join('\n');
  console.log('[Runner] Output:\n', combinedOutput);

  // Read actual counts from the JSON reporter — more accurate than exit code alone
  const counts = readCountsFromReport(PW_JSON_REPORT, specPaths);

  // Distinguish crash from test failure:
  // A crash is when Playwright exits non-zero but ran zero tests
  // (compilation error, missing module, config error, etc.)
  const crashedBeforeTests = exitCode !== 0 && counts.total === 0;
  if (crashedBeforeTests) {
    const errorHint = detectCrashReason(stderr, stdout);
    console.error(`[Runner] Playwright crashed before executing any tests. ${errorHint}`);
    console.error('[Runner] This is a configuration/compilation error, not a test failure.');
  }

  return {
    passed: exitCode === 0,
    total: counts.total,
    passedCount: counts.passed,
    failedCount: counts.failed,
    durationMs,
    specFilePath: specPaths.join(', '),
    crashedBeforeTests,
  };
}

/**
 * Backward-compatible single-spec wrapper.
 */
export function runSpec(generated: GeneratedCode): RunResult {
  return runSpecs([generated]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Counts { total: number; passed: number; failed: number }

const CRASH_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /SyntaxError/,            label: 'Syntax error in generated spec' },
  { re: /Cannot find module/,     label: 'Missing module — check imports' },
  { re: /TypeScript diagnostics/, label: 'TypeScript compilation error' },
  { re: /ENOENT/,                 label: 'File not found' },
  { re: /No tests found/,         label: 'No tests matched the spec paths' },
  { re: /playwright\.config/,     label: 'Playwright config error' },
]

function detectCrashReason(stderr: string, stdout: string): string {
  const combined = stderr + '\n' + stdout;
  for (const { re, label } of CRASH_PATTERNS) {
    if (re.test(combined)) return `Likely cause: ${label}.`;
  }
  return 'Check the output above for details.';
}

function readCountsFromReport(reportPath: string, specPaths: string[]): Counts {
  if (!fs.existsSync(reportPath)) {
    return { total: specPaths.length, passed: 0, failed: specPaths.length };
  }

  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as {
      suites?: unknown[];
      stats?: { expected?: number; unexpected?: number; skipped?: number };
    };

    // Playwright JSON report top-level stats (most reliable)
    if (report.stats) {
      const passed = report.stats.expected ?? 0;
      const failed = report.stats.unexpected ?? 0;
      const skipped = report.stats.skipped ?? 0;
      return { total: passed + failed + skipped, passed, failed };
    }
  } catch {
    // Fall through to default
  }

  return { total: specPaths.length, passed: 0, failed: specPaths.length };
}
