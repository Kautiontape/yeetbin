<script lang="ts">
	interface Props {
		content: string;
		renderedHtml?: string;
	}

	let { content, renderedHtml }: Props = $props();
</script>

{#if renderedHtml}
	{@html renderedHtml}
{:else}
	<pre class="yb-text">{content}</pre>
{/if}
