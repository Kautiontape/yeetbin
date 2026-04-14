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
</script>

<div class="yb-app min-h-screen bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-200">
	{@render children()}
</div>
