import { customAlphabet } from 'nanoid';
import { db } from './db/index.js';
import { bins } from './db/schema.js';
import { eq } from 'drizzle-orm';

const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const generate = customAlphabet(alphabet, 6);

export async function generateId(): Promise<string> {
	for (let i = 0; i < 10; i++) {
		const id = generate();
		const existing = db.select({ id: bins.id }).from(bins).where(eq(bins.id, id)).get();
		if (!existing) return id;
	}
	// Fallback to longer ID if we somehow collide 10 times
	return customAlphabet(alphabet, 8)();
}
