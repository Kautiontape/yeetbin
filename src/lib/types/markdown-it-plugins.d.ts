declare module 'markdown-it-task-lists' {
	import type MarkdownIt from 'markdown-it';
	const taskLists: MarkdownIt.PluginWithOptions;
	export default taskLists;
}

declare module 'markdown-it-mark' {
	import type MarkdownIt from 'markdown-it';
	const markPlugin: MarkdownIt.PluginSimple;
	export default markPlugin;
}
