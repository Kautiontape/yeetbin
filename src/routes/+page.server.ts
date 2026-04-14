import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { bins } from '$lib/server/db/schema.js';
import { generateId } from '$lib/server/id.js';
import bcrypt from 'bcryptjs';
import type { Actions } from './$types';

const VALID_MODES = ['read-only', 'editable', 'forkable'] as const;

export const actions = {
	publish: async ({ request }) => {
		const form = await request.formData();
		const content = form.get('content') as string;
		const type = (form.get('type') as string) || 'markdown';
		const language = (form.get('language') as string) || null;
		const mode = (form.get('mode') as string) || 'read-only';
		const rawPassword = (form.get('password') as string) || '';

		if (!content?.trim()) {
			return { error: 'Content is required' };
		}

		if (!VALID_MODES.includes(mode as (typeof VALID_MODES)[number])) {
			return { error: 'Invalid mode' };
		}

		const id = await generateId();
		const now = new Date().toISOString();

		let hashedPassword: string | null = null;
		if (rawPassword) {
			hashedPassword = await bcrypt.hash(rawPassword, 10);
		}

		db.insert(bins)
			.values({
				id,
				content,
				type,
				language: language || null,
				mode: mode as (typeof VALID_MODES)[number],
				password: hashedPassword,
				encrypted: false,
				burn: false,
				created_at: now,
				updated_at: now
			})
			.run();

		redirect(303, `/${id}`);
	}
} satisfies Actions;
