<script lang="ts">
	import { renderMarkdown } from '$lib/content-types/markdown/client-render';

	interface Props {
		content: string;
		type: string;
		language?: string | null;
		renderedHtml?: string | null;
	}

	let { content, type, language = null, renderedHtml = null }: Props = $props();

	let markdownHtml = $state('');

	$effect(() => {
		if (type === 'markdown' && !renderedHtml) {
			markdownHtml = renderMarkdown(content);
		}
	});
</script>

{#if type === 'markdown'}
	<div class="yb-prose">
		{@html renderedHtml || markdownHtml}
	</div>
{:else if type === 'mermaid'}
	{#await import('$lib/content-types/mermaid/renderer.svelte') then mod}
		<mod.default {content} />
	{/await}
{:else if type === 'code'}
	{#await import('$lib/content-types/code/renderer.svelte') then mod}
		<mod.default {content} {renderedHtml} {language} />
	{/await}
{:else}
	<pre class="yb-text">{content}</pre>
{/if}
