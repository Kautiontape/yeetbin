import { renderMarkdown } from './markdown.js';
import { createShikiHighlighter } from './plugins/shiki.js';

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

let shikiHighlight: ((code: string, lang: string, attrs: string) => string) | null = null;
const shikiReady = createShikiHighlighter().then((h) => {
	shikiHighlight = h;
});

/**
 * Server-side render content by type. Returns HTML string or null if
 * the content type doesn't support SSR.
 */
export async function serverRenderContent(
	type: string,
	content: string,
	language?: string | null
): Promise<string | null> {
	switch (type) {
		case 'markdown':
			return renderMarkdown(content);
		case 'code': {
			await shikiReady;
			if (shikiHighlight) {
				return shikiHighlight(content, language || 'text', '');
			}
			return `<pre class="yb-code"><code>${escapeHtml(content)}</code></pre>`;
		}
		case 'text':
			return `<pre class="yb-text">${escapeHtml(content)}</pre>`;
		default:
			return null;
	}
}
