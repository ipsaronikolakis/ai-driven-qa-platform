/**
 * Web UI server for the AI-Driven QA Platform.
 *
 * Usage:
 *   npm run serve
 *
 * Serves a browser UI at http://localhost:3000 with:
 *   - Monaco editor with Gherkin syntax highlighting
 *   - Inline vocabulary linting via GET /api/lint
 *   - "Run Pipeline" button that streams pipeline output via SSE at POST /api/run
 *   - Read-only access to output/ artifacts (results, heal proposals, selector health)
 */
import * as fs from 'fs'
import * as path from 'path'
import * as child_process from 'child_process'
import express, { Request, Response } from 'express'

const app = express()
const PORT = parseInt(process.env.PORT ?? '3000', 10)

const ROOT_DIR = path.resolve(__dirname, '..', '..')
const SCENARIOS_DIR = path.resolve(ROOT_DIR, 'scenarios')
const OUTPUT_DIR = path.resolve(ROOT_DIR, 'output')
const REPORT_DIR = path.resolve(ROOT_DIR, 'playwright-report')

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))
app.use('/report', express.static(REPORT_DIR))

// ---------------------------------------------------------------------------
// GET /api/scenarios — list all .feature files
// ---------------------------------------------------------------------------

app.get('/api/scenarios', (_req: Request, res: Response) => {
	if (!fs.existsSync(SCENARIOS_DIR)) {
		res.json([])
		return
	}
	const files = fs.readdirSync(SCENARIOS_DIR)
		.filter(f => f.endsWith('.feature'))
		.map(f => ({
			name: f,
			content: fs.readFileSync(path.join(SCENARIOS_DIR, f), 'utf-8'),
		}))
	res.json(files)
})

// ---------------------------------------------------------------------------
// GET /api/scenarios/:name — read a specific feature file
// ---------------------------------------------------------------------------

app.get('/api/scenarios/:name', (req: Request, res: Response) => {
	const name = path.basename(String(req.params['name'] ?? ''))
	if (!name.endsWith('.feature')) {
		res.status(400).json({ error: 'Invalid file name' })
		return
	}
	const filePath = path.join(SCENARIOS_DIR, name)
	if (!fs.existsSync(filePath)) {
		res.status(404).json({ error: 'Not found' })
		return
	}
	res.json({ name, content: fs.readFileSync(filePath, 'utf-8') })
})

// ---------------------------------------------------------------------------
// PUT /api/scenarios/:name — save a feature file
// ---------------------------------------------------------------------------

