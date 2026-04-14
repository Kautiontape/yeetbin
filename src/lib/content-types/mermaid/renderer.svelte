<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { theme } from '$lib/stores/theme';

	interface Props {
		content: string;
		renderedHtml?: string;
	}

	let { content }: Props = $props();
	let diagramEl: HTMLDivElement;
	let error = $state('');
	let rendered = $state(false);

	async function renderDiagram() {
		if (!browser || !diagramEl) return;
		try {
			const mermaid = (await import('mermaid')).default;
			const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'default';
			mermaid.initialize({ startOnLoad: false, theme: currentTheme });
			const id = `mermaid-${Math.random().toString(36).slice(2)}`;
			const { svg } = await mermaid.render(id, content);
			diagramEl.innerHTML = svg;
			rendered = true;
			error = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to render diagram';
			rendered = false;
		}
	}

	onMount(renderDiagram);

	// Re-render when content changes (for preview in editor)
	$effect(() => {
		if (content && browser) {
			renderDiagram();
		}
	});

	// Re-render on theme change
	const unsub = theme.subscribe(() => {
		if (rendered) renderDiagram();
	});
</script>

<div class="yb-mermaid-standalone">
	<div bind:this={diagramEl} class="flex justify-center py-4">
		{#if !rendered && !error}
			<pre class="text-sm text-neutral-500">{content}</pre>
		{/if}
	</div>
	{#if error}
		<div class="mt-2 p-3 rounded-md bg-red-50 dark:bg-red-950 text-sm text-red-600 dark:text-red-400">
			<strong>Render error:</strong> {error}
		</div>
		<pre class="mt-2 text-sm text-neutral-500">{content}</pre>
	{/if}
</div>
