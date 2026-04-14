<script lang="ts">
	interface Props {
		content: string;
		renderedHtml?: string;
	}

	let { content, renderedHtml }: Props = $props();
</script>

{#if renderedHtml}
	<div class="yb-prose">
		{@html renderedHtml}
	</div>
{:else}
	<div class="yb-prose">
		<p class="text-neutral-500">Rendering...</p>
	</div>
{/if}
