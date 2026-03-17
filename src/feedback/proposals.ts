/**
 * Feedback Proposals Aggregator
 *
 * Reads existing output files and produces a unified proposals.json
 * that surfaces the highest-signal improvement opportunities.
 *
 * Sources:
 *   - output/lint-log.ndjson      → unrecognised vocabulary steps
 *   - output/selector-health.json → selectors with high failure rates
 *   - output/failure-analysis.json → repeated failure patterns
 *
 * Output: output/feedback/proposals.json
 */
import * as fs from 'fs'
import * as path from 'path'

const OUTPUT_DIR = path.resolve(process.cwd(), 'output')
const FEEDBACK_DIR = path.resolve(OUTPUT_DIR, 'feedback')

export interface FeedbackProposal {
  type: 'vocabulary' | 'selector_health' | 'failure_pattern'
  priority: 'high' | 'medium' | 'low'
  evidence: string
  suggestion: string
}

export interface FeedbackReport {
  generatedAt: string
  totalProposals: number
  proposals: FeedbackProposal[]
}

function loadLintProposals(): FeedbackProposal[] {
  const lintLog = path.join(OUTPUT_DIR, 'lint-log.ndjson')
  if (!fs.existsSync(lintLog)) return []

  const freq = new Map<string, number>()
  const lines = fs.readFileSync(lintLog, 'utf-8').split('\n').filter(Boolean)
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as { step?: string; warning?: string }
      const step = entry.step ?? entry.warning ?? ''
      if (step) freq.set(step, (freq.get(step) ?? 0) + 1)
    } catch { /* skip malformed */ }
  }

  const proposals: FeedbackProposal[] = []
  for (const [step, count] of freq.entries()) {
    if (count >= 3) {
      proposals.push({
        type: 'vocabulary',
        priority: count >= 5 ? 'high' : 'medium',
        evidence: `Unrecognised step appeared ${count} time(s): "${step}"`,
        suggestion: count >= 5
          ? `Run \`npm run vocab:analyze\` — a proposal may already exist in vocabulary/proposals/`
          : `Consider adding to vocabulary/core.yaml once it appears 5+ times`,
      })
    }
  }
  return proposals
}

function loadSelectorHealthProposals(): FeedbackProposal[] {
  const healthPath = path.join(OUTPUT_DIR, 'selector-health.json')
  if (!fs.existsSync(healthPath)) return []

  const proposals: FeedbackProposal[] = []
  try {
    const health = JSON.parse(fs.readFileSync(healthPath, 'utf-8')) as Record<string, { runCount: number; failCount: number }>
    for (const [selector, rec] of Object.entries(health)) {
      if (rec.runCount < 3) continue
      const failRate = rec.failCount / rec.runCount
      if (failRate > 0.2) {
        proposals.push({
          type: 'selector_health',
          priority: failRate > 0.5 ? 'high' : 'medium',
          evidence: `Selector '${selector}' failed ${rec.failCount}/${rec.runCount} runs (${Math.round(failRate * 100)}% failure rate)`,
          suggestion: `Run \`npm run heal\` to get a replacement proposal, or update src/actions/index.ts manually`,
        })
      }
    }
  } catch { /* non-fatal */ }
  return proposals
}

function loadFailurePatternProposals(): FeedbackProposal[] {
  const analysisPath = path.join(OUTPUT_DIR, 'failure-analysis.json')
  if (!fs.existsSync(analysisPath)) return []

  const proposals: FeedbackProposal[] = []
  try {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8')) as {
      failures?: Array<{ category: string; suggestion: string; test: string }>
    }
    const byCategory = new Map<string, number>()
    for (const f of analysis.failures ?? []) {
      byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1)
    }
    for (const [category, count] of byCategory.entries()) {
      proposals.push({
        type: 'failure_pattern',
        priority: count >= 3 ? 'high' : count >= 2 ? 'medium' : 'low',
        evidence: `${count} test(s) failed with category '${category}'`,
        suggestion: analysis.failures?.find(f => f.category === category)?.suggestion ?? 'Check the failure analysis report',
      })
    }
  } catch { /* non-fatal */ }
  return proposals
}

export function generateFeedbackReport(): FeedbackReport {
  const proposals: FeedbackProposal[] = [
    ...loadLintProposals(),
    ...loadSelectorHealthProposals(),
    ...loadFailurePatternProposals(),
  ].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 }
    return rank[a.priority] - rank[b.priority]
  })

  return {
    generatedAt: new Date().toISOString(),
    totalProposals: proposals.length,
    proposals,
  }
}

// CLI entry point
if (require.main === module) {
  fs.mkdirSync(FEEDBACK_DIR, { recursive: true })
  const report = generateFeedbackReport()
  const outPath = path.join(FEEDBACK_DIR, 'proposals.json')
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`[Feedback] ${report.totalProposals} proposal(s) written to output/feedback/proposals.json`)
  if (report.proposals.length === 0) {
    console.log('[Feedback] No actionable feedback at this time — system is healthy.')
  }
}
