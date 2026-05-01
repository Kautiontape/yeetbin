<script lang="ts">
	import '../app.css';
	import { theme } from '$lib/stores/theme';
	import { browser } from '$app/environment';

	let { children } = $props();

	// Apply theme class on mount
	$effect(() => {
		if (browser) {
			document.documentElement.classList.toggle('dark', $theme === 'dark');
		}
	});

	// Warm up the Typst PDF engine during browser idle time so the WASM module
	// is network-cached (and parsed in memory) before the user clicks Download
	// PDF. This costs nothing on the critical path — initial render finishes
	// first, then the chunk loads in the background.
	$effect(() => {
		if (!browser) return;
		const w = window as unknown as {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
			cancelIdleCallback?: (h: number) => void;
		};
		let cancel: () => void;
		const run = () => {
			import('$lib/utils/typst-pdf').catch(() => {
				// Silent — this is a prefetch. Real failures surface on click.
			});
		};
		if (w.requestIdleCallback) {
			const handle = w.requestIdleCallback(run, { timeout: 5000 });
			cancel = () => w.cancelIdleCallback?.(handle);
		} else {
			const handle = setTimeout(run, 1500);
			cancel = () => clearTimeout(handle);
		}
		return cancel;
	});
</script>

<div class="yb-app min-h-screen bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-200">
	{@render children()}
</div>
