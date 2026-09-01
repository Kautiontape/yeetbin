// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/**
			 * Set by the burn-after-reading reveal action. The bin is deleted before
			 * the page's load functions re-run, so the content rides along here for
			 * the render that follows.
			 */
			burnedBin?: {
				bin: {
					id: string;
					content: string;
					type: string;
					language: string | null;
					mode: 'read-only' | 'editable' | 'forkable';
					encrypted: boolean;
					forked_from: string | null;
					burn: boolean;
					created_at: string;
					has_password: boolean;
				};
				renderedHtml: string | null;
			};
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
