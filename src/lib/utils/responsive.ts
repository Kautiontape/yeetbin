import { browser } from '$app/environment';

/** Returns 'edit' on mobile-width screens, 'split' on desktop. Checked once at import time. */
export function defaultEditMode(): 'edit' | 'split' {
	if (!browser) return 'split';
	return window.innerWidth < 768 ? 'edit' : 'split';
}
