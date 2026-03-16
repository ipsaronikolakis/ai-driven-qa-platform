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

  return {
    passed: exitCode === 0,
    total: counts.total,
    passedCount: counts.passed,
    failedCount: counts.failed,
    durationMs,
    specFilePath: specPaths.join(', '),
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
