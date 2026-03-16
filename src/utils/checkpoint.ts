import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const OUTPUT_DIR = path.resolve(process.cwd(), 'output')

function ensureOutputDir(): void {
	if (!fs.existsSync(OUTPUT_DIR)) {
		fs.mkdirSync(OUTPUT_DIR, { recursive: true })
	}
}

function hashContent(...parts: string[]): string {
	return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)
}

function checkpointPath(name: string): string {
	return path.join(OUTPUT_DIR, name)
}

interface CheckpointFile<T> {
	hash: string
	savedAt: string
	data: T
}

/**
 * Saves data to a named checkpoint file in output/.
 * Records a content hash so future runs can detect whether inputs changed.
 */
export function saveCheckpoint<T>(name: string, data: T, ...hashInputs: string[]): void {
	ensureOutputDir()
	const file: CheckpointFile<T> = {
		hash: hashContent(...hashInputs),
		savedAt: new Date().toISOString(),
		data,
	}
	fs.writeFileSync(checkpointPath(name), JSON.stringify(file, null, 2), 'utf-8')
}

/**
 * Loads a checkpoint if it exists AND its hash matches the current inputs.
 * Returns null on cache miss (file missing, hash mismatch, or --fresh flag).
 */
export function loadCheckpoint<T>(name: string, ...hashInputs: string[]): T | null {
	if (process.argv.includes('--fresh')) return null

	const filePath = checkpointPath(name)
	if (!fs.existsSync(filePath)) return null

	try {
		const file = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CheckpointFile<T>
		const currentHash = hashContent(...hashInputs)
		if (file.hash !== currentHash) return null
		console.log(`[CACHE HIT] ${name} — loaded from output/${name}`)
		return file.data
	} catch {
		return null
	}
}
