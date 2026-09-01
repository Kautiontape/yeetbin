<script lang="ts">
	import { browser } from '$app/environment';
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Header from '$lib/components/Header.svelte';
	import ContentPreview from '$lib/components/ContentPreview.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import DownloadPdfButton from '$lib/components/DownloadPdfButton.svelte';
	import PrintButton from '$lib/components/PrintButton.svelte';
	import { decrypt } from '$lib/utils/crypto';
	import { renderMarkdown } from '$lib/content-types/markdown/client-render';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();
	let viewMode = $state<'rendered' | 'source' | 'split'>('rendered');
	let contentEl = $state<HTMLDivElement | undefined>();
	let passwordInputEl: HTMLInputElement | undefined = $state();
	let revealing = $state(false);
	let linkCopied = $state(false);

	// Encryption state
	let decryptedContent = $state<string | null>(null);
	let decryptedHtml = $state<string | null>(null);
	let decryptError = $state('');

	// A burn bin this page just opened: the server copy is already deleted, so
	// this tab is holding the only remaining copy of the content.
	let justBurned = $derived(!!form?.revealed || data.justBurned);
	let bin = $derived(form?.revealed ? form.bin : data.bin);
	let serverHtml = $derived(form?.revealed ? form.renderedHtml : data.renderedHtml);
	let burnPending = $derived(data.burnPending && !justBurned);

	// After successful unlock, reload the page data
	$effect(() => {
		if (form?.unlocked) {
			invalidateAll();
		}
	});

	$effect(() => {
		if (passwordInputEl) passwordInputEl.focus();
	});

	// Decrypt end-to-end encrypted content once it's available — which for a
	// burn bin is only after the reveal, not on mount.
	$effect(() => {
		const ciphertext = bin?.encrypted ? (bin.content ?? null) : null;
		const type = bin?.type;
		if (!browser || !ciphertext || decryptedContent) return;

		const hash = window.location.hash;
		const keyMatch = hash.match(/key=([^&]+)/);
		if (!keyMatch) {
			decryptError = 'No decryption key found in URL. Ask the sender for the full link.';
			return;
		}

		let cancelled = false;
		(async () => {
			try {
				const plaintext = await decrypt(ciphertext, keyMatch[1]);
				if (cancelled) return;
				decryptedContent = plaintext;
				if (type === 'markdown') {
					decryptedHtml = renderMarkdown(plaintext);
				}
			} catch {
				if (!cancelled) decryptError = 'Decryption failed. The key may be incorrect.';
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	// Warn before the only copy of a burned bin is thrown away
	$effect(() => {
		if (!browser || !justBurned) return;
		const handler = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	});

	beforeNavigate((nav) => {
		if (!justBurned || nav.type === 'leave') return;
		const ok = confirm(
			'This bin has already been deleted from the server. If you leave this page the content is gone for good. Leave anyway?'
		);
		if (!ok) nav.cancel();
	});

	// window.location keeps the #key fragment that encrypted bins need in the link
	let shareUrl = $derived(browser ? window.location.href : page.url.href);

	async function copyLink() {
		await navigator.clipboard.writeText(shareUrl);
		linkCopied = true;
		setTimeout(() => (linkCopied = false), 2000);
	}

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
	let displayContent = $derived(bin?.encrypted ? decryptedContent : (bin?.content ?? null));
	let displayHtml = $derived(bin?.encrypted ? decryptedHtml : (serverHtml ?? null));

	$effect(() => {
		// Re-run whenever new content lands in the DOM (reveal, decrypt, view switch)
		displayContent;
		displayHtml;
		if (browser && contentEl) hydrateMermaid();
	});

	let copyOptions = $derived.by(() => {
		const opts: { label: string; action: () => void }[] = [];

		opts.push({
			label: 'Copy Source',
			action: () => {
				if (displayContent) navigator.clipboard.writeText(displayContent);
			}
		});

		if (bin?.type === 'mermaid') {
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
						bind:this={passwordInputEl}
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
	{:else if burnPending}
		<!-- Burn bin that hasn't been opened yet: hide the content behind a click -->
		<div class="flex-1 flex items-center justify-center overflow-auto">
			<div class="w-full max-w-md px-6 py-8">
				<h2 class="text-lg font-semibold text-center">This bin burns after reading</h2>
				<p class="text-sm text-neutral-500 mt-2 text-center">
					The content stays hidden until someone opens it. It can be opened once — after that
					it's deleted from the server for good, including for you.
				</p>

				<div
					class="mt-5 rounded-md border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200"
				>
					Opening it here uses up that one read. If you just created this bin, copy the link and
					send it instead.
				</div>

				<div class="mt-5">
					<p class="text-xs text-neutral-500 mb-1.5">Link to share</p>
					<div class="flex items-center gap-2">
						<input
							type="text"
							readonly
							value={shareUrl}
							onfocus={(e) => e.currentTarget.select()}
							class="flex-1 min-w-0 px-2 py-1.5 text-sm font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						<button
							onclick={copyLink}
							class="shrink-0 px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
						>
							{linkCopied ? 'Copied' : 'Copy'}
						</button>
					</div>
				</div>

				<form
					method="POST"
					action="?/reveal"
					use:enhance={() => {
						revealing = true;
						// applyAction, not update() — update() invalidates, which would
						// re-run load against a bin that no longer exists.
						return async ({ result }) => {
							await applyAction(result);
							revealing = false;
						};
					}}
					class="mt-6"
				>
					<button
						type="submit"
						disabled={revealing}
						class="w-full px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
					>
						{revealing ? 'Opening...' : 'Show it once, then delete it'}
					</button>
				</form>
			</div>
		</div>
	{:else}
		{#if justBurned}
			<div
				class="yb-print-hide px-4 py-2.5 border-b border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-sm text-red-800 dark:text-red-200"
			>
				<span class="font-semibold">Burned.</span>
				This bin has been deleted from the server. What you see below is the only copy left — if
				you reload or leave this page it's gone.
			</div>
		{/if}

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
				{#if bin.mode === 'editable' && !bin.burn}
					<a
						href="/{bin.id}/edit"
						class="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
					>
						Edit
					</a>
				{/if}
				{#if (bin.mode === 'forkable' || bin.mode === 'read-only') && !bin.burn}
					<a
						href="/{bin.id}/fork"
						class="text-sm px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
					>
						Fork
					</a>
				{/if}
				<CopyButton options={copyOptions} />
				<PrintButton />
				<DownloadPdfButton
					getContent={() => displayContent}
					getType={() => bin.type}
					getLanguage={() => bin.language}
					fallbackName={`yeetbin-${bin.id}`}
					disabled={!displayContent}
				/>
			</div>
		</div>

		<!-- Content -->
		{#if bin.encrypted && decryptError}
			<div class="flex-1 flex items-center justify-center">
				<div class="text-center max-w-sm">
					<p class="text-lg font-semibold mb-2">Encrypted bin</p>
					<p class="text-sm text-red-500">{decryptError}</p>
				</div>
			</div>
		{:else if bin.encrypted && !decryptedContent}
			<div class="flex-1 flex items-center justify-center">
				<p class="text-neutral-500">Decrypting...</p>
			</div>
		{:else if viewMode === 'split'}
			<div class="yb-split-container yb-print-hide flex-1 flex overflow-hidden">
				<div class="yb-split-pane flex-1 min-w-0 overflow-auto border-r border-neutral-200 dark:border-neutral-700">
					<div class="px-6 py-8">
						<pre class="yb-source text-sm font-mono whitespace-pre-wrap break-words">{displayContent}</pre>
					</div>
				</div>
				<div bind:this={contentEl} class="yb-split-pane flex-1 min-w-0 overflow-auto">
					<div class="px-6 py-8">
						{#if displayContent}<ContentPreview content={displayContent} type={bin.type} language={bin.language} renderedHtml={displayHtml} />{/if}
					</div>
				</div>
			</div>
		{:else if viewMode === 'source'}
			<div class="yb-print-hide flex-1 overflow-auto">
				<div class="max-w-3xl mx-auto px-6 py-8">
					<pre class="yb-source text-sm font-mono whitespace-pre-wrap break-words">{displayContent}</pre>
				</div>
			</div>
		{:else}
			<div class="yb-print-hide flex-1 overflow-auto">
				<div bind:this={contentEl} class="max-w-3xl mx-auto px-6 py-8">
					{#if displayContent}<ContentPreview content={displayContent} type={bin.type} language={bin.language} renderedHtml={displayHtml} />{/if}
				</div>
			</div>
		{/if}

		<!-- Print-only container (hidden on screen, shown during print) -->
		{#if displayContent}
			<div class="yb-print-only">
				<div class="yb-print-rendered">
					<p class="yb-print-section-label">Rendered</p>
					<div class="max-w-3xl mx-auto px-6 py-8">
						<ContentPreview content={displayContent} type={bin.type} language={bin.language} renderedHtml={displayHtml} />
					</div>
				</div>
				<div class="yb-print-source">
					<p class="yb-print-section-label">Source</p>
					<div class="max-w-3xl mx-auto px-6 py-8">
						<pre class="yb-source text-sm font-mono whitespace-pre-wrap break-words">{displayContent}</pre>
					</div>
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
					{bin.type}{#if bin.type === 'code' && bin.language}:{bin.language}{/if}
				</span>
				{#if bin.mode !== 'read-only' && !bin.burn}
					<span class="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
						{bin.mode}
					</span>
				{/if}
				{#if bin.encrypted}
					<span class="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
						encrypted
					</span>
				{/if}
				{#if bin.burn}
					<span class="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
						{justBurned ? 'burned — deleted from server' : 'burns after reading'}
					</span>
				{/if}
				{#if bin.forked_from}
					<span>
						forked from <a href="/{bin.forked_from}" class="underline">{bin.forked_from}</a>
					</span>
				{/if}
			</div>
			<span>
				{new Date(bin.created_at).toLocaleDateString('en-US', {
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
