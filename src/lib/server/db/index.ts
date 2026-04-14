import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { building } from '$app/environment';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
	if (!_db) {
		if (building) {
			throw new Error('Cannot access database during build');
		}
		const dbPath = process.env.DATABASE_URL || './data/yeetbin.db';
		const client = new Database(dbPath);
		client.pragma('journal_mode = WAL');
		client.pragma('foreign_keys = ON');
		_db = drizzle(client, { schema });
	}
	return _db;
}

// For backwards compat — lazy getter
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
	get(_target, prop, receiver) {
		return Reflect.get(getDb(), prop, receiver);
	}
});
