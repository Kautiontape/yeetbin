<script lang="ts">
	import { goto } from '$app/navigation';
	import Header from '$lib/components/Header.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import ContentPreview from '$lib/components/ContentPreview.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import PrintButton from '$lib/components/PrintButton.svelte';
	import { encrypt } from '$lib/utils/crypto';
	import { defaultEditMode } from '$lib/utils/responsive';

	let content = $state('');
	let selectedType = $state('markdown');
	let selectedLanguage = $state('javascript');
	let viewMode = $state<'edit' | 'preview' | 'split'>(defaultEditMode());
	let selectedMode = $state<'read-only' | 'editable' | 'forkable'>('read-only');
	let password = $state('');
	let showPassword = $state(false);
	let expiry = $state('');
	let burn = $state(false);
	let encrypted = $state(false);
	let publishing = $state(false);
	let error = $state('');

	let copyOptions = $derived([
		{
			label: 'Copy Source',
			action: () => { if (content) navigator.clipboard.writeText(content); }
		}
	]);

	// Encrypted bins must be read-only
	$effect(() => {
		if (encrypted) selectedMode = 'read-only';
	});

	function computeExpiresAt(): string | null {
		if (!expiry) return null;
		const ms: Record<string, number> = {
			'1h': 3600000,
			'24h': 86400000,
			'7d': 604800000,
			'30d': 2592000000
		};
		return new Date(Date.now() + (ms[expiry] || 0)).toISOString();
	}

	async function publish() {
		if (!content.trim() || publishing) return;
		publishing = true;
		error = '';

		try {
			let finalContent = content;
			let encryptionKey = '';

			if (encrypted) {
				const result = await encrypt(content);
				finalContent = result.ciphertext;
				encryptionKey = result.key;
			}

			const res = await fetch('/api/bin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: finalContent,
					type: selectedType,
					language: selectedType === 'code' ? selectedLanguage : null,
					mode: encrypted ? 'read-only' : selectedMode,
					encrypted,
					burn,
					expires_at: computeExpiresAt(),
					password: showPassword && password ? password : null
				})
			});

			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Failed to publish';
				return;
			}

			const url = encrypted ? `/${data.id}#key=${encryptionKey}` : `/${data.id}`;
			await goto(url);
		} catch (e) {
			error = 'Failed to publish';
		} finally {
			publishing = false;
		}
	}
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (content.trim()) {
			e.preventDefault();
		}
	}}
/>

<svelte:head>
	<title>yeetbin</title>
</svelte:head>

<div class="flex flex-col h-screen">
	<Header
		showTypeSelector
		{selectedType}
		onTypeChange={(t) => (selectedType = t)}
		{selectedLanguage}
		onLanguageChange={(l) => (selectedLanguage = l)}
	/>

	<div class="flex-1 flex flex-col overflow-hidden">
		<div
			class="yb-print-hide flex flex-wrap items-center gap-2 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700"
		>
			<div class="flex items-center gap-1">
				{#each ['edit', 'preview', 'split'] as mode}
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

			<div class="flex items-center gap-1">
				<CopyButton options={copyOptions} />
				<PrintButton />
			</div>
		</div>

		<div class="yb-print-hide flex-1 overflow-hidden {viewMode === 'split' ? 'yb-split-container flex' : ''}">
			{#if viewMode === 'edit'}
				<CodeEditor
					{content}
					onchange={(v) => (content = v)}
					placeholder="Paste your content here..."
					type={selectedType}
					language={selectedLanguage}
				/>
			{:else if viewMode === 'preview'}
				<div class="h-full overflow-auto">
					<div class="max-w-3xl mx-auto px-6 py-8">
						<ContentPreview {content} type={selectedType} language={selectedLanguage} />
					</div>
				</div>
			{:else}
				<div class="yb-split-pane flex-1 min-w-0 border-r border-neutral-200 dark:border-neutral-700">
					<CodeEditor
						{content}
						onchange={(v) => (content = v)}
						placeholder="Paste your content here..."
					/>
				</div>
				<div class="yb-split-pane flex-1 min-w-0 overflow-auto">
					<div class="max-w-none px-6 py-8">
						<ContentPreview {content} type={selectedType} language={selectedLanguage} />
					</div>
				</div>
			{/if}
		</div>

		{#if content}
			<div class="yb-print-only">
				<div class="yb-print-rendered">
					<p class="yb-print-section-label">Rendered</p>
					<div class="max-w-3xl mx-auto px-6 py-8">
						<ContentPreview {content} type={selectedType} language={selectedLanguage} />
					</div>
				</div>
				<div class="yb-print-source">
					<p class="yb-print-section-label">Source</p>
					<div class="max-w-3xl mx-auto px-6 py-8">
						<pre class="yb-source text-sm font-mono whitespace-pre-wrap break-words">{content}</pre>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Publish bar -->
	<div
		class="yb-print-hide flex flex-wrap items-center gap-3 px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 text-sm"
	>
		<select
			bind:value={selectedMode}
			disabled={encrypted}
			class="px-2 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
		>
			<option value="read-only">Read-only</option>
			<option value="editable">Editable</option>
			<option value="forkable">Forkable</option>
		</select>

		<select
			bind:value={expiry}
			class="px-2 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
		>
			<option value="">Permanent</option>
			<option value="1h">1 hour</option>
			<option value="24h">24 hours</option>
			<option value="7d">7 days</option>
			<option value="30d">30 days</option>
		</select>

		<div class="flex items-center gap-3">
			<label class="flex items-center gap-1.5 text-neutral-500 cursor-pointer">
				<input type="checkbox" bind:checked={burn} class="rounded" />
				Burn
			</label>

			<label class="flex items-center gap-1.5 text-neutral-500 cursor-pointer">
				<input type="checkbox" bind:checked={encrypted} class="rounded" />
				Encrypt
			</label>

			<label class="flex items-center gap-1.5 text-neutral-500 cursor-pointer">
				<input type="checkbox" bind:checked={showPassword} class="rounded" />
				Password
			</label>
		</div>

		{#if showPassword}
			<input
				type="password"
				bind:value={password}
				placeholder="Set password..."
				class="px-2 py-1.5 w-36 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		{/if}

		{#if error}
			<span class="text-red-500">{error}</span>
		{/if}

		<button
			onclick={publish}
			disabled={!content.trim() || publishing}
			class="ml-auto w-full sm:w-auto px-4 py-2 font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
		>
			{publishing ? 'Publishing...' : 'Publish'}
		</button>
	</div>
</div>
