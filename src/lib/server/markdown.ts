import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import markPlugin from 'markdown-it-mark';
import footnotePlugin from 'markdown-it-footnote';
import _katexModule from '@vscode/markdown-it-katex';
// CJS/ESM interop: the actual plugin function is double-nested
const katexPlugin = (_katexModule as any).default || _katexModule;
import { calloutPlugin } from '$lib/plugins/callout.js';
import { wikilinkPlugin } from '$lib/plugins/wikilink.js';
import { mermaidPlugin } from '$lib/plugins/mermaid.js';
import { taskStatesPlugin } from '$lib/plugins/task-states.js';
import { createShikiHighlighter } from './plugins/shiki.js';

let md: MarkdownIt;
let initialized = false;

async function initMarkdown(): Promise<MarkdownIt> {
	if (initialized) return md;

	md = new MarkdownIt({
		html: false,
		linkify: true,
		typographer: true
	});

	md.use(taskLists, { enabled: true, label: true });
	md.use(taskStatesPlugin);
	md.use(markPlugin);
	md.use(footnotePlugin);
	md.use(katexPlugin, { throwOnError: false });
	md.use(calloutPlugin);
	md.use(wikilinkPlugin);
	md.use(mermaidPlugin);

	// Set up Shiki for code highlighting
	const highlighter = await createShikiHighlighter();
	if (highlighter) {
		md.options.highlight = highlighter;
	}

	initialized = true;
	return md;
}

// Eagerly initialize on module load
const mdPromise = initMarkdown();

export async function renderMarkdown(content: string): Promise<string> {
	const instance = await mdPromise;
	return instance.render(content);
}
