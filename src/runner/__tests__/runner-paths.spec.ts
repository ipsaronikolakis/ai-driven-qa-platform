/**
 * Verifies 2.6: runner handles spec paths containing spaces and single quotes
 * without shell injection or argument splitting errors.
 *
 * Strategy: write minimal passing specs into generated/ (inside testDir so
 * Playwright can find them), run via runSpecs(), assert they pass, then
 * clean up.  Uses execFileSync (not exec) so no shell is involved — spaces
 * and quotes in paths cannot cause injection.
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { runSpecs } from '../runner'

const GENERATED_DIR = path.resolve(__dirname, '../../../generated')

const MINIMAL_SPEC = `
import { test } from '@playwright/test';
test('path safety check', async () => {
  // intentionally empty — just needs to pass
});
`

test('runner handles spec path with spaces in filename', () => {
	// Ensure generated/ exists (it may not on a fresh clone)
	fs.mkdirSync(GENERATED_DIR, { recursive: true })

	const specPath = path.join(GENERATED_DIR, 'tmp path safety.spec.ts')
	try {
		fs.writeFileSync(specPath, MINIMAL_SPEC, 'utf-8')
		const result = runSpecs([{ specFilePath: specPath, content: MINIMAL_SPEC }])
		expect(result.passed).toBe(true)
	} finally {
		if (fs.existsSync(specPath)) fs.unlinkSync(specPath)
	}
})

test("runner handles spec path with single quote in filename", () => {
	fs.mkdirSync(GENERATED_DIR, { recursive: true })

	// Single quotes in filenames are valid on Unix/macOS
	const specPath = path.join(GENERATED_DIR, "tmp it's-a-test.spec.ts")
	try {
		fs.writeFileSync(specPath, MINIMAL_SPEC, 'utf-8')
		const result = runSpecs([{ specFilePath: specPath, content: MINIMAL_SPEC }])
		expect(result.passed).toBe(true)
	} finally {
		if (fs.existsSync(specPath)) fs.unlinkSync(specPath)
	}
})
