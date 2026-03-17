/**
 * Self-healing engine entry point.
 *
 * Usage:
 *   npm run heal
 *
 * Reads output/playwright-results.json to identify failing tests, re-runs
 * the App Explorer to get a fresh page model, diffs old vs new selectors,
 * and writes heal proposals to output/heal-proposals/.
 *
 * NEVER modifies generated/ directly — all output is in output/heal-proposals/.
 */
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

import { exploreWithScript, mergePageModels } from '../app-explorer/explorer'
import { EXPLORATION_SCRIPT } from '../config/exploration-script'
import { PageModel, PageElement } from '../types'

const OUTPUT_DIR = path.resolve(process.cwd(), 'output')
const PW_JSON_REPORT = path.resolve(OUTPUT_DIR, 'playwright-results.json')
const OLD_MODEL_PATH = path.resolve(OUTPUT_DIR, 'stage2-page-model.json')
const PROPOSALS_DIR = path.resolve(OUTPUT_DIR, 'heal-proposals')
const HEALTH_PATH = path.resolve(OUTPUT_DIR, 'selector-health.json')

// A selector is "stable" if it has ≥20 runs with ≤2% failure rate.
// Stable selectors are never auto-replaced — a human must investigate.
const STABLE_MIN_RUNS = 20
const STABLE_MAX_FAIL_RATE = 0.02

interface SelectorHealth { runCount: number; failCount: number }

function loadSelectorHealth(): Map<string, SelectorHealth> {
	const map = new Map<string, SelectorHealth>()
	if (!fs.existsSync(HEALTH_PATH)) return map
	try {
		const raw = JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf-8')) as Record<string, SelectorHealth>
		for (const [sel, rec] of Object.entries(raw)) map.set(sel, rec)
	} catch { /* non-fatal */ }
	return map
}

function isStable(selector: string, health: Map<string, SelectorHealth>): boolean {
	const rec = health.get(selector)
	if (!rec || rec.runCount < STABLE_MIN_RUNS) return false
	return rec.failCount / rec.runCount <= STABLE_MAX_FAIL_RATE
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealProposal {
	specFile: string
	oldSelector: string
	newSelector: string
	oldElement: PageElement
	newElement: PageElement
	confidence: number
	/** Paste this comment above the affected line in src/actions/index.ts */
	healedComment: string
}

export interface HealReport {
	generatedAt: string
	specFile: string
	proposals: HealProposal[]
	unresolvable: string[]
}

// ---------------------------------------------------------------------------
// Playwright report parsing
// ---------------------------------------------------------------------------

interface PWSpec {
	title: string
	ok: boolean
}
interface PWSuite {
	title: string
	file?: string
	specs: PWSpec[]
	suites?: PWSuite[]
}
interface PWReport {
	suites?: PWSuite[]
}

function collectFailingFiles(suite: PWSuite, out: Set<string>): void {
	for (const spec of suite.specs ?? []) {
		if (!spec.ok) out.add(suite.file ?? suite.title)
	}
	for (const child of suite.suites ?? []) collectFailingFiles(child, out)
}

// ---------------------------------------------------------------------------
// Selector extraction from generated spec files
// ---------------------------------------------------------------------------

const SELECTOR_PATTERNS = [
	/fillInput\(page,\s*'([^']+)'/g,
	/clickElement\(page,\s*'([^']+)'/g,
	/assertVisible\(page,\s*'([^']+)'/g,
]

function extractSelectors(content: string): string[] {
	const selectors = new Set<string>()
	for (const re of SELECTOR_PATTERNS) {
		re.lastIndex = 0
		let m: RegExpExecArray | null
		while ((m = re.exec(content)) !== null) selectors.add(m[1])
	}
	return [...selectors]
}

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

function jaccardWords(a: string, b: string): number {
	const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean))
	const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean))
	let inter = 0
	setA.forEach((w) => {
		if (setB.has(w)) inter++
	})
	const union = setA.size + setB.size - inter
	return union === 0 ? 0 : inter / union
}

