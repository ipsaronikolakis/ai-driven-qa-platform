import { GoogleGenerativeAI } from '@google/generative-ai'
import { ParsedScenario, PageModel, TestPlan } from '../types'
import { validatePlan } from './validator'
import { TEST_PLAN_SCHEMA } from './schema'
import { withRetry } from '../utils/retry'
import { VocabularyRegistry } from '../vocabulary/registry'
import { canResolveAll, resolveAll } from './deterministic-resolver'

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

function buildPrompt(scenario: ParsedScenario, pageModel: PageModel): string {
	const stepsText = scenario.steps
		.map((s) => `  ${s.keyword} ${s.text}`)
		.join('\n')

	const elementsText = JSON.stringify(pageModel.elements, null, 2)

	return `You are a QA automation engineer. Convert the BDD scenario and page model below into a structured test plan.

## BDD Scenario

Feature: ${scenario.feature}
Scenario: ${scenario.scenario}

${stepsText}

## Page Model

Elements extracted from ${pageModel.url}:

${elementsText}

## Rules

1. Start with a "navigate" action. Set "value" to: ${pageModel.url}
2. Map each BDD step to one or more actions.
3. For "fill" and "click" actions, use the EXACT selector from the page model.
4. For "assert_text", set "value" to the exact string to find on the page.
5. Quoted strings in BDD steps (e.g. "tomsmith") are literal values — use as-is.`
}

/**
 * Generates a TestPlan from a BDD scenario and page model.
 *
 * Two-pass planning:
 *   1. Deterministic — if every step matches a vocabulary entry that has a
 *      registered resolver, build the plan locally with no API call.
 *   2. LLM fallback — if any step cannot be resolved, send the full scenario
 *      to Gemini and tag the result as source: 'llm'.
 *
 * The `source` field on each action records which path produced it.
 */
export async function generateTestPlan(
	scenario: ParsedScenario,
	pageModel: PageModel,
	apiKey: string | undefined,
	registry?: VocabularyRegistry,
): Promise<TestPlan> {
	// ── Pass 1: deterministic ────────────────────────────────────────────────
	if (registry && canResolveAll(scenario.steps, registry)) {
		console.log('[Planner] All steps resolved deterministically — Gemini skipped.')
		const actions = resolveAll(scenario.steps, registry, pageModel)
		return {
			scenarioName: scenario.scenario,
			url: pageModel.url,
			actions,
		}
	}

	if (registry) {
		console.log('[Planner] Some steps unresolved — falling back to Gemini.')
	}

	// ── Pass 2: LLM ─────────────────────────────────────────────────────────
	if (!apiKey) {
		throw new Error(
			'GEMINI_API_KEY is required for scenarios with steps not covered by the vocabulary registry. ' +
			'Set the environment variable or add the missing steps to vocabulary/core.yaml.',
		)
	}
	const genAI = new GoogleGenerativeAI(apiKey)
	const model = genAI.getGenerativeModel({
		model: MODEL_NAME,
		generationConfig: {
			temperature: 0,
			responseMimeType: 'application/json',
			responseSchema: TEST_PLAN_SCHEMA,
		},
	})

	const prompt = buildPrompt(scenario, pageModel)
	const result = await withRetry(() => model.generateContent(prompt))
	const text = result.response.text().trim()

	let parsed: TestPlan
	try {
		parsed = JSON.parse(text) as TestPlan
	} catch (err) {
		const preview = text.length > 300 ? text.slice(0, 300) + '… [truncated]' : text
		throw new Error(
			`Gemini returned unparsable JSON.\n\nRaw output (first 300 chars):\n${preview}\n\nParse error: ${err}`,
		)
	}

	if (!parsed.scenarioName || !parsed.url || !Array.isArray(parsed.actions)) {
		throw new Error(
			`TestPlan shape invalid. Got:\n${JSON.stringify(parsed, null, 2)}`,
		)
	}

	// Tag all LLM-generated actions
	parsed.actions = parsed.actions.map(a => ({ ...a, source: 'llm' as const }))

	const validation = validatePlan(parsed, pageModel)
	for (const warning of validation.warnings) {
		console.warn(warning)
	}
	if (!validation.valid) {
		console.warn(
			`[Planner] ${validation.unknownSelectors.length} unknown selector(s) — ` +
				`plan may produce failing tests. Proceeding with best effort.`,
		)
	}

	return parsed
}
