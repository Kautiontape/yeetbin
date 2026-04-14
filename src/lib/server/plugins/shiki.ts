/**
 * Shiki code highlighter for markdown-it fence blocks.
 *
 * Returns a highlight function compatible with markdown-it's options.highlight.
 * Loads common languages on init, others on-demand.
 */
import { createHighlighter, type Highlighter } from 'shiki';

let highlighter: Highlighter | null = null;

const COMMON_LANGS = [
	'javascript',
	'typescript',
	'python',
	'html',
	'css',
	'json',
	'bash',
	'shell',
	'yaml',
	'markdown',
	'sql',
	'rust',
	'go',
	'java',
	'c',
	'cpp',
	'csharp',
	'ruby',
	'php',
	'lua',
	'toml',
	'diff',
	'dockerfile'
];

export async function createShikiHighlighter(): Promise<
	((code: string, lang: string, attrs: string) => string) | null
> {
	try {
		highlighter = await createHighlighter({
			themes: ['github-dark', 'github-light'],
			langs: COMMON_LANGS
		});

		return (code: string, lang: string, _attrs: string): string => {
			if (!highlighter) return '';

			const resolvedLang = lang || 'text';

			try {
				// Check if language is loaded
				const loadedLangs = highlighter.getLoadedLanguages();
				if (!loadedLangs.includes(resolvedLang as any)) {
					// Fall back to plain text for unknown languages
					return highlighter.codeToHtml(code, {
						lang: 'text',
						themes: { dark: 'github-dark', light: 'github-light' }
					});
				}

				return highlighter.codeToHtml(code, {
					lang: resolvedLang,
					themes: { dark: 'github-dark', light: 'github-light' }
				});
			} catch {
				// Fallback: return escaped code
				const escaped = code
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;');
				return `<pre class="shiki"><code>${escaped}</code></pre>`;
			}
		};
	} catch (err) {
		console.error('Failed to initialize Shiki:', err);
		return null;
	}
}
