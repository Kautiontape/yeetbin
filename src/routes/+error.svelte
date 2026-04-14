<script lang="ts">
	import { page } from '$app/state';
	import Header from '$lib/components/Header.svelte';
</script>

<svelte:head>
	<title>yeetbin - {page.status}</title>
</svelte:head>

<div class="flex flex-col h-screen">
	<Header />
	<div class="flex-1 flex items-center justify-center">
		<div class="text-center">
			<p class="text-6xl font-bold text-neutral-300 dark:text-neutral-700">{page.status}</p>
			<p class="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
				{#if page.status === 404}
					Bin not found. It may have been deleted or never existed.
				{:else if page.status === 410}
					This bin has expired and is no longer available.
				{:else if page.status === 403}
					You don't have permission to access this bin.
				{:else}
					{page.error?.message || 'Something went wrong.'}
				{/if}
			</p>
			<a
				href="/"
				class="inline-block mt-6 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
			>
				Create a new bin
			</a>
		</div>
	</div>
</div>
