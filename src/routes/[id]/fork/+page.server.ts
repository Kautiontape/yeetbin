import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { bins } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { generateId } from '$lib/server/id.js';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const bin = db.select().from(bins).where(eq(bins.id, params.id)).get();

	if (!bin) {
		error(404, 'Bin not found');
	}

	return {
		parent: {
			id: bin.id,
			content: bin.content,
			type: bin.type,
			language: bin.language
		}
	};
};

export const actions = {
	publish: async ({ params, request }) => {
		const form = await request.formData();
		const content = form.get('content') as string;
		const type = (form.get('type') as string) || 'markdown';

		if (!content?.trim()) {
			return { error: 'Content is required' };
		}

		const id = await generateId();
		const now = new Date().toISOString();

		db.insert(bins)
			.values({
				id,
				content,
				type,
				mode: 'read-only',
				forked_from: params.id,
				encrypted: false,
				burn: false,
				created_at: now,
				updated_at: now
			})
			.run();

		redirect(303, `/${id}`);
	}
} satisfies Actions;
