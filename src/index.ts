import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import { parseAllScenarios } from './bdd-parser/parser'
import { exploreWithScript, mergePageModels } from './app-explorer/explorer'
import { generateTestPlan } from './planner/planner'
import { generateSpecFile } from './code-generator/generator'
import { runSpecs } from './runner/runner'
import { saveCheckpoint, loadCheckpoint } from './utils/checkpoint'
import { VocabularyRegistry } from './vocabulary/registry'
import { lintScenario } from './vocabulary/linter'
import { analyzeFailures, formatAnalysis } from './analyzer/failure-analyzer'
import { PageModel, TestPlan, ExplorationStep, GeneratedCode } from './types'

const VOCAB_FILE     = path.resolve(__dirname, '..', 'vocabulary', 'core.yaml')
const SCENARIOS_DIR  = path.resolve(__dirname, '..', 'scenarios')
const GENERATED_DIR  = path.resolve(__dirname, '..', 'generated')
const OUTPUT_DIR     = path.resolve(__dirname, '..', 'output')
const PW_JSON_REPORT = path.resolve(OUTPUT_DIR, 'playwright-results.json')

/**
 * Exploration script for the login-then-secure flow.
 * Shared across all scenarios that target these pages.
 */
const EXPLORATION_SCRIPT: ExplorationStep[] = [
	{ action: 'navigate', value: 'https://the-internet.herokuapp.com/login' },
	{ action: 'capture',  value: 'https://the-internet.herokuapp.com/login' },
	{ action: 'fill',     selector: '#username', value: 'tomsmith' },
	{ action: 'fill',     selector: '#password', value: 'SuperSecretPassword!' },
	{ action: 'click',    selector: 'button.radius' },
	{ action: 'capture',  value: 'https://the-internet.herokuapp.com/secure' },
]

async function main(): Promise<void> {
	const isFresh = process.argv.includes('--fresh')
	console.log('='.repeat(60))
	console.log('AI-Driven QA Platform — Pipeline')
	if (isFresh) console.log('(--fresh: all caches bypassed)')
	console.log('='.repeat(60))

	const apiKey = process.env.GEMINI_API_KEY
	if (!apiKey) {
		console.warn('[Pipeline] GEMINI_API_KEY not set — LLM fallback disabled. All scenarios must be vocabulary-resolvable.')
	}

	const registry = VocabularyRegistry.load(VOCAB_FILE)

	// ── Stage 1: Parse all .feature files ──────────────────────────────────
	console.log('\n[Stage 1] Parsing BDD feature files...')

	const featureFiles = fs.readdirSync(SCENARIOS_DIR)
		.filter(f => f.endsWith('.feature'))
		.map(f => path.join(SCENARIOS_DIR, f))

	if (featureFiles.length === 0) throw new Error(`No .feature files found in ${SCENARIOS_DIR}`)

	const allScenarios: Array<{ scenario: ReturnType<typeof parseAllScenarios>[0]; featureFile: string }> = []

	for (const featureFile of featureFiles) {
		const scenarios = parseAllScenarios(featureFile)
		for (const scenario of scenarios) {
			const lintResult = lintScenario(scenario, registry)
			const vocabStatus = lintResult.warnings.length === 0
				? `all steps canonical ✓`
				: `${lintResult.warnings.length} unrecognised step(s)`

			console.log(`  [${path.basename(featureFile)}] "${scenario.scenario}" — vocab: ${vocabStatus}`)
			lintResult.warnings.forEach(w => {
				console.warn(`    ${w.message}`)
				if (w.suggestion) console.warn(`    → ${w.suggestion}`)
			})
			allScenarios.push({ scenario, featureFile })
		}
	}

	console.log(`  Total: ${allScenarios.length} scenario(s) across ${featureFiles.length} file(s)`)

	// ── Stage 2: App Explorer — one shared page model (cached) ─────────────
	console.log('\n[Stage 2] Exploring pages with Playwright...')
	const scriptHash = JSON.stringify(EXPLORATION_SCRIPT)
	const cachedPageModel = loadCheckpoint<PageModel>('stage2-page-model.json', scriptHash)
	const pageModel = cachedPageModel ?? await (async () => {
		const models = await exploreWithScript(EXPLORATION_SCRIPT)
		const merged = mergePageModels(models)
		saveCheckpoint<PageModel>('stage2-page-model.json', merged, scriptHash)
		return merged
	})()
	console.log(`  Title: ${pageModel.title} — ${pageModel.elements.length} elements`)
	pageModel.elements.forEach(e => console.log(`    [${e.type}] "${e.text}" -> ${e.selector}`))

	// ── Stages 3 & 4: Plan + generate each scenario ─────────────────────────
	const generatedSpecs: GeneratedCode[] = []

	for (const { scenario, featureFile } of allScenarios) {
		console.log(`\n[Stage 3] Planning: "${scenario.scenario}"...`)
		const featureContent = fs.readFileSync(featureFile, 'utf-8')
		const cacheKey = `stage3-${slugify(scenario.scenario)}.json`
		const cachedPlan = loadCheckpoint<TestPlan>(cacheKey, featureContent, JSON.stringify(pageModel))
		const testPlan = cachedPlan ?? await (async () => {
			const result = await generateTestPlan(scenario, pageModel, apiKey, registry)
			saveCheckpoint<TestPlan>(cacheKey, result, featureContent, JSON.stringify(pageModel))
			return result
		})()
		console.log(`  Actions (${testPlan.actions.length}): ${testPlan.actions.map(a => a.action).join(', ')}`)

		console.log(`[Stage 4] Generating spec: "${scenario.scenario}"...`)
		const generated = generateSpecFile(testPlan, GENERATED_DIR, registry.version)
		console.log(`  → ${path.relative(process.cwd(), generated.specFilePath)}`)
		generatedSpecs.push(generated)
	}

	// ── Stage 5: Run all specs in one Playwright invocation ─────────────────
	console.log(`\n[Stage 5] Running ${generatedSpecs.length} spec(s) with Playwright...`)
	const result = runSpecs(generatedSpecs)

	// Failure analysis
	if (!result.passed) {
		const analysis = analyzeFailures(PW_JSON_REPORT, result.specFilePath, OUTPUT_DIR)
		if (analysis) {
			console.log('\n' + formatAnalysis(analysis))
			console.log(`  Analysis saved: ${path.join(OUTPUT_DIR, 'failure-analysis.json')}`)
		}
	}

	// ── Final Report ────────────────────────────────────────────────────────
	console.log('\n' + '='.repeat(60))
	console.log('PIPELINE RESULT')
	console.log('='.repeat(60))
	console.log(`  Status:   ${result.passed ? 'PASSED' : 'FAILED'}`)
	console.log(`  Scenarios: ${allScenarios.length}`)
	console.log(`  Passed:   ${result.passedCount} / ${result.total}`)
	console.log(`  Failed:   ${result.failedCount}`)
	console.log(`  Duration: ${(result.durationMs / 1000).toFixed(2)}s`)
	console.log(`  Report:   ${path.resolve(__dirname, '..', 'playwright-report', 'index.html')}`)
	console.log('='.repeat(60))

	if (!result.passed) process.exit(1)
}

function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

main().catch((err: Error) => {
	console.error('\n[Pipeline Error]', err.message)
	process.exit(1)
})
