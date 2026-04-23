<script lang="ts">
	import { onMount } from 'svelte';

	const printModes = [
		{ label: 'Rendered', mode: 'rendered' },
		{ label: 'Source', mode: 'source' },
		{ label: 'Rendered + Source', mode: 'both-rendered' },
		{ label: 'Source + Rendered', mode: 'both-source' }
	];

	let open = $state(false);
	let containerEl: HTMLDivElement;

	function printWith(mode: string) {
		document.body.dataset.printMode = mode;
		open = false;
		window.print();
	}

	function handleClickOutside(e: MouseEvent) {
		if (open && containerEl && !containerEl.contains(e.target as Node)) {
			open = false;
		}
	}

	onMount(() => {
		const cleanup = () => {
			delete document.body.dataset.printMode;
		};
		window.addEventListener('afterprint', cleanup);
		return () => window.removeEventListener('afterprint', cleanup);
	});
</script>

<svelte:window onclick={handleClickOutside} />

<div bind:this={containerEl} class="relative inline-flex">
	<button
		onclick={() => printWith('rendered')}
		class="text-sm px-3 py-1.5 rounded-l-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
	>
		<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M6 9V2h12v7" />
			<path stroke-linecap="round" stroke-linejoin="round" d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
			<rect x="6" y="14" width="12" height="8" rx="1" />
		</svg>
		Print
	</button>
	<button
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
		aria-label="Print options"
		class="text-sm px-1.5 py-1.5 rounded-r-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border-l border-neutral-200 dark:border-neutral-700"
	>
		<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg z-10 min-w-48 py-1"
		>
			{#each printModes as { label, mode }}
				<button
					onclick={() => printWith(mode)}
					class="w-full text-left text-sm px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
				>
					{label}
				</button>
			{/each}
		</div>
	{/if}
</div>