function findClosestElement(
	oldEl: PageElement,
	newElements: PageElement[],
): { element: PageElement; confidence: number } | null {
	let best: { element: PageElement; confidence: number } | null = null

	for (const el of newElements) {
		const textScore = jaccardWords(oldEl.text, el.text)
		const typeBonus = oldEl.type === el.type ? 0.2 : 0
		const confidence = Math.min(1, textScore + typeBonus)

		if (!best || confidence > best.confidence) {
			best = { element: el, confidence }
		}
	}

	return best && best.confidence >= 0.4 ? best : null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	console.log('='.repeat(60))
	console.log('AI-Driven QA Platform — Self-Healing Engine')
	console.log('='.repeat(60))

	// Load Playwright results
	if (!fs.existsSync(PW_JSON_REPORT)) {
		console.log('\nNo playwright-results.json found. Run the pipeline first.')
		process.exit(0)
	}

	let report: PWReport
	try {
		report = JSON.parse(fs.readFileSync(PW_JSON_REPORT, 'utf-8')) as PWReport
	} catch {
		console.error('Could not parse playwright-results.json')
		process.exit(1)
	}

	const failingFiles = new Set<string>()
	for (const suite of report.suites ?? [])
		collectFailingFiles(suite, failingFiles)

	if (failingFiles.size === 0) {
		console.log('\nNo failing tests found — nothing to heal.')
		process.exit(0)
	}

	console.log(`\nFound ${failingFiles.size} failing spec file(s):`)
	for (const f of failingFiles) console.log(`  • ${f}`)

	// Load old page model
	let oldModel: PageModel | null = null
	if (fs.existsSync(OLD_MODEL_PATH)) {
		try {
			const checkpoint = JSON.parse(
				fs.readFileSync(OLD_MODEL_PATH, 'utf-8'),
			) as { data: PageModel }
			oldModel = checkpoint.data
			console.log(
				`\nLoaded old page model: ${oldModel.elements.length} element(s) from ${OLD_MODEL_PATH}`,
			)
		} catch {
			console.warn('Could not parse old page model — will use new model only.')
		}
	}

	// Re-run App Explorer
	console.log('\nRe-running App Explorer to get fresh page model...')
	let newModel: PageModel
	try {
		const models = await exploreWithScript(EXPLORATION_SCRIPT)
		newModel = mergePageModels(models)
		console.log(`Fresh page model: ${newModel.elements.length} element(s)`)
	} catch (err) {
		console.error('App Explorer failed:', (err as Error).message)
		console.error('Cannot generate heal proposals without a fresh page model.')
		process.exit(1)
	}

	// Build selector → old element map
	const oldElements = new Map<string, PageElement>()
	for (const el of oldModel?.elements ?? []) oldElements.set(el.selector, el)

	// Build new element lookup (by selector)
	const newElementsBySelector = new Map<string, PageElement>()
	for (const el of newModel.elements) newElementsBySelector.set(el.selector, el)

	const selectorHealth = loadSelectorHealth()

	if (!fs.existsSync(PROPOSALS_DIR))
		fs.mkdirSync(PROPOSALS_DIR, { recursive: true })

	let totalProposals = 0
	let totalUnresolvable = 0

	for (const specFile of failingFiles) {
		if (!fs.existsSync(specFile)) {
			console.warn(`\n  Spec file not found: ${specFile} — skipping`)
			continue
		}

		const content = fs.readFileSync(specFile, 'utf-8')
		const selectors = extractSelectors(content)
		const proposals: HealProposal[] = []
		const unresolvable: string[] = []

		console.log(
			`\nAnalyzing: ${path.relative(process.cwd(), specFile)} (${selectors.length} selector(s))`,
		)

		for (const selector of selectors) {
			// If selector still exists in new model, no healing needed
			if (newElementsBySelector.has(selector)) {
				console.log(`  ✓ ${selector} — still valid`)
				continue
			}

			// Stable selectors have a strong track record — skip auto-replace,
			// flag for human investigation instead.
			if (isStable(selector, selectorHealth)) {
				console.log(`  ⚠ ${selector} — STABLE selector failing (≥${STABLE_MIN_RUNS} runs, ≤${STABLE_MAX_FAIL_RATE * 100}% fail rate). Skipping auto-replace — investigate manually.`)
				unresolvable.push(`${selector} [stable — manual review required]`)
				continue
			}

			// Try to find a replacement
			const oldEl = oldElements.get(selector)
			if (!oldEl) {
				console.log(
					`  ? ${selector} — not in old model, cannot determine replacement`,
				)
				unresolvable.push(selector)
				continue
			}

			const match = findClosestElement(oldEl, newModel.elements)
			if (match) {
				proposals.push({
					specFile,
					oldSelector: selector,
					newSelector: match.element.selector,
					oldElement: oldEl,
					newElement: match.element,
					confidence: match.confidence,
					healedComment: `// HEALED: ${new Date().toISOString().slice(0, 10)} — original selector: '${selector}' — new selector: '${match.element.selector}'`,
				})
				console.log(
					`  [REPLACE] '${selector}' → '${match.element.selector}' (confidence: ${match.confidence.toFixed(2)})`,
				)
			} else {
				unresolvable.push(selector)
				console.log(
					`  [NO MATCH] '${selector}' — no close element found in new model`,
				)
			}
		}

		totalProposals += proposals.length
		totalUnresolvable += unresolvable.length

		// Write patch file
		const slug = path.basename(specFile, '.spec.ts')
		const patchPath = path.join(PROPOSALS_DIR, `${slug}.patch.json`)
		const healReport: HealReport = {
			generatedAt: new Date().toISOString(),
			specFile,
			proposals,
			unresolvable,
		}
		fs.writeFileSync(patchPath, JSON.stringify(healReport, null, 2), 'utf-8')
		console.log(`  Wrote: output/heal-proposals/${slug}.patch.json`)
	}

	console.log('\n' + '='.repeat(60))
	console.log('HEAL SUMMARY')
	console.log('='.repeat(60))
	console.log(`  Proposals:   ${totalProposals} selector(s) can be replaced`)
	console.log(`  Unresolvable: ${totalUnresolvable} selector(s) with no match`)
	console.log(`  Proposals in: output/heal-proposals/`)
	console.log('')
	console.log(
		'  Review each .patch.json and apply changes to src/actions/index.ts',
	)
	console.log(
		'  (fix the Action Library helper — do not edit generated/ directly).',
	)
	console.log('='.repeat(60))
}

main().catch((err: Error) => {
	console.error('\n[Healer Error]', err.message)
	process.exit(1)
})
