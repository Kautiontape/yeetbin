<script lang="ts">
	import { tick } from 'svelte';
	import { browser } from '$app/environment';
	import { renderMarkdown } from '$lib/content-types/markdown/client-render';
	import { theme } from '$lib/stores/theme';

	interface Props {
		content: string;
		type: string;
		language?: string | null;
		renderedHtml?: string | null;
	}

	let { content, type, language = null, renderedHtml = null }: Props = $props();

	let markdownHtml = $state('');
	let markdownEl: HTMLDivElement | undefined = $state();

	// Cache rendered Mermaid SVGs by source to avoid flash on re-render
	const mermaidCache = new Map<string, string>();

	$effect(() => {
		if (type === 'markdown' && !renderedHtml) {
			markdownHtml = renderMarkdown(content);
		}
	});

	function restoreCachedMermaid() {
		if (!markdownEl) return;
		const els = markdownEl.querySelectorAll<HTMLElement>('.yb-mermaid[data-mermaid-source]');
		for (const el of els) {
			const source = el.getAttribute('data-mermaid-source')!;
			const cached = mermaidCache.get(source);
			if (cached) {
				el.innerHTML = cached;
				el.classList.add('yb-mermaid-rendered');
			}
		}
	}

	async function hydrateMermaid() {
		if (!browser || !markdownEl) return;
		const els = markdownEl.querySelectorAll<HTMLElement>('.yb-mermaid[data-mermaid-source]');
		if (!els.length) return;

		// Restore cached SVGs immediately to prevent flash
		restoreCachedMermaid();

		// Find elements that still need rendering (not in cache)
		const uncached = Array.from(els).filter((el) => !el.classList.contains('yb-mermaid-rendered'));
		if (!uncached.length) return;

		const mermaid = (await import('mermaid')).default;
		const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'default';
		mermaid.initialize({ startOnLoad: false, theme: currentTheme, suppressErrorRendering: true });

		for (const el of uncached) {
			const encoded = el.getAttribute('data-mermaid-source')!;
			const source = encoded
				.replace(/&amp;/g, '&')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&quot;/g, '"');
			try {
				const { svg } = await mermaid.render(
					`mermaid-${Math.random().toString(36).slice(2)}`,
					source
				);
				el.innerHTML = svg;
				el.classList.add('yb-mermaid-rendered');
				mermaidCache.set(encoded, svg);
			} catch {
				// Keep fallback visible
			}
		}
	}

	// Invalidate mermaid cache on theme change so diagrams re-render
	$effect(() => {
		void $theme;
		mermaidCache.clear();
	});

	$effect(() => {
		// Track HTML and theme so the effect re-runs on either change
		void (renderedHtml || markdownHtml);
		void $theme;
		if (type !== 'markdown') return;
		tick().then(hydrateMermaid);
	});
</script>

{#if type === 'markdown'}
	<div class="yb-prose" bind:this={markdownEl}>
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
