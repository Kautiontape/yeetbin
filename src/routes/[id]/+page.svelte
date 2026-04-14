<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Header from '$lib/components/Header.svelte';
	import ContentPreview from '$lib/components/ContentPreview.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import { decrypt } from '$lib/utils/crypto';
	import { renderMarkdown } from '$lib/content-types/markdown/client-render';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();
	let viewMode = $state<'rendered' | 'source' | 'split'>('rendered');
	let contentEl: HTMLDivElement;

	// Encryption state
	let decryptedContent = $state<string | null>(null);
	let decryptedHtml = $state<string | null>(null);
	let decryptError = $state('');

	// After successful unlock, reload the page data
	$effect(() => {
		if (form?.unlocked) {
			invalidateAll();
		}
	});

	onMount(async () => {
		if (!browser || data.passwordRequired) return;

		// Handle encrypted bins
		if (data.bin.encrypted && data.bin.content) {
			const hash = window.location.hash;
			const keyMatch = hash.match(/key=([^&]+)/);
			if (!keyMatch) {
				decryptError = 'No decryption key found in URL. Ask the sender for the full link.';
				return;
			}
			try {
				decryptedContent = await decrypt(data.bin.content, keyMatch[1]);
				// Client-side render for markdown
				if (data.bin.type === 'markdown') {
					decryptedHtml = renderMarkdown(decryptedContent);
				}
			} catch {
				decryptError = 'Decryption failed. The key may be incorrect.';
				return;
			}
		}

		// Hydrate Mermaid diagrams
		await hydrateMermaid();
	});

	async function hydrateMermaid() {
		if (!contentEl) return;
		const mermaidEls = contentEl.querySelectorAll('.yb-mermaid[data-mermaid-source]');
		if (!mermaidEls.length) return;

		const mermaid = (await import('mermaid')).default;
		mermaid.initialize({ startOnLoad: false, theme: 'dark' });

		for (const el of mermaidEls) {
			const source = el
				.getAttribute('data-mermaid-source')!
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
			} catch {
				// Keep fallback visible
			}
		}
	}

	// Resolved content — decrypted or plaintext
	let displayContent = $derived(
		data.bin.encrypted ? decryptedContent : (data.bin.content ?? null)
	);
	let displayHtml = $derived(
		data.bin.encrypted ? decryptedHtml : (data.renderedHtml ?? null)
	);

	let copyOptions = $derived.by(() => {
		const opts: { label: string; action: () => void }[] = [];

		opts.push({
			label: 'Copy Source',
			action: () => {
				if (displayContent) navigator.clipboard.writeText(displayContent);
			}
		});

		if (data.bin.type === 'mermaid') {
			opts.push({
				label: 'Copy Preview',
				action: async () => {
					const svg = contentEl?.querySelector('.yb-mermaid-standalone svg, .yb-mermaid-rendered svg') as SVGElement | null;
					if (!svg) return;

					// Get actual dimensions from the rendered SVG bounding box
					const bbox = svg.getBoundingClientRect();
					const svgClone = svg.cloneNode(true) as SVGElement;
					svgClone.setAttribute('width', String(bbox.width));
					svgClone.setAttribute('height', String(bbox.height));

					const svgData = new XMLSerializer().serializeToString(svgClone);
					const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
					const url = URL.createObjectURL(svgBlob);
					const img = new Image();
					img.onload = async () => {
						const scale = 2;
						const canvas = document.createElement('canvas');
						canvas.width = bbox.width * scale;
						canvas.height = bbox.height * scale;
						const ctx = canvas.getContext('2d')!;
						ctx.scale(scale, scale);
						ctx.fillStyle = '#ffffff';
						ctx.fillRect(0, 0, bbox.width, bbox.height);
						ctx.drawImage(img, 0, 0, bbox.width, bbox.height);
						URL.revokeObjectURL(url);

						canvas.toBlob(async (pngBlob) => {
							if (pngBlob) {
								await navigator.clipboard.write([
									new ClipboardItem({ 'image/png': pngBlob })
								]);
							}
						}, 'image/png');
					};
					img.src = url;
				}
			});

			opts.push({
				label: 'Copy as HTML',
				action: () => {
					const svg = contentEl?.querySelector('.yb-mermaid-standalone svg, .yb-mermaid-rendered svg');
					if (svg) {
						navigator.clipboard.writeText(new XMLSerializer().serializeToString(svg));
					}
				}
			});
		} else if (displayHtml) {
			opts.push({
				label: 'Copy Preview',
				action: () => {
					if (displayHtml && displayContent) {
						const blob = new Blob([displayHtml], { type: 'text/html' });
						navigator.clipboard.write([
							new ClipboardItem({
								'text/html': blob,
								'text/plain': new Blob([displayContent], { type: 'text/plain' })
							})
						]);
					}
				}
			});

			opts.push({
				label: 'Copy as HTML',
				action: () => {
					if (displayHtml) navigator.clipboard.writeText(displayHtml);
				}
			});
		}

		return opts;
	});
</script>


<svelte:head>
	<title>yeetbin - {data.bin.id}</title>