app.put('/api/scenarios/:name', (req: Request, res: Response) => {
	const name = path.basename(String(req.params['name'] ?? ''))
	if (!name.endsWith('.feature')) {
		res.status(400).json({ error: 'Invalid file name' })
		return
	}
	const { content } = req.body as { content?: string }
	if (typeof content !== 'string') {
		res.status(400).json({ error: 'Missing content' })
		return
	}
	if (!fs.existsSync(SCENARIOS_DIR)) fs.mkdirSync(SCENARIOS_DIR, { recursive: true })
	fs.writeFileSync(path.join(SCENARIOS_DIR, name), content, 'utf-8')
	res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// POST /api/lint — lint feature file content, return warnings
// ---------------------------------------------------------------------------

app.post('/api/lint', (req: Request, res: Response) => {
	const { content } = req.body as { content?: string }
	if (typeof content !== 'string') {
		res.status(400).json({ error: 'Missing content' })
		return
	}

	// Write to a temp file and run lint-cli --no-fix
	const tmpFile = path.join(OUTPUT_DIR, '_lint-tmp.feature')
	try {
		if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
		fs.writeFileSync(tmpFile, content, 'utf-8')

		const tsNode = path.join(ROOT_DIR, 'node_modules', '.bin', 'ts-node')
		const result = child_process.spawnSync(
			tsNode, ['src/vocabulary/lint-cli.ts', tmpFile],
			{ cwd: ROOT_DIR, encoding: 'utf-8', timeout: 15_000 },
		)
		const output = result.stdout + result.stderr
		const warnings: Array<{ line: number; message: string; suggestion?: string }> = []
		for (const line of output.split('\n')) {
			const m = line.match(/\[WARN\]\s+(.+)/)
			if (m) warnings.push({ line: 0, message: m[1] ?? '' })
		}
		res.json({ warnings })
	} finally {
		try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
	}
})

// ---------------------------------------------------------------------------
// GET /api/output — list output artifacts
// ---------------------------------------------------------------------------

app.get('/api/output', (_req: Request, res: Response) => {
	if (!fs.existsSync(OUTPUT_DIR)) {
		res.json({ files: [] })
		return
	}
	const walk = (dir: string, base: string): string[] => {
		const entries: string[] = []
		for (const entry of fs.readdirSync(dir)) {
			const full = path.join(dir, entry)
			const rel = path.join(base, entry)
			if (fs.statSync(full).isDirectory()) {
				entries.push(...walk(full, rel))
			} else {
				entries.push(rel)
			}
		}
		return entries
	}
	res.json({ files: walk(OUTPUT_DIR, '') })
})

// ---------------------------------------------------------------------------
// GET /api/output/*path — read an output artifact
// ---------------------------------------------------------------------------

app.get('/api/output/*path', (req: Request, res: Response) => {
	const rel = String(req.params['path'] ?? '')
	const filePath = path.resolve(OUTPUT_DIR, rel)
	// Safety: ensure path stays inside OUTPUT_DIR
	if (!filePath.startsWith(OUTPUT_DIR + path.sep) && filePath !== OUTPUT_DIR) {
		res.status(403).json({ error: 'Forbidden' })
		return
	}
	if (!fs.existsSync(filePath)) {
		res.status(404).json({ error: 'Not found' })
		return
	}
	res.sendFile(filePath)
})

// ---------------------------------------------------------------------------
// POST /api/run — run the pipeline and stream output via SSE
// ---------------------------------------------------------------------------

app.post('/api/run', (req: Request, res: Response) => {
	const { fresh } = req.body as { fresh?: boolean }

	res.setHeader('Content-Type', 'text/event-stream')
	res.setHeader('Cache-Control', 'no-cache')
	res.setHeader('Connection', 'keep-alive')
	res.flushHeaders()

	const send = (type: string, data: string) => {
		res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
	}

	const script = fresh ? 'fresh' : 'pipeline'
	const proc = child_process.spawn('npm', ['run', script], {
		cwd: ROOT_DIR,
		env: { ...process.env },
		shell: true,
	})

	proc.stdout.on('data', (chunk: Buffer) => {
		for (const line of chunk.toString().split('\n')) {
			if (line) send('log', line)
		}
	})
	proc.stderr.on('data', (chunk: Buffer) => {
		for (const line of chunk.toString().split('\n')) {
			if (line) send('log', line)
		}
	})
	proc.on('close', (code) => {
		send('done', code === 0 ? 'PASSED' : 'FAILED')
		res.end()
	})
	proc.on('error', (err) => {
		send('error', err.message)
		res.end()
	})

	res.on('close', () => {
		if (!proc.killed) proc.kill()
	})
})

// ---------------------------------------------------------------------------
// GET /api/report-ready — returns whether playwright-report/index.html exists
// ---------------------------------------------------------------------------

app.get('/api/report-ready', (_req: Request, res: Response) => {
	const indexPath = path.join(REPORT_DIR, 'index.html')
	res.json({ ready: fs.existsSync(indexPath) })
})

// ---------------------------------------------------------------------------
// GET /api/selector-health — return selector health JSON
// ---------------------------------------------------------------------------

app.get('/api/selector-health', (_req: Request, res: Response) => {
	const healthPath = path.join(OUTPUT_DIR, 'selector-health.json')
	if (!fs.existsSync(healthPath)) {
		res.json({})
		return
	}
	res.sendFile(healthPath)
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
	console.log(`AI-Driven QA Platform UI running at http://localhost:${PORT}`)
})
