<script lang="ts">
	import { inferPdfFilename } from '$lib/utils/pdf-filename';

	interface Props {
		getContent: () => string | null | undefined;
		getType: () => string;
		getLanguage?: () => string | null | undefined;
		fallbackName: string;
		disabled?: boolean;
	}

	let { getContent, getType, getLanguage, fallbackName, disabled = false }: Props = $props();

	let busy = $state(false);
	let error = $state('');
	let errorTimer: ReturnType<typeof setTimeout> | null = null;

	function flashError(msg: string) {
		error = msg;
		if (errorTimer) clearTimeout(errorTimer);
		errorTimer = setTimeout(() => (error = ''), 4000);
	}

	async function download() {
		if (busy || disabled) return;
		const content = getContent();
		if (!content) return;

		busy = true;
		error = '';
		try {
			const { generatePdf, downloadPdf } = await import('$lib/utils/typst-pdf');
			const bytes = await generatePdf({
				content,
				type: getType(),
				language: getLanguage?.() ?? null
			});
			downloadPdf(bytes, inferPdfFilename(content, fallbackName));
		} catch (e) {
			console.error('PDF generation failed', e);
			flashError(e instanceof Error ? e.message : 'PDF generation failed');
		} finally {
			busy = false;
		}
	}
</script>

<div class="relative inline-flex">
	{#if error}
		<span
			class="text-xs text-red-600 dark:text-red-400 absolute -top-6 right-0 whitespace-nowrap bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded shadow-sm border border-red-300 dark:border-red-700 max-w-xs truncate"
			title={error}
		>
			{error}
		</span>
	{/if}
	<button
		onclick={download}
		disabled={busy || disabled}
		class="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
	>
		<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4" />
			<path stroke-linecap="round" stroke-linejoin="round" d="M4 20h16" />
		</svg>
		{busy ? 'Compiling...' : 'Download PDF'}
	</button>
</div>
