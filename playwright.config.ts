import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
	testDir: '.',
	testMatch: ['generated/*.spec.ts', 'src/**/__tests__/*.spec.ts'],
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: [
		['list'],
		['html', { outputFolder: 'playwright-report', open: 'never' }],
		['json', { outputFile: 'output/playwright-results.json' }],
	],
	use: {
		baseURL: process.env.BASE_URL || 'https://the-internet.herokuapp.com',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		headless: true,
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
})
