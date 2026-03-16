/**
 * CLI entry point for vocabulary governance analysis.
 *
 * Usage:
 *   npm run vocab:analyze
 *
 * Reads output/lint-log.ndjson (written by the pipeline during Stage 1) and
 * groups unrecognised steps by frequency. Steps that appear 5+ times without
 * a vocabulary match are strong candidates for promotion to core.yaml.
 *
 * Auto-creates a proposal file in vocabulary/proposals/ for any step that
 * meets the threshold and does not already have a proposal.
 */
import * as fs from 'fs';
import * as path from 'path';

const LINT_LOG_PATH     = path.resolve(process.cwd(), 'output', 'lint-log.ndjson');
const PROPOSALS_DIR     = path.resolve(process.cwd(), 'vocabulary', 'proposals');
const TEMPLATE_PATH     = path.join(PROPOSALS_DIR, 'TEMPLATE.md');
const PROPOSAL_THRESHOLD = 5;

interface LintLogEntry {
  runAt: string;
  scenario: string;
  keyword: string;
  text: string;
  closest: string;
  score: number;
}

interface StepGroup {
  normalisedText: string;
  /** The most frequently occurring original form */
  canonicalOriginal: string;
  count: number;
  scenarios: Set<string>;
  closestMatch: string;
  closestScore: number;
  originalForms: Map<string, number>;
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/["'][^"']*["']/g, '<value>').replace(/\s+/g, ' ').trim();
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function main(): void {
  if (!fs.existsSync(LINT_LOG_PATH)) {
    console.log('No lint log found. Run the pipeline at least once with scenarios that have unrecognised steps.');
    console.log(`Expected: ${LINT_LOG_PATH}`);
    process.exit(0);
  }

  const raw = fs.readFileSync(LINT_LOG_PATH, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);

  const entries: LintLogEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as LintLogEntry);
    } catch { /* skip malformed lines */ }
  }

  if (entries.length === 0) {
    console.log('Lint log is empty — no unrecognised steps recorded yet.');
    process.exit(0);
  }

  // Group by normalised text
  const groups = new Map<string, StepGroup>();
  for (const entry of entries) {
    const key = normalise(entry.text);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        normalisedText: key,
        canonicalOriginal: entry.text,
        count: 1,
        scenarios: new Set([entry.scenario]),
        closestMatch: entry.closest,
        closestScore: entry.score,
        originalForms: new Map([[entry.text, 1]]),
      });
    } else {
      existing.count++;
      existing.scenarios.add(entry.scenario);
      // Track most recent closest match
      existing.closestMatch = entry.closest;
      existing.closestScore = entry.score;
      // Track original form frequencies
      existing.originalForms.set(entry.text, (existing.originalForms.get(entry.text) ?? 0) + 1);
      // Update canonical original to the most frequent form
      let maxCount = 0;
      for (const [form, cnt] of existing.originalForms) {
        if (cnt > maxCount) { maxCount = cnt; existing.canonicalOriginal = form; }
      }
    }
  }

  const sorted = [...groups.values()].sort((a, b) => b.count - a.count);
  const aboveThreshold = sorted.filter(g => g.count >= PROPOSAL_THRESHOLD);

  // Print report
  const colW = 45;
  const header = `${'UNRECOGNISED STEP'.padEnd(colW)} | COUNT | CLOSEST MATCH                    | SCORE`;
  const divider = '-'.repeat(header.length);

  console.log('\nVocabulary Analysis Report');
  console.log(`Analysed ${entries.length} log entries across ${groups.size} unique step pattern(s)\n`);
  console.log(divider);
  console.log(header);
  console.log(divider);

  let proposalsCreated = 0;
  for (const g of sorted) {
    const proposalFlag = g.count >= PROPOSAL_THRESHOLD ? ' [PROPOSAL]' : '';
    const text = g.canonicalOriginal.length > colW
      ? g.canonicalOriginal.slice(0, colW - 1) + '…'
      : g.canonicalOriginal;
    console.log([
      text.padEnd(colW),
      String(g.count).padStart(5),
      g.closestMatch.padEnd(33),
      g.closestScore.toFixed(2),
      proposalFlag,
    ].join(' | '));

    // Auto-create proposal file
    if (g.count >= PROPOSAL_THRESHOLD) {
      const slug = slugify(g.canonicalOriginal);
      const proposalPath = path.join(PROPOSALS_DIR, `${slug}.md`);
      if (!fs.existsSync(proposalPath) && fs.existsSync(TEMPLATE_PATH)) {
        const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
        const content = template.replace(/\{step-name\}/g, g.canonicalOriginal);
        fs.writeFileSync(proposalPath, content, 'utf-8');
        console.log(`  → Created: vocabulary/proposals/${slug}.md`);
        proposalsCreated++;
      }
    }
  }

  console.log(divider);
  console.log(`\nThreshold for promotion: ${PROPOSAL_THRESHOLD}+ occurrences`);
  if (aboveThreshold.length > 0) {
    console.log(`${aboveThreshold.length} step(s) meet the threshold for vocabulary promotion.`);
  }
  if (proposalsCreated > 0) {
    console.log(`${proposalsCreated} new proposal file(s) created in vocabulary/proposals/.`);
    console.log('Review and complete each proposal, then open a PR to add to vocabulary/core.yaml.');
  }
  process.exit(0);
}

main();
