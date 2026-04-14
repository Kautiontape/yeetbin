<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view';
	import { EditorState, type Extension } from '@codemirror/state';
	import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { theme } from '$lib/stores/theme';
	import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

	interface Props {
		content?: string;
		onchange?: (value: string) => void;
		placeholder?: string;
		readonly?: boolean;
		/** Content type: 'markdown' | 'code' | 'mermaid' | 'text' */
		type?: string;
		/** Language for code type: 'javascript' | 'python' | etc. */
		language?: string;
	}

	let {
		content = '',
		onchange,
		placeholder = '',
		readonly = false,
		type = 'markdown',
		language = ''
	}: Props = $props();

	let container: HTMLDivElement;
	let view: EditorView | undefined;
	let currentTheme: string;
	let langExtension: Extension | null = null;

	async function loadLanguageExtension(): Promise<Extension | null> {
		if (type === 'text') return null;
		if (type === 'mermaid') return null;
		if (type === 'markdown' || (!type && !language)) {
			const { markdown } = await import('@codemirror/lang-markdown');
			return markdown();
		}

		// Code type — load by language
		switch (language) {
			case 'javascript':
			case 'typescript': {
				const { javascript } = await import('@codemirror/lang-javascript');
				return javascript({ typescript: language === 'typescript', jsx: false });
			}
			case 'python': {
				const { python } = await import('@codemirror/lang-python');
				return python();
			}
			case 'html': {
				const { html } = await import('@codemirror/lang-html');
				return html();
			}
			case 'css': {
				const { css } = await import('@codemirror/lang-css');
				return css();
			}
			case 'json': {
				const { json } = await import('@codemirror/lang-json');
				return json();
			}
			case 'rust': {
				const { rust } = await import('@codemirror/lang-rust');
				return rust();
			}
			case 'sql': {
				const { sql } = await import('@codemirror/lang-sql');
				return sql();
			}
			default: {
				// Fallback to plain text (no language extension)
				return null;
			}
		}
	}

	function createView(doc: string): EditorView {
		const extensions: Extension[] = [
			keymap.of([...defaultKeymap, ...historyKeymap]),
			history(),
			syntaxHighlighting(defaultHighlightStyle),
			EditorView.lineWrapping,
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					onchange?.(update.state.doc.toString());
				}
			})
		];

		if (langExtension) {
			extensions.push(langExtension);
		}

		if (currentTheme === 'dark') {
			extensions.push(oneDark);
		}

		if (placeholder) {
			extensions.push(placeholderExt(placeholder));
		}

		if (readonly) {
			extensions.push(EditorState.readOnly.of(true));
		}

		return new EditorView({
			state: EditorState.create({ doc, extensions }),
			parent: container
		});
	}

	async function rebuildEditor() {
		if (!container) return;
		const doc = view ? view.state.doc.toString() : content;
		view?.destroy();
		langExtension = await loadLanguageExtension();
		view = createView(doc);
	}

	const unsubTheme = theme.subscribe((t) => {
		currentTheme = t;
		if (view) rebuildEditor();
	});

	// Rebuild when type or language changes
	$effect(() => {
		// Access these to track them
		type;
		language;
		if (view) rebuildEditor();
	});

	onMount(async () => {
		langExtension = await loadLanguageExtension();
		view = createView(content);
	});

	onDestroy(() => {
		view?.destroy();
		unsubTheme();
	});
</script>

<div bind:this={container} class="code-editor h-full overflow-auto"></div>

<style>
	.code-editor :global(.cm-editor) {
		height: 100%;
		font-size: 14px;
	}
	.code-editor :global(.cm-editor.cm-focused) {
		outline: none;
	}
	.code-editor :global(.cm-scroller) {
		overflow: auto;
	}
</style>
