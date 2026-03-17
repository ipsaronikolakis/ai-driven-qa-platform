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
import { SelectorHealthMap, SelectorRecord, SelectorStatus, selectorStatus } from './selector-health';

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

  // Write HTML report
  writeHtmlReport(entries, path.resolve(process.cwd(), 'output', 'selector-health.html'));
  console.log('  Report written: output/selector-health.html');

  if (unstableCount > 0) {
    console.log(`⚠  ${unstableCount} unstable selector(s) — consider re-running exploration or updating the Action Library.`);
    process.exit(1);
  }
  process.exit(0);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function writeHtmlReport(
  entries: Array<{ selector: string; record: SelectorRecord; status: SelectorStatus; failureRate: number }>,
  outputPath: string,
): void {
  const rows = entries.map(({ selector, record, status, failureRate }) => {
    const total = record.passes + record.failures;
    const ratePct = total > 0 ? `${Math.round(failureRate * 100)}%` : '—';
    const rowClass = status === 'unstable' ? ' class="unstable"' : status === 'new' ? ' class="new"' : '';
    const badge =
      status === 'unstable' ? '<span class="badge unstable">unstable</span>'
      : status === 'new'    ? '<span class="badge new">new</span>'
      :                       '<span class="badge stable">stable</span>';
    return `<tr${rowClass}><td><code>${esc(selector)}</code></td><td>${record.passes}</td><td>${record.failures}</td><td>${ratePct}</td><td>${badge}</td></tr>`;
  }).join('\n');

  const generatedAt = new Date().toISOString();
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Selector Health Report</title>
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#1e1e2e; color:#cdd6f4; padding:24px; }
  h1 { color:#60a5fa; font-size:1.1rem; margin-bottom:4px; }
  .meta { color:#6c7086; font-size:.8rem; margin-bottom:16px; }
  table { border-collapse:collapse; width:100%; font-size:.82rem; }
  th { text-align:left; padding:6px 10px; border-bottom:2px solid #313244; color:#6c7086; font-weight:500; }
  td { padding:5px 10px; border-bottom:1px solid #313244; }
  tr.unstable td { background:#3b0000; }
  tr.new td { background:#0d2137; }
  code { font-family:'Cascadia Code','Fira Code',monospace; font-size:.8rem; }
  .badge { display:inline-block; padding:1px 8px; border-radius:8px; font-size:.7rem; font-weight:600; }
  .badge.stable   { background:#14532d; color:#86efac; }
  .badge.unstable { background:#7f1d1d; color:#fca5a5; }
  .badge.new      { background:#1e3a5f; color:#7dd3fc; }
  .summary { margin-top:12px; font-size:.82rem; color:#6c7086; }
</style>
</head>
<body>
<h1>Selector Health Report</h1>
<div class="meta">Generated: ${generatedAt} &nbsp;|&nbsp; ${entries.length} selector(s) tracked</div>
<table>
<thead><tr><th>Selector</th><th>Passes</th><th>Failures</th><th>Fail Rate</th><th>Status</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<div class="summary">
  Unstable = fail rate &gt; 20% across ≥3 runs &nbsp;|&nbsp; New = fewer than 3 runs
</div>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf-8');
}

main();
