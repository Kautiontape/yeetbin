import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { bins } from '$lib/server/db/schema.js';
import { generateId } from '$lib/server/id.js';
import bcrypt from 'bcryptjs';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const {
		content,
		type = 'markdown',
		language,
		mode = 'read-only',
		encrypted = false,
		burn = false,
		expires_at,
		password
	} = body;

	if (!content?.trim()) {
		return json({ error: 'Content is required' }, { status: 400 });
	}

	const id = await generateId();
	const now = new Date().toISOString();

	let hashedPassword: string | null = null;
	if (password) {
		hashedPassword = await bcrypt.hash(password, 10);
	}

	db.insert(bins)
		.values({
			id,
			content,
			type,
			language: language || null,
			mode: encrypted ? 'read-only' : mode,
			password: hashedPassword,
			encrypted,
			burn,
			expires_at: expires_at || null,
			created_at: now,
			updated_at: now
		})
		.run();

	return json({ id, url: `/${id}` }, { status: 201 });
};
