<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view';
	import { EditorState, type Extension } from '@codemirror/state';
	import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { theme } from '$lib/stores/theme';
	import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
	import { pasteMarkdownExtension } from '$lib/extensions/paste-markdown';

	interface Props {
		content?: string;
		onchange?: (value: string) => void;
		placeholder?: string;
		readonly?: boolean;
		/** Content type: 'markdown' | 'code' | 'mermaid' | 'text' */
		type?: string;
		/** Language for code type: 'javascript' | 'python' | etc. */
		language?: string | null;
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
			case 'php': {
				const { php } = await import('@codemirror/lang-php');
				return php();
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

		if (type === 'markdown') {
			extensions.push(pasteMarkdownExtension());
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
		// The `content` prop is the source of truth; in steady-state typing it
		// already mirrors the editor doc, so rebuilding from it preserves typed
		// text and also picks up externally-set content (e.g. loaded files).
		const doc = content;
		const old = view;
		// Clear the reference before the async gap so the content-sync effect
		// doesn't dispatch onto a destroyed view.
		view = undefined;
		old?.destroy();
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

	// Sync externally-set content (e.g. a loaded file) into the editor.
	// User typing keeps `content` equal to the doc, so this is a no-op then.
	// Read `content` first so it's always tracked — even on the initial run
	// when `view` is still undefined during the async onMount.
	$effect(() => {
		const next = content;
		if (!view) return;
		if (next !== view.state.doc.toString()) {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: next }
			});
		}
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

<div bind:this={container} class="code-editor relative h-full overflow-auto"></div>

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
	.code-editor :global(.yb-paste-hint) {
		position: absolute;
		bottom: 0.75rem;
		left: 50%;
		transform: translateX(-50%);
		background: var(--color-gray-800, #1f2937);
		color: var(--color-gray-100, #f3f4f6);
		font-size: 0.8rem;
		padding: 0.4rem 0.85rem;
		border-radius: 0.375rem;
		opacity: 0;
		animation: yb-hint-fade 10s ease-in-out forwards;
		pointer-events: none;
		z-index: 10;
		white-space: nowrap;
	}
	@keyframes yb-hint-fade {
		0% { opacity: 0; transform: translateX(-50%) translateY(4px); }
		5% { opacity: 1; transform: translateX(-50%) translateY(0); }
		85% { opacity: 1; }
		100% { opacity: 0; }
	}
</style>
