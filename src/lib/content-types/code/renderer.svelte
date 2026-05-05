<script lang="ts">
	import { browser } from '$app/environment';

	interface Props {
		content: string;
		renderedHtml?: string | null;
		language?: string | null;
	}

	let { content, renderedHtml, language = 'text' }: Props = $props();
	let codeEl: HTMLDivElement;
	let clientHtml = $state('');
	let renderSeq = 0;

	$effect(() => {
		if (renderedHtml || !browser) return;
		const lang = language || 'text';
		const src = content;
		const seq = ++renderSeq;
		(async () => {
			try {
				const { codeToHtml } = await import('shiki');
				const html = await codeToHtml(src, {
					lang,
					themes: { dark: 'github-dark', light: 'github-light' }
				});
				if (seq === renderSeq) clientHtml = html;
			} catch {
				// fallback handled in template
			}
		})();
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
