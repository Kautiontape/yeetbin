<script lang="ts">
	interface CopyOption {
		label: string;
		action: () => void;
	}

	interface Props {
		options: CopyOption[];
	}

	let { options }: Props = $props();

	let open = $state(false);
	let feedback = $state('');
	let feedbackTimer: ReturnType<typeof setTimeout>;
	let containerEl: HTMLDivElement;

	function handleDefault() {
		if (options.length > 0) {
			runAction(options[0]);
		}
	}

	function runAction(option: CopyOption) {
		option.action();
		showFeedback(option.label);
		open = false;
	}

	function showFeedback(label: string) {
		clearTimeout(feedbackTimer);
		feedback = label;
		feedbackTimer = setTimeout(() => (feedback = ''), 2000);
	}

	function handleClickOutside(e: MouseEvent) {
		if (open && containerEl && !containerEl.contains(e.target as Node)) {
			open = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div bind:this={containerEl} class="relative inline-flex">
	{#if feedback}
		<span
			class="text-xs text-neutral-500 absolute -top-6 left-0 whitespace-nowrap bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded shadow-sm border border-neutral-200 dark:border-neutral-700"
		>
			{feedback}
		</span>
	{/if}

	<button
		onclick={handleDefault}
		class="text-sm px-3 py-1.5 rounded-l-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
	>
		<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
		</svg>
		Copy
	</button>
	<button
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
		class="text-sm px-1.5 py-1.5 rounded-r-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border-l border-neutral-200 dark:border-neutral-700"
	>
		<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg z-10 min-w-40 py-1"
		>
			{#each options as option}
				<button
					onclick={() => runAction(option)}
					class="w-full text-left text-sm px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
				>
					{option.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
