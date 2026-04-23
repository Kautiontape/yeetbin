<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	interface Props {
		content: string;
		renderedHtml?: string | null;
		language?: string | null;
	}

	let { content, renderedHtml, language = 'text' }: Props = $props();
	let codeEl: HTMLDivElement;
	let clientHtml = $state('');

	onMount(async () => {
		if (renderedHtml || !browser) return;
		// Client-side Shiki highlighting for non-SSR cases
		try {
			const { codeToHtml } = await import('shiki');
			clientHtml = await codeToHtml(content, {
				lang: language || 'text',
				themes: { dark: 'github-dark', light: 'github-light' }
			});
		} catch {
			// fallback handled in template
		}
	});
</script>

<div bind:this={codeEl} class="yb-code-block">
	{#if renderedHtml}
		{@html renderedHtml}
	{:else if clientHtml}
		{@html clientHtml}
	{:else}
		<pre class="yb-code"><code>{content}</code></pre>
	{/if}
</div>
