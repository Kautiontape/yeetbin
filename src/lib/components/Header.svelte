<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import { getContentTypeList, getContentType } from '$lib/content-types/registry';
	import { clearDraft } from '$lib/utils/draft';

	interface Props {
		showTypeSelector?: boolean;
		selectedType?: string;
		onTypeChange?: (type: string) => void;
		selectedLanguage?: string;
		onLanguageChange?: (lang: string) => void;
	}

	let {
		showTypeSelector = false,
		selectedType = 'markdown',
		onTypeChange,
		selectedLanguage = 'javascript',
		onLanguageChange
	}: Props = $props();

	const types = getContentTypeList();

	let languages = $derived(getContentType(selectedType).languages);
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
