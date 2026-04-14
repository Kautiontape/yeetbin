import type { Component } from 'svelte';

export interface ContentTypeDefinition {
	label: string;
	slug: string;
	extension: string;
	ssrCapable: boolean;
	editorLanguage?: () => Promise<unknown>;
	renderer: () => Promise<{ default: Component<{ content: string; renderedHtml?: string }> }>;
	languages?: { value: string; label: string }[];
}

export const contentTypes: Record<string, ContentTypeDefinition> = {
	markdown: {
		label: 'Markdown',
		slug: 'markdown',
		extension: 'md',
		ssrCapable: true,
		editorLanguage: () => import('@codemirror/lang-markdown').then((m) => m.markdown()),
		renderer: () => import('./markdown/renderer.svelte')
	},
	code: {
		label: 'Code',
		slug: 'code',
		extension: 'txt',
		ssrCapable: true,
		renderer: () => import('./code/renderer.svelte'),
		languages: [
			{ value: 'javascript', label: 'JavaScript' },
			{ value: 'typescript', label: 'TypeScript' },
			{ value: 'python', label: 'Python' },
			{ value: 'html', label: 'HTML' },
			{ value: 'css', label: 'CSS' },
			{ value: 'json', label: 'JSON' },
			{ value: 'bash', label: 'Bash' },
			{ value: 'rust', label: 'Rust' },
			{ value: 'go', label: 'Go' },
			{ value: 'sql', label: 'SQL' }
		]
	},
	mermaid: {
		label: 'Mermaid',
		slug: 'mermaid',
		extension: 'mmd',
		ssrCapable: false,
		renderer: () => import('./mermaid/renderer.svelte')
	},
	text: {
		label: 'Plain Text',
		slug: 'text',
		extension: 'txt',
		ssrCapable: true,
		renderer: () => import('./text/renderer.svelte')
	}
};

export function getContentType(slug: string): ContentTypeDefinition {
	return contentTypes[slug] ?? contentTypes.text;
}

export function getContentTypeList(): { slug: string; label: string }[] {
	return Object.values(contentTypes).map((ct) => ({ slug: ct.slug, label: ct.label }));
}
