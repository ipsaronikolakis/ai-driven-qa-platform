/**
 * Verifies 1.4: identical inputs produce identical plans across 3 runs.
 *
 * Uses the deterministic resolver path (no Gemini call) so the test is fast,
 * offline, and free.
 */
import { test, expect } from '@playwright/test'
import * as path from 'path'
import { VocabularyRegistry } from '../../vocabulary/registry'
import { generateTestPlan } from '../planner'
import { BDDScenario, PageModel } from '../../types'

const VOCAB_FILE = path.resolve(__dirname, '../../../vocabulary/core.yaml')

const SCENARIO: BDDScenario = {
	scenario: 'User logs in successfully',
	steps: [
		{ keyword: 'Given', text: 'I am on the login page' },
		{ keyword: 'When', text: 'I fill in "username" with "tomsmith"' },
		{ keyword: 'And', text: 'I fill in "password" with "SuperSecretPassword!"' },
		{ keyword: 'And', text: 'I click the "Login" button' },
		{ keyword: 'Then', text: 'I should see "You logged into a secure area!"' },
	],
}

const PAGE_MODEL: PageModel = {
	title: 'The Internet',
	url: 'https://the-internet.herokuapp.com/login',
	elements: [
		{ type: 'input', text: 'Username', selector: '#username' },
		{ type: 'input', text: 'Password', selector: '#password' },
		{ type: 'button', text: 'Login', selector: 'button.radius' },
	],
}

test('planner produces identical output across 3 runs with identical inputs', async () => {
	const registry = VocabularyRegistry.load(VOCAB_FILE)

	const plans = await Promise.all([
		generateTestPlan(SCENARIO, PAGE_MODEL, undefined, registry),
		generateTestPlan(SCENARIO, PAGE_MODEL, undefined, registry),
		generateTestPlan(SCENARIO, PAGE_MODEL, undefined, registry),
	])

	const serialised = plans.map(p => JSON.stringify(p, null, 2))
	expect(serialised[1]).toBe(serialised[0])
	expect(serialised[2]).toBe(serialised[0])
})
