/**
 * Verifies 1.3: browser.close() is always called even when an error is thrown
 * during exploration (e.g. page.evaluate() throws).
 *
 * Strategy: run exploreWithScript with a step that is guaranteed to fail
 * (navigate to an invalid URL), then verify no orphaned Chromium processes
 * remain by counting them before and after.
 */
import { test, expect } from '@playwright/test'
import * as child_process from 'child_process'
import { exploreWithScript } from '../explorer'

function chromiumProcessCount(): number {
	try {
		const out = child_process.execSync('pgrep -c -f "chromium|chrome" 2>/dev/null || echo 0', {
			encoding: 'utf-8',
			shell: true,
		}).trim()
		return parseInt(out, 10) || 0
	} catch {
		return 0
	}
}

test('no orphaned Chromium processes after a failed exploration', async () => {
	const before = chromiumProcessCount()

	// Deliberately cause explorer to fail — invalid scheme triggers a navigation error
	await exploreWithScript([
		{ action: 'navigate', value: 'invalid://not-a-real-url' },
		{ action: 'capture', value: 'invalid://not-a-real-url' },
	]).catch(() => { /* expected — we only care that cleanup ran */ })

	const after = chromiumProcessCount()

	// After a failed exploration the process count must not have grown
	expect(after).toBeLessThanOrEqual(before)
})
