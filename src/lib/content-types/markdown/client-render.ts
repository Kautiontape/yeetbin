import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import markPlugin from 'markdown-it-mark';
import _katexModule from '@vscode/markdown-it-katex';
const katexPlugin = (_katexModule as any).default || _katexModule;
import { calloutPlugin } from '$lib/plugins/callout';
import { wikilinkPlugin } from '$lib/plugins/wikilink';
import { mermaidPlugin } from '$lib/plugins/mermaid';
import { taskStatesPlugin } from '$lib/plugins/task-states';

const md = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: true
});

md.use(taskLists, { enabled: true, label: true });
md.use(taskStatesPlugin);
md.use(markPlugin);
md.use(katexPlugin, { throwOnError: false });
md.use(calloutPlugin);
md.use(wikilinkPlugin);
md.use(mermaidPlugin);

export function renderMarkdown(content: string): string {
	return md.render(content);
}
