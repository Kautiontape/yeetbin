<script lang="ts">
	// Reader for a local bin: src/routes/[id]/+page.svelte without the server-only states
	// (password, burn, decryption), plus Publish and Delete.
	import ContentPreview from '#lib/components/ContentPreview.svelte';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import PrintButton from '#lib/components/PrintButton.svelte';
	import LocalHeader from '../components/LocalHeader.svelte';
	import PublishMenu from '../components/PublishMenu.svelte';
	import { renderContent } from '../lib/render';
	import { deleteBin, getBin, type LocalBin } from '../lib/store';

	let { id }: { id: string } = $props();

	let bin = $state<LocalBin | null>(null);
	let notFound = $state(false);
	let renderedHtml = $state<string | null>(null);
	let rendering = $state(true);
	let viewMode = $state<'rendered' | 'source' | 'split'>('rendered');
	let contentEl = $state<HTMLDivElement | undefined>();
	let justPublished = $state<string | null>(null);
	let linkCopied = $state(false);
	let confirmDelete = $state(false);

	$effect(() => {
		let cancelled = false;
		(async () => {
			const found = await getBin(id);
			if (cancelled) return;
			if (!found) {
				notFound = true;
				return;
			}
			bin = found;
			document.title = `${found.title} · yeetbin (local)`;
			// Wait for the full render so fenced code doesn't flash unhighlighted first.
			const html = await renderContent(found.type, found.content, found.language);
			if (cancelled) return;
			renderedHtml = html;
			rendering = false;
		})();
		return () => {
			cancelled = true;
		};
	});

	let latest = $derived(bin?.published.at(-1) ?? null);

	async function copyPublished(url: string) {
		await navigator.clipboard.writeText(url);
		linkCopied = true;
		setTimeout(() => (linkCopied = false), 2000);
	}

	async function remove() {
		if (!confirmDelete) {
			confirmDelete = true;
			setTimeout(() => (confirmDelete = false), 4000);
			return;
		}
		await deleteBin(id);
		location.hash = '#/';
	}

	let copyOptions = $derived.by(() => {
		const opts: { label: string; action: () => void }[] = [];
		const content = bin?.content ?? null;

		opts.push({
			label: 'Copy Source',
			action: () => {
				if (content) navigator.clipboard.writeText(content);
			}
		});

		if (bin?.type === 'mermaid') {
			opts.push({
				label: 'Copy Preview',
				action: async () => {
					const svg = contentEl?.querySelector(
						'.yb-mermaid-standalone svg, .yb-mermaid-rendered svg'
					) as SVGElement | null;
					if (!svg) return;
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
								await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
							}
						}, 'image/png');
					};
					img.src = url;
				}
			});
			opts.push({
				label: 'Copy as HTML',
				action: () => {
					const svg = contentEl?.querySelector(
						'.yb-mermaid-standalone svg, .yb-mermaid-rendered svg'
					);
					if (svg) navigator.clipboard.writeText(new XMLSerializer().serializeToString(svg));
				}
			});
		} else if (renderedHtml && content) {
			const html = renderedHtml;
			opts.push({
				label: 'Copy Preview',
				action: () => {
					navigator.clipboard.write([
						new ClipboardItem({
							'text/html': new Blob([html], { type: 'text/html' }),
							'text/plain': new Blob([content], { type: 'text/plain' })
						})
					]);
				}
			});
			opts.push({
				label: 'Copy as HTML',
				action: () => navigator.clipboard.writeText(html)
			});
		}
		return opts;
	});

	const dateFormat: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	};
</script>

