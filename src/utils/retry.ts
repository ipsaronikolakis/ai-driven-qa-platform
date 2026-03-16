/**
 * Retries an async function with exponential backoff.
 * Attempt 1 → immediate
 * Attempt 2 → wait 1s
 * Attempt 3 → wait 2s
 * Attempt 4 → wait 4s (max)
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	maxAttempts = 4,
	baseDelayMs = 1000,
): Promise<T> {
	let lastError: unknown

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn()
		} catch (err) {
			lastError = err
			if (attempt === maxAttempts) break

			const delayMs = baseDelayMs * Math.pow(2, attempt - 2) // 0s, 1s, 2s, 4s
			const cappedDelay = Math.max(0, delayMs)
			console.warn(
				`[RETRY] Attempt ${attempt} of ${maxAttempts} failed — ` +
					`retrying in ${cappedDelay / 1000}s. Reason: ${(err as Error).message ?? err}`,
			)
			await sleep(cappedDelay)
		}
	}

	throw lastError
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
