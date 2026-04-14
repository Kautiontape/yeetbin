import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { bins } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { serverRenderContent } from '$lib/server/render.js';
import bcrypt from 'bcryptjs';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const bin = db.select().from(bins).where(eq(bins.id, params.id)).get();

	if (!bin) {
		error(404, 'Bin not found');
	}

	// Check expiry
	if (bin.expires_at && new Date(bin.expires_at) < new Date()) {
		db.delete(bins).where(eq(bins.id, params.id)).run();
		error(410, 'This bin has expired');
	}

	// If password-protected, check for auth cookie
	if (bin.password) {
		const authToken = cookies.get(`yb-auth-${bin.id}`);
		if (authToken !== 'granted') {
			return {
				bin: {
					id: bin.id,
					type: bin.type,
					mode: bin.mode,
					encrypted: bin.encrypted,
					forked_from: bin.forked_from,
					burn: bin.burn,
					created_at: bin.created_at,
					has_password: true
				},
				passwordRequired: true,
				renderedHtml: null
			};
		}
	}

	// Handle burn-after-reading: serve content then delete
	if (bin.burn) {
		db.delete(bins).where(eq(bins.id, params.id)).run();
	}

	// SSR: render content to HTML on the server if possible
	let renderedHtml: string | null = null;
	if (!bin.encrypted) {
		renderedHtml = await serverRenderContent(bin.type, bin.content, bin.language);
	}

	return {
		bin: {
			id: bin.id,
			content: bin.content,
			type: bin.type,
			language: bin.language,
			mode: bin.mode,
			encrypted: bin.encrypted,
			forked_from: bin.forked_from,
			burn: bin.burn,
			created_at: bin.created_at,
			has_password: !!bin.password
		},
		passwordRequired: false,
		renderedHtml
	};
};

export const actions = {
	unlock: async ({ params, request, cookies }) => {
		const bin = db.select().from(bins).where(eq(bins.id, params.id)).get();

		if (!bin || !bin.password) {
			error(404, 'Bin not found');
		}

		const form = await request.formData();
		const password = form.get('password') as string;

		if (!password) {
			return { passwordError: 'Password is required' };
		}

		const valid = await bcrypt.compare(password, bin.password);
		if (!valid) {
			return { passwordError: 'Incorrect password' };
		}

		// Set auth cookie (session-scoped, no expiry)
		cookies.set(`yb-auth-${bin.id}`, 'granted', {
			path: `/${bin.id}`,
			httpOnly: true,
			sameSite: 'lax',
			secure: false // set to true in production behind HTTPS
		});

		return { unlocked: true };
	}
} satisfies Actions;