<div class="flex flex-col h-screen">
	<LocalHeader />

	{#if notFound}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<p class="text-lg font-semibold">No local bin called {id}</p>
				<p class="text-sm text-neutral-500 mt-1">
					It may have been deleted. <a href="#/" class="underline">See all local bins</a>
				</p>
			</div>
		</div>
	{:else if bin}
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

			<div class="flex items-center gap-1 flex-wrap ml-auto">
				<PublishMenu
					{bin}
					onpublished={(updated, url) => {
						bin = updated;
						justPublished = url;
					}}
				/>
				<CopyButton options={copyOptions} />
				<PrintButton />
				<button
					onclick={remove}
					class="text-sm px-3 py-1.5 rounded-md transition-colors {confirmDelete
						? 'bg-red-600 text-white hover:bg-red-700'
						: 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}"
				>
					{confirmDelete ? 'Really delete?' : 'Delete'}
				</button>
			</div>
		</div>

		{#if justPublished}
			<div
				class="yb-print-hide flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-sm"
			>
				<span class="font-semibold text-blue-800 dark:text-blue-200">Published.</span>
				<input
					type="text"
					readonly
					value={justPublished}
					onfocus={(e) => e.currentTarget.select()}
					class="flex-1 min-w-0 px-2 py-1 font-mono text-xs rounded-md border border-blue-200 dark:border-blue-900 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<button
					onclick={() => copyPublished(justPublished!)}
					class="shrink-0 px-3 py-1 rounded-md border border-blue-300 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
				>
					{linkCopied ? 'Copied' : 'Copy'}
				</button>
				{#if !latest?.burn}
					<a
						href={justPublished}
						target="_blank"
						rel="noopener"
						class="shrink-0 px-3 py-1 rounded-md border border-blue-300 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
					>
						Open
					</a>
				{:else}
					<span class="text-xs text-blue-700 dark:text-blue-300">Burns on first view, so don't open it yourself.</span>
				{/if}
			</div>
		{/if}

		<!-- Content -->
		{#if rendering}
			<div class="flex-1 flex items-center justify-center">
				<p class="text-neutral-500">Rendering...</p>
			</div>
		{:else if viewMode === 'split'}
			<div class="yb-split-container yb-print-hide flex-1 flex overflow-hidden">
				<div
					class="yb-split-pane flex-1 min-w-0 overflow-auto border-r border-neutral-200 dark:border-neutral-700"
				>
					<div class="px-6 py-8">
						<pre class="yb-source text-sm font-mono whitespace-pre-wrap break-words">{bin.content}</pre>
					</div>
				</div>
				<div bind:this={contentEl} class="yb-split-pane flex-1 min-w-0 overflow-auto">
					<div class="px-6 py-8">
						<ContentPreview content={bin.content} type={bin.type} language={bin.language} {renderedHtml} />
					</div>
				</div>
			</div>
		{:else if viewMode === 'source'}
			<div class="yb-print-hide flex-1 overflow-auto">
				<div class="max-w-3xl mx-auto px-6 py-8">
					<pre class="yb-source text-sm font-mono whitespace-pre-wrap break-words">{bin.content}</pre>
				</div>
			</div>
		{:else}
			<div class="yb-print-hide flex-1 overflow-auto">
				<div bind:this={contentEl} class="max-w-3xl mx-auto px-6 py-8">
					<ContentPreview content={bin.content} type={bin.type} language={bin.language} {renderedHtml} />
				</div>
			</div>
		{/if}

		<!-- Print-only container (hidden on screen, shown during print) -->
		{#if !rendering}
			<div class="yb-print-only">
				<div class="yb-print-rendered">
					<p class="yb-print-section-label">Rendered</p>
					<div class="max-w-3xl mx-auto px-6 py-8">
						<ContentPreview content={bin.content} type={bin.type} language={bin.language} {renderedHtml} />
					</div>
				</div>
				<div class="yb-print-source">
					<p class="yb-print-section-label">Source</p>
					<div class="max-w-3xl mx-auto px-6 py-8">
						<pre class="yb-source text-sm font-mono whitespace-pre-wrap break-words">{bin.content}</pre>
					</div>
				</div>
			</div>
		{/if}

		<!-- Footer info -->
		<div
			class="yb-print-hide flex items-center justify-between gap-4 px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500"
		>
			<div class="flex items-center gap-2 min-w-0">
				<span class="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-medium">
					{bin.type}{#if bin.type === 'code' && bin.language}:{bin.language}{/if}
				</span>
				<span
					class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
				>
					local
				</span>
				<span class="truncate" title={bin.title}>{bin.title}</span>
				{#if latest}
					<span class="truncate">
						published to <a href={latest.burn ? undefined : latest.url} target="_blank" rel="noopener" class="underline">{latest.url.replace(/#.*$/, '')}</a>{#if bin.published.length > 1}&nbsp;(+{bin.published.length - 1} more){/if}
					</span>
				{/if}
			</div>
			<span class="shrink-0">{new Date(bin.created_at).toLocaleDateString('en-US', dateFormat)}</span>
		</div>
	{/if}
</div>