</svelte:head>

<div class="flex flex-col h-screen">
	<Header />

	{#if data.passwordRequired}
		<!-- Password prompt -->
		<div class="flex-1 flex items-center justify-center">
			<div class="w-full max-w-sm px-6">
				<div class="text-center mb-6">
					<h2 class="text-lg font-semibold">This bin is password-protected</h2>
					<p class="text-sm text-neutral-500 mt-1">Enter the password to view its contents.</p>
				</div>
				<form method="POST" action="?/unlock" use:enhance class="space-y-4">
					<input
						type="password"
						name="password"
						placeholder="Password"
						autofocus
						class="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					{#if form?.passwordError}
						<p class="text-sm text-red-500">{form.passwordError}</p>
					{/if}
					<button
						type="submit"
						class="w-full px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
					>
						Unlock
					</button>
				</form>
			</div>
		</div>
	{:else}
		<!-- Reader toolbar -->
		<div
			class="yb-print-hide flex flex-wrap items-center gap-2 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700"
		>
			<div class="flex items-center gap-1">
				{#each ['rendered', 'source', 'split'] as mode}
					<button
						onclick={() => (viewMode = mode as typeof viewMode)}
						class="text-sm px-3 py-1 rounded-md transition-colors {viewMode === mode
							? 'bg-neutral-200 dark:bg-neutral-800 font-medium'
							: 'hover:bg-neutral-100 dark:hover:bg-neutral-800/50'}"
					>
						{mode.charAt(0).toUpperCase() + mode.slice(1)}
					</button>
				{/each}
			</div>

			<div class="h-4 w-px bg-neutral-200 dark:bg-neutral-800 hidden sm:block"></div>

			<div class="flex items-center gap-1 flex-wrap">
				{#if data.bin.mode === 'editable'}
					<a
						href="/{data.bin.id}/edit"
						class="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
					>
						Edit
					</a>
				{/if}
				{#if data.bin.mode === 'forkable' || data.bin.mode === 'read-only'}
					<a
						href="/{data.bin.id}/fork"
						class="text-sm px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
					>
						Fork
					</a>
				{/if}
				<CopyButton options={copyOptions} />
				<button
					onclick={() => window.print()}
					class="text-sm px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
				>
					Print
				</button>
			</div>
		</div>

		<!-- Content -->
		{#if data.bin.encrypted && decryptError}
			<div class="flex-1 flex items-center justify-center">
				<div class="text-center max-w-sm">
					<p class="text-lg font-semibold mb-2">Encrypted bin</p>
					<p class="text-sm text-red-500">{decryptError}</p>
				</div>
			</div>
		{:else if data.bin.encrypted && !decryptedContent}
			<div class="flex-1 flex items-center justify-center">
				<p class="text-neutral-500">Decrypting...</p>
			</div>
		{:else if viewMode === 'split'}
			<div class="yb-split-container flex-1 flex overflow-hidden">
				<div class="yb-split-pane flex-1 min-w-0 overflow-auto border-r border-neutral-200 dark:border-neutral-700">
					<div class="px-6 py-8">
						<pre class="yb-source text-sm font-mono whitespace-pre-wrap break-words">{displayContent}</pre>
					</div>
				</div>
				<div bind:this={contentEl} class="yb-split-pane flex-1 min-w-0 overflow-auto">
					<div class="px-6 py-8">
						{#if displayContent}<ContentPreview content={displayContent} type={data.bin.type} language={data.bin.language} renderedHtml={displayHtml} />{/if}
					</div>
				</div>
			</div>
		{:else if viewMode === 'source'}
			<div class="flex-1 overflow-auto">
				<div class="max-w-3xl mx-auto px-6 py-8">
					<pre class="yb-source text-sm font-mono whitespace-pre-wrap break-words">{displayContent}</pre>
				</div>
			</div>
		{:else}
			<div class="flex-1 overflow-auto">
				<div bind:this={contentEl} class="max-w-3xl mx-auto px-6 py-8">
					{#if displayContent}<ContentPreview content={displayContent} type={data.bin.type} language={data.bin.language} renderedHtml={displayHtml} />{/if}
				</div>
			</div>
		{/if}

		<!-- Footer info -->
		<div
			class="yb-print-hide flex items-center justify-between px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500"
		>
			<div class="flex items-center gap-2">
				<span
					class="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-medium"
				>
					{data.bin.type}{#if data.bin.type === 'code' && data.bin.language}:{data.bin.language}{/if}
				</span>
				{#if data.bin.mode !== 'read-only'}
					<span class="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
						{data.bin.mode}
					</span>
				{/if}
				{#if data.bin.encrypted}
					<span class="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
						encrypted
					</span>
				{/if}
				{#if data.bin.burn}
					<span class="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
						burned
					</span>
				{/if}
				{#if data.bin.forked_from}
					<span>
						forked from <a href="/{data.bin.forked_from}" class="underline">{data.bin.forked_from}</a>
					</span>
				{/if}
			</div>
			<span>
				{new Date(data.bin.created_at).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				})}
			</span>
		</div>
	{/if}
</div>
