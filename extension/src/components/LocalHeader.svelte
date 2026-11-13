<script lang="ts">
	// Mirrors #lib/components/Header.svelte, with in-extension links and a "local" badge so a
	// local bin is never mistaken for a published one.
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { getContentTypeList, getContentType } from '#lib/content-types/registry.js';
	import { clearDraft } from '#lib/utils/draft.js';
	import { detectFromFilename } from '#lib/utils/detect-type.js';

	interface Props {
		showTypeSelector?: boolean;
		selectedType?: string;
		onTypeChange?: (type: string) => void;
		selectedLanguage?: string;
		onLanguageChange?: (lang: string) => void;
		onLoad?: (text: string, type: string, language?: string, name?: string) => void;
	}

	let {
		showTypeSelector = false,
		selectedType = 'markdown',
		onTypeChange,
		selectedLanguage = 'javascript',
		onLanguageChange,
		onLoad
	}: Props = $props();

	const types = getContentTypeList();
	let languages = $derived(getContentType(selectedType).languages);
	let fileInput = $state<HTMLInputElement>();

	async function handleFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const { type, language } = detectFromFilename(file.name);
			onLoad?.(text, type, language, file.name);
		} finally {
			input.value = '';
		}
	}

	function startNew(e: MouseEvent) {
		e.preventDefault();
		clearDraft();
		location.hash = '#/new';
		location.reload();
	}
</script>

<header
	class="yb-print-hide flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700"
>
	<div class="flex items-center gap-4">
		<div class="flex items-center gap-2">
			<a href="#/" class="text-lg font-bold tracking-tight hover:opacity-80 transition-opacity">
				yeetbin
			</a>
			<span
				class="text-xs px-1.5 py-0.5 rounded font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
				title="Stored in this browser only. Nothing is uploaded until you press Publish."
			>
				local
			</span>
		</div>
		<a
			href="#/new"
			onclick={startNew}
			class="text-sm px-3 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
		>
			New
		</a>
		{#if onLoad}
			<input bind:this={fileInput} type="file" class="hidden" onchange={handleFile} />
			<button
				type="button"
				onclick={() => fileInput?.click()}
				class="text-sm px-3 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
			>
				Load
			</button>
		{/if}
		{#if showTypeSelector}
			<select
				value={selectedType}
				onchange={(e) => onTypeChange?.(e.currentTarget.value)}
				class="text-sm px-2 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				{#each types as t}
					<option value={t.slug}>{t.label}</option>
				{/each}
			</select>
			{#if languages?.length}
				<select
					value={selectedLanguage}
					onchange={(e) => onLanguageChange?.(e.currentTarget.value)}
					class="text-sm px-2 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					{#each languages as lang}
						<option value={lang.value}>{lang.label}</option>
					{/each}
				</select>
			{/if}
		{/if}
	</div>
	<ThemeToggle />
</header>
