import { error, text } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { bins } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { RequestHandler } from './$types';

function passwordFromBasicAuth(header: string | null): string | null {
	if (!header || !header.toLowerCase().startsWith('basic ')) return null;
	try {
		const decoded = atob(header.slice(6).trim());
		const colon = decoded.indexOf(':');
		return colon === -1 ? decoded : decoded.slice(colon + 1);
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async ({ params, url, request, cookies }) => {
	const bin = db.select().from(bins).where(eq(bins.id, params.id)).get();

	if (!bin) {
		error(404, 'Bin not found');
	}

	if (bin.expires_at && new Date(bin.expires_at) < new Date()) {
		db.delete(bins).where(eq(bins.id, params.id)).run();
		error(410, 'This bin has expired');
	}

	if (bin.password) {
		const cookieOk = cookies.get(`yb-auth-${bin.id}`) === 'granted';
		let authorized = cookieOk;

		if (!authorized) {
			const provided =
				url.searchParams.get('password') ??
				passwordFromBasicAuth(request.headers.get('authorization'));

			if (provided && (await bcrypt.compare(provided, bin.password))) {
				authorized = true;
			}
		}

		if (!authorized) {
			return new Response('Password required\n', {
				status: 401,
				headers: {
					'content-type': 'text/plain; charset=utf-8',
					'www-authenticate': 'Basic realm="yeetbin"'
				}
			});
		}
	}

	if (bin.encrypted) {
		return new Response(
			'This bin is end-to-end encrypted and cannot be served as raw text.\n',
			{ status: 422, headers: { 'content-type': 'text/plain; charset=utf-8' } }
		);
	}

	if (bin.burn) {
		db.delete(bins).where(eq(bins.id, params.id)).run();
	}

	return text(bin.content, {
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
};
