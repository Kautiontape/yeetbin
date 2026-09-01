import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { bins } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { serverRenderContent } from '$lib/server/render.js';
import bcrypt from 'bcryptjs';
import type { PageServerLoad, Actions } from './$types';

function meta(bin: typeof bins.$inferSelect) {
	return {
		id: bin.id,
		type: bin.type,
		language: bin.language,
		mode: bin.mode,
		encrypted: bin.encrypted,
		forked_from: bin.forked_from,
		burn: bin.burn,
		created_at: bin.created_at,
		has_password: !!bin.password
	};
}

export const load: PageServerLoad = async ({ params, cookies, locals }) => {
	// A bin revealed by the `reveal` action below is already deleted by the time
	// loads re-run in the same request, so the action hands the content over here.
	const burned = locals.burnedBin;
	if (burned && burned.bin.id === params.id) {
		return {
			bin: burned.bin,
			passwordRequired: false,
			burnPending: false,
			justBurned: true,
			renderedHtml: burned.renderedHtml
		};
	}

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
				bin: { ...meta(bin), content: null },
				passwordRequired: true,
				burnPending: false,
				justBurned: false,
				renderedHtml: null
			};
		}
	}

	// Burn-after-reading: never hand out the content on a plain page view, or the
	// author burns their own bin the moment they land on it after publishing.
	// The reader has to ask for it explicitly via the `reveal` action below.
	if (bin.burn) {
		return {
			bin: { ...meta(bin), content: null },
			passwordRequired: false,
			burnPending: true,
			justBurned: false,
			renderedHtml: null
		};
	}

	// SSR: render content to HTML on the server if possible
	let renderedHtml: string | null = null;
	if (!bin.encrypted) {
		renderedHtml = await serverRenderContent(bin.type, bin.content, bin.language);
	}

	return {
		bin: { ...meta(bin), content: bin.content },
		passwordRequired: false,
		burnPending: false,
		justBurned: false,
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
	},

	reveal: async ({ params, cookies, locals }) => {
		const bin = db.select().from(bins).where(eq(bins.id, params.id)).get();

		if (!bin) {
			error(404, 'Bin not found');
		}

		if (bin.expires_at && new Date(bin.expires_at) < new Date()) {
			db.delete(bins).where(eq(bins.id, params.id)).run();
			error(410, 'This bin has expired');
		}

		if (!bin.burn) {
			error(400, 'This bin does not burn after reading');
		}

		if (bin.password && cookies.get(`yb-auth-${bin.id}`) !== 'granted') {
			error(401, 'Password required');
		}

		// Hand the content over exactly once, then drop the row.
		db.delete(bins).where(eq(bins.id, params.id)).run();

		const revealed = {
			bin: { ...meta(bin), content: bin.content },
			renderedHtml: bin.encrypted
				? null
				: await serverRenderContent(bin.type, bin.content, bin.language)
		};

		// For a no-JS form post, loads re-run before the page renders — and the
		// bin is gone by then. Pass it along on `locals` so load can still use it.
		locals.burnedBin = revealed;

		return { revealed: true, ...revealed };
	}
} satisfies Actions;
