<script lang="ts">
	import { tick } from 'svelte';
	import { browser } from '$app/environment';
	import { renderMarkdown } from '$lib/content-types/markdown/client-render';
	import { theme } from '$lib/stores/theme';
	import MermaidLightbox, { markExpandable } from './MermaidLightbox.svelte';

	interface Props {
		content: string;
		type: string;
		language?: string | null;
		renderedHtml?: string | null;
	}

	let { content, type, language = null, renderedHtml = null }: Props = $props();

	let markdownHtml = $state('');
	let markdownEl: HTMLDivElement | undefined = $state();
	let lightboxSvg = $state<SVGSVGElement | null>(null);

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
				markExpandable(el);
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
				markExpandable(el);
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

	// Open rendered diagrams in the lightbox on click or Enter/Space. Delegated
	// so it survives the diagram markup being replaced on re-render.
	function mermaidLightboxTrigger(node: HTMLElement) {
		function open(target: EventTarget | null) {
			const el = target instanceof Element ? target : null;
			// Let links inside the diagram (Mermaid `click … href`) work normally
			if (!el || el.closest('a')) return false;
			const svg = el.closest('.yb-mermaid-expandable')?.querySelector('svg');
			if (!svg) return false;
			lightboxSvg = svg;
			return true;
		}

		// Dragging across a label to select text still fires click — only treat
		// it as a click if the pointer barely moved since it went down
		let downX = 0;
		let downY = 0;
		const onPointerDown = (e: PointerEvent) => {
			downX = e.clientX;
			downY = e.clientY;
		};
		const onClick = (e: MouseEvent) => {
			// detail is 0 for clicks synthesized by assistive tech, which have no drag
			if (e.detail > 0 && Math.hypot(e.clientX - downX, e.clientY - downY) > 4) return;
			if (open(e.target)) e.preventDefault();
		};
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key !== 'Enter' && e.key !== ' ') return;
			const el = e.target as Element;
			if (el.classList?.contains('yb-mermaid-expandable') && open(el)) e.preventDefault();
		};

		node.addEventListener('pointerdown', onPointerDown);
		node.addEventListener('click', onClick);
		node.addEventListener('keydown', onKeydown);
		return () => {
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('click', onClick);
			node.removeEventListener('keydown', onKeydown);
		};
	}
</script>

<div class="contents" {@attach mermaidLightboxTrigger}>
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
</div>

{#if lightboxSvg}
	<MermaidLightbox source={lightboxSvg} onclose={() => (lightboxSvg = null)} />
{/if}
