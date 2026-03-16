/**
 * CLI entry point for the Selector Health Report.
 *
 * Usage:
 *   npm run selector-report
 *
 * Reads output/selector-health.json and prints a stability table sorted by
 * failure rate (worst offenders first).
 */
import * as fs from 'fs';
import * as path from 'path';
import { SelectorHealthMap, SelectorRecord, selectorStatus } from './selector-health';

const HEALTH_PATH = path.resolve(process.cwd(), 'output', 'selector-health.json');

function pct(record: SelectorRecord): string {
  const total = record.passes + record.failures;
  if (total === 0) return '  —';
  return `${Math.round((record.failures / total) * 100)}%`.padStart(4);
}

function main(): void {
  if (!fs.existsSync(HEALTH_PATH)) {
    console.log('No selector health data found. Run the pipeline at least once to generate it.');
    console.log(`Expected: ${HEALTH_PATH}`);
    process.exit(0);
  }

  let health: SelectorHealthMap;
  try {
    health = JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf-8')) as SelectorHealthMap;
  } catch {
    console.error('Could not parse selector-health.json.');
    process.exit(1);
  }

  const entries = Object.entries(health)
    .map(([selector, record]) => ({
      selector,
      record,
      status: selectorStatus(record),
      failureRate: (record.passes + record.failures) > 0
        ? record.failures / (record.passes + record.failures)
        : 0,
    }))
    .sort((a, b) => b.failureRate - a.failureRate);

  if (entries.length === 0) {
    console.log('No selectors tracked yet.');
    process.exit(0);
  }

  const colW = 50;
  const header = `${'SELECTOR'.padEnd(colW)} | PASSES | FAILS | FAIL% | STATUS`;
  const divider = '-'.repeat(header.length);

  console.log('\nSelector Health Report');
  console.log(divider);
  console.log(header);
  console.log(divider);

  for (const { selector, record, status } of entries) {
    const statusIcon = status === 'stable' ? '✓ stable' : status === 'unstable' ? '✗ unstable' : '· new';
    const row = [
      selector.padEnd(colW),
      String(record.passes).padStart(6),
      String(record.failures).padStart(5),
      pct(record).padStart(5),
      statusIcon,
    ].join(' | ');
    console.log(row);
  }

  console.log(divider);
  const unstableCount = entries.filter(e => e.status === 'unstable').length;
  console.log(`\nTotal: ${entries.length} selector(s) tracked`);
  if (unstableCount > 0) {
    console.log(`⚠  ${unstableCount} unstable selector(s) — consider re-running exploration or updating the Action Library.`);
    process.exit(1);
  }
  process.exit(0);
}

main();
