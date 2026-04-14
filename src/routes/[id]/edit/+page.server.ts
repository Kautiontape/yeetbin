import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { bins } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const bin = db.select().from(bins).where(eq(bins.id, params.id)).get();

	if (!bin) {
		error(404, 'Bin not found');
	}

	if (bin.mode !== 'editable') {
		error(403, 'This bin is not editable');
	}

	return {
		bin: {
			id: bin.id,
			content: bin.content,
			type: bin.type,
			language: bin.language,
			mode: bin.mode
		}
	};
};

export const actions = {
	save: async ({ params, request }) => {
		const bin = db.select().from(bins).where(eq(bins.id, params.id)).get();

		if (!bin) {
			error(404, 'Bin not found');
		}

		if (bin.mode !== 'editable') {
			error(403, 'This bin is not editable');
		}

		const form = await request.formData();
		const content = form.get('content') as string;

		if (!content?.trim()) {
			return { error: 'Content is required' };
		}

		const now = new Date().toISOString();
		db.update(bins)
			.set({ content, updated_at: now })
			.where(eq(bins.id, params.id))
			.run();

		redirect(303, `/${params.id}`);
	}
} satisfies Actions;
