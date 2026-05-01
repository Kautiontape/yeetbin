import { browser } from '$app/environment';

const KEY = 'yeetbin-draft';
const MAX_BYTES = 2_000_000;

export interface Draft {
	content: string;
	type: string;
	language: string;
}

export function loadDraft(): Draft | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (typeof parsed?.content !== 'string') return null;
		return {
			content: parsed.content,
			type: typeof parsed.type === 'string' ? parsed.type : 'markdown',
			language: typeof parsed.language === 'string' ? parsed.language : 'javascript'
		};
	} catch {
		return null;
	}
}

export function saveDraft(draft: Draft): void {
	if (!browser) return;
	if (!draft.content.trim()) {
		clearDraft();
		return;
	}
	if (draft.content.length > MAX_BYTES) {
		console.warn('[yeetbin] draft exceeds size cap, skipping autosave');
		return;
	}
	try {
		localStorage.setItem(KEY, JSON.stringify(draft));
	} catch (e) {
		console.warn('[yeetbin] failed to save draft', e);
	}
}

export function clearDraft(): void {
	if (!browser) return;
	try {
		localStorage.removeItem(KEY);
	} catch {
		// ignore
	}
}
