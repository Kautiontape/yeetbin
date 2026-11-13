<script lang="ts">
	// The web editor (src/routes/+page.svelte), saving to this browser instead of publishing.
	// Publishing happens from the saved bin's page.
	import CodeEditor from '#lib/components/CodeEditor.svelte';
	import ContentPreview from '#lib/components/ContentPreview.svelte';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import PrintButton from '#lib/components/PrintButton.svelte';
	import { defaultEditMode } from '#lib/utils/responsive.js';
	import { loadDraft, saveDraft, clearDraft } from '#lib/utils/draft.js';
	import LocalHeader from '../components/LocalHeader.svelte';
	import { createBin } from '../lib/store';

	const initialDraft = loadDraft();

	let content = $state(initialDraft?.content ?? '');
	let selectedType = $state(initialDraft?.type ?? 'markdown');
	let selectedLanguage = $state(initialDraft?.language ?? 'javascript');
	let title = $state('');
	let viewMode = $state<'edit' | 'preview' | 'split'>(defaultEditMode());
	let saving = $state(false);
	let error = $state('');

	let copyOptions = $derived([
		{
			label: 'Copy Source',
			action: () => {
				if (content) navigator.clipboard.writeText(content);
			}
		}
	]);

	$effect(() => {
		const snapshot = { content, type: selectedType, language: selectedLanguage };
		const timer = setTimeout(() => saveDraft(snapshot), 500);
		return () => clearTimeout(timer);
	});

	function loadFile(text: string, type: string, language?: string, name?: string) {
		if (content.trim() && !confirm('Replace the current content with the loaded file?')) return;
		content = text;
		selectedType = type;
		if (language) selectedLanguage = language;
		title = name ?? '';
	}

	async function save() {
		if (!content.trim() || saving) return;
		saving = true;
		error = '';
		try {
			const bin = await createBin({
				content,
				type: selectedType,
				language: selectedType === 'code' ? selectedLanguage : null,
				title,
				source: 'editor'
			});
			clearDraft();
			location.hash = `#/b/${bin.id}`;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save';
		} finally {
			saving = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'Enter')) {
			e.preventDefault();
			save();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex flex-col h-screen">
	<LocalHeader
		showTypeSelector
		{selectedType}
		onTypeChange={(t) => (selectedType = t)}
		{selectedLanguage}
		onLanguageChange={(l) => (selectedLanguage = l)}
		onLoad={loadFile}
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

			<div class="flex items-center gap-1 ml-auto">
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
						type={selectedType}
						language={selectedLanguage}
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

	<!-- Save bar -->
	<div
		class="yb-print-hide flex flex-wrap items-center gap-3 px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 text-sm"
	>
		<span class="text-neutral-500">Saved in this browser only. Publish from the saved bin when you want a public link.</span>
		{#if error}
			<span class="text-red-500">{error}</span>
		{/if}
		<button
			onclick={save}
			disabled={!content.trim() || saving}
			title="Ctrl+S"
			class="ml-auto w-full sm:w-auto px-4 py-2 font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
		>
			{saving ? 'Saving...' : 'Save locally'}
		</button>
	</div>
</div>
