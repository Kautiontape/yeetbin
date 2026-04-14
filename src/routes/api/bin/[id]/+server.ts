import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { bins } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const bin = db.select().from(bins).where(eq(bins.id, params.id)).get();

	if (!bin) {
		error(404, 'Bin not found');
	}

	if (bin.expires_at && new Date(bin.expires_at) < new Date()) {
		db.delete(bins).where(eq(bins.id, params.id)).run();
		error(410, 'This bin has expired');
	}

	if (bin.burn) {
		db.delete(bins).where(eq(bins.id, params.id)).run();
	}

	return json({
		id: bin.id,
		content: bin.content,
		type: bin.type,
		language: bin.language,
		mode: bin.mode,
		encrypted: bin.encrypted,
		forked_from: bin.forked_from,
		burn: bin.burn,
		created_at: bin.created_at,
		updated_at: bin.updated_at
	});
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const bin = db.select().from(bins).where(eq(bins.id, params.id)).get();

	if (!bin) {
		error(404, 'Bin not found');
	}

	if (bin.mode !== 'editable') {
		error(403, 'This bin is not editable');
	}

	const body = await request.json();
	const { content } = body;

	if (!content?.trim()) {
		return json({ error: 'Content is required' }, { status: 400 });
	}

	const now = new Date().toISOString();
	db.update(bins)
		.set({ content, updated_at: now })
		.where(eq(bins.id, params.id))
		.run();

	return json({ id: bin.id, updated: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const bin = db.select().from(bins).where(eq(bins.id, params.id)).get();

	if (!bin) {
		error(404, 'Bin not found');
	}

	db.delete(bins).where(eq(bins.id, params.id)).run();

	return json({ deleted: true });
};
