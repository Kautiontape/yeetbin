<script lang="ts">
	// Imported for its side effect: applies the stored or system theme to <html>.
	import '#lib/stores/theme.js';
	import List from './routes/List.svelte';
	import New from './routes/New.svelte';
	import View from './routes/View.svelte';

	type Route = { name: 'list' } | { name: 'new' } | { name: 'view'; id: string };

	function parse(hash: string): Route {
		const view = hash.match(/^#\/b\/([^/?#]+)/);
		if (view) return { name: 'view', id: decodeURIComponent(view[1]) };
		if (hash.startsWith('#/new')) return { name: 'new' };
		return { name: 'list' };
	}

	let route = $state<Route>(parse(location.hash));

	$effect(() => {
		const onHash = () => (route = parse(location.hash));
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	});
</script>

<div class="yb-app min-h-screen bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-200">
	{#if route.name === 'view'}
		{#key route.id}
			<View id={route.id} />
		{/key}
	{:else if route.name === 'new'}
		<New />
	{:else}
		<List />
	{/if}
</div>
