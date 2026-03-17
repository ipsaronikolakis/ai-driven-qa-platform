/**
 * CLI: npm run review-proposals
 *
 * Reads output/feedback/proposals.json and prints proposals
 * grouped by type with priority indicators.
 */
import * as fs from 'fs'
import * as path from 'path'
import { FeedbackReport } from './proposals'

const PROPOSALS_PATH = path.resolve(process.cwd(), 'output', 'feedback', 'proposals.json')

const PRIORITY_ICON: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
}

const TYPE_LABEL: Record<string, string> = {
  vocabulary: 'Vocabulary',
  selector_health: 'Selector Health',
  failure_pattern: 'Failure Pattern',
}

function main() {
  if (!fs.existsSync(PROPOSALS_PATH)) {
    console.log('No proposals file found. Run `npm run feedback:update` first.')
    process.exit(0)
  }

  const report = JSON.parse(fs.readFileSync(PROPOSALS_PATH, 'utf-8')) as FeedbackReport

  console.log(`\n${'='.repeat(60)}`)
  console.log('FEEDBACK PROPOSALS')
  console.log(`Generated: ${report.generatedAt}`)
  console.log(`Total:     ${report.totalProposals} proposal(s)`)
  console.log('='.repeat(60))

  if (report.proposals.length === 0) {
    console.log('\n  ✅ No actionable feedback — system is healthy.\n')
    return
  }

  const byType = new Map<string, typeof report.proposals>()
  for (const p of report.proposals) {
    const list = byType.get(p.type) ?? []
    list.push(p)
    byType.set(p.type, list)
  }

  for (const [type, proposals] of byType.entries()) {
    console.log(`\n── ${TYPE_LABEL[type] ?? type} (${proposals.length}) ────────────────────`)
    for (const p of proposals) {
      const icon = PRIORITY_ICON[p.priority] ?? '⬜'
      console.log(`\n  ${icon} [${p.priority.toUpperCase()}]`)
      console.log(`  Evidence:   ${p.evidence}`)
      console.log(`  Suggestion: ${p.suggestion}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  const highCount = report.proposals.filter(p => p.priority === 'high').length
  if (highCount > 0) {
    console.log(`  ⚠  ${highCount} high-priority item(s) require attention.\n`)
    process.exit(1)
  }
  console.log()
}

main()
