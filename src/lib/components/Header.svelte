<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import { getContentTypeList, getContentType } from '$lib/content-types/registry';
	import { clearDraft } from '$lib/utils/draft';
	import { detectFromFilename } from '$lib/utils/detect-type';

	interface Props {
		showTypeSelector?: boolean;
		selectedType?: string;
		onTypeChange?: (type: string) => void;
		selectedLanguage?: string;
		onLanguageChange?: (lang: string) => void;
		onLoad?: (text: string, type: string, language?: string) => void;
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
			onLoad?.(text, type, language);
		} finally {
			// Reset so selecting the same file again still fires a change event.
			input.value = '';
		}
	}
</script>

<header
	class="yb-print-hide flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700"
>
	<div class="flex items-center gap-4">
		<a href="/" class="text-lg font-bold tracking-tight hover:opacity-80 transition-opacity">
			yeetbin
		</a>
		<a
			href="/"
			onclick={(e) => {
				e.preventDefault();
				clearDraft();
				window.location.assign('/');
			}}
			class="text-sm px-3 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
		>
			New
		</a>
		{#if onLoad}
			<input
				bind:this={fileInput}
				type="file"
				class="hidden"
				onchange={handleFile}
			/>
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
