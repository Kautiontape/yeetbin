<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Header from '$lib/components/Header.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import ContentPreview from '$lib/components/ContentPreview.svelte';
	import { defaultEditMode } from '$lib/utils/responsive';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let content = $state(untrack(() => data.parent.content));
	let selectedType = $state(untrack(() => data.parent.type));
	let viewMode = $state<'edit' | 'preview' | 'split'>(defaultEditMode());

	let dirty = $derived(content !== data.parent.content);
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (dirty) {
			e.preventDefault();
		}
	}}
/>

<svelte:head>
	<title>yeetbin - fork of {data.parent.id}</title>
</svelte:head>

<div class="flex flex-col h-screen">
	<Header showTypeSelector {selectedType} onTypeChange={(t) => (selectedType = t)} />

	<div class="flex-1 flex flex-col overflow-hidden">
		<div
			class="flex items-center gap-2 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700"
		>
			<span class="text-sm text-neutral-500">
				Forking from <a href="/{data.parent.id}" class="underline">{data.parent.id}</a>
			</span>
			<div class="flex items-center gap-1 ml-4">
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
		</div>

		<div class="flex-1 overflow-hidden {viewMode === 'split' ? 'yb-split-container flex' : ''}">
			{#if viewMode === 'edit'}
				<CodeEditor {content} onchange={(v) => (content = v)} type={selectedType} />
			{:else if viewMode === 'preview'}
				<div class="h-full overflow-auto">
					<div class="max-w-3xl mx-auto px-6 py-8">
						<ContentPreview {content} type={selectedType} />
					</div>
				</div>
			{:else}
				<div class="yb-split-pane flex-1 min-w-0 border-r border-neutral-200 dark:border-neutral-700">
					<CodeEditor {content} onchange={(v) => (content = v)} type={selectedType} />
				</div>
				<div class="yb-split-pane flex-1 min-w-0 overflow-auto">
					<div class="max-w-none px-6 py-8">
						<ContentPreview {content} type={selectedType} />
					</div>
				</div>
			{/if}
		</div>
	</div>

	<form
		method="POST"
		action="?/publish"
		use:enhance
		class="yb-print-hide flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-700"
	>
		<input type="hidden" name="content" value={content} />
		<input type="hidden" name="type" value={selectedType} />
		<a
			href="/{data.parent.id}"
			class="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
		>
			Cancel
		</a>
		<button
			type="submit"
			disabled={!content.trim()}
			class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
		>
			Publish Fork
		</button>
	</form>
</div>
