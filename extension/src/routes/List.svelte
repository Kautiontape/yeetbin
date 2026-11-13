<script lang="ts">
	// Home page: every local bin, plus the quickest way to yeet something in. Paste anywhere,
	// or drop a file, and it renders straight away.
	import { detectFromFilename } from '#lib/utils/detect-type.js';
	import { convertHtmlToMarkdown } from '#lib/utils/html-to-markdown.js';
	import LocalHeader from '../components/LocalHeader.svelte';
	import { createBin, deleteBin, listBins, type LocalBin } from '../lib/store';

	type Bridge = { connected: boolean; error: string | null };

	let bins = $state<LocalBin[] | null>(null);
	let error = $state('');
	let dragging = $state(false);
	let confirmId = $state<string | null>(null);
	let bridge = $state<Bridge | null>(null);

	async function refresh() {
		bins = await listBins();
	}

	$effect(() => {
		document.title = 'yeetbin (local)';
		refresh();
		chrome.runtime
			.sendMessage({ kind: 'status' })
			.then((s: Bridge) => (bridge = s))
			.catch(() => (bridge = null));
	});

	async function yeet(fields: Parameters<typeof createBin>[0]) {
		error = '';
		if (!fields.content.trim()) {
			error = 'Nothing to render: the content is empty.';
			return;
		}
		if (fields.content.includes('\0')) {
			error = "That looks like a binary file; yeetbin only renders text.";
			return;
		}
		const bin = await createBin(fields);
		location.hash = `#/b/${bin.id}`;
	}

	function isEditable(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null;
		return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
	}

	function onPaste(e: ClipboardEvent) {
		if (isEditable(e.target) || !e.clipboardData) return;
		const text = e.clipboardData.getData('text/plain');
		const html = e.clipboardData.getData('text/html');
		const content = text.trim() ? text : html ? convertHtmlToMarkdown(html) : '';
		e.preventDefault();
		yeet({ content, type: 'markdown', source: 'paste' });
	}

	async function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) {
			const { type, language } = detectFromFilename(file.name);
			yeet({ content: await file.text(), type, language, title: file.name, source: 'drop' });
			return;
		}
		const text = e.dataTransfer?.getData('text/plain');
		if (text) yeet({ content: text, type: 'markdown', source: 'drop' });
	}

	async function remove(id: string) {
		if (confirmId !== id) {
			confirmId = id;
			setTimeout(() => {
				if (confirmId === id) confirmId = null;
			}, 4000);
			return;
		}
		await deleteBin(id);
		confirmId = null;
		await refresh();
	}

	function size(content: string): string {
		const bytes = new Blob([content]).size;
		return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
	}

	const dateFormat: Intl.DateTimeFormatOptions = {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	};
</script>

<svelte:window
	onpaste={onPaste}
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={(e) => {
		if (!e.relatedTarget) dragging = false;
	}}
	ondrop={onDrop}
/>

<div class="flex flex-col min-h-screen">
	<LocalHeader />

	<main class="flex-1 w-full max-w-3xl mx-auto px-6 py-8">
		<div
			class="rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors {dragging
				? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
				: 'border-neutral-300 dark:border-neutral-700'}"
		>
			<p class="text-base font-medium">Paste anywhere on this page, or drop a file, to render it here.</p>
			<p class="text-sm text-neutral-500 mt-1">
				Nothing leaves this browser until you press Publish on a bin.
			</p>
			<p class="text-sm text-neutral-500 mt-3">
				From a terminal: <code class="font-mono text-xs px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">yeet notes.md</code>
				{#if bridge?.connected}
					<span class="ml-1 text-emerald-600 dark:text-emerald-400">(CLI bridge connected)</span>
				{:else if bridge}
					<span class="ml-1 text-amber-600 dark:text-amber-400" title={bridge.error ?? ''}>
						(CLI bridge not connected; run <code class="font-mono text-xs">yeet --install-native-host</code>)
					</span>
				{/if}
			</p>
			{#if error}
				<p class="text-sm text-red-500 mt-3">{error}</p>
			{/if}
		</div>

		<h2 class="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
			Local bins{#if bins?.length}&nbsp;· {bins.length}{/if}
		</h2>

		{#if bins === null}
			<p class="text-neutral-500 text-sm">Loading...</p>
		{:else if bins.length === 0}
			<p class="text-neutral-500 text-sm">Nothing yet.</p>
		{:else}
			<ul class="divide-y divide-neutral-200 dark:divide-neutral-800 border-y border-neutral-200 dark:border-neutral-800">
				{#each bins as bin (bin.id)}
					<li class="flex items-center gap-3 py-2.5">
						<a href="#/b/{bin.id}" class="flex-1 min-w-0 group">
							<span class="block truncate font-medium group-hover:underline">{bin.title}</span>
							<span class="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
								<span class="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-medium">
									{bin.type}{#if bin.type === 'code' && bin.language}:{bin.language}{/if}
								</span>
								<span>{new Date(bin.created_at).toLocaleString('en-US', dateFormat)}</span>
								<span>{size(bin.content)}</span>
								<span>via {bin.source}</span>
								{#if bin.published.length}
									<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
										published
									</span>
								{/if}
							</span>
						</a>
						<button
							onclick={() => remove(bin.id)}
							class="shrink-0 text-xs px-2.5 py-1 rounded-md transition-colors {confirmId === bin.id
								? 'bg-red-600 text-white hover:bg-red-700'
								: 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}"
						>
							{confirmId === bin.id ? 'Really delete?' : 'Delete'}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</main>
</div>
