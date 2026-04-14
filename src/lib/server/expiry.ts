import { db } from './db/index.js';
import { bins } from './db/schema.js';
import { lt } from 'drizzle-orm';

/**
 * Delete all bins whose expires_at is in the past.
 * Returns the number of deleted bins.
 */
export function cleanExpiredBins(): number {
	const now = new Date().toISOString();
	const result = db.delete(bins).where(lt(bins.expires_at, now)).run();
	return result.changes;
}

/**
 * Start a periodic cleanup interval. Runs every 5 minutes.
 */
export function startExpiryCleanup(): void {
	// Run once immediately on startup
	const count = cleanExpiredBins();
	if (count > 0) {
		console.log(`[expiry] Cleaned ${count} expired bins on startup`);
	}

	setInterval(() => {
		const deleted = cleanExpiredBins();
		if (deleted > 0) {
			console.log(`[expiry] Cleaned ${deleted} expired bins`);
		}
	}, 5 * 60 * 1000);
}
