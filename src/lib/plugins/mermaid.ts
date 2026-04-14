/**
 * markdown-it plugin for Mermaid diagram blocks.
 *
 * Intercepts fenced code blocks with language "mermaid" and renders them
 * as placeholder divs that get hydrated client-side by Mermaid.js.
 */
import type MarkdownIt from 'markdown-it';

export function mermaidPlugin(md: MarkdownIt): void {
	const defaultFence =
		md.renderer.rules.fence ||
		function (tokens, idx, options, _env, self) {
			return self.renderToken(tokens, idx, options);
		};

	md.renderer.rules.fence = function (tokens, idx, options, env, self) {
		const token = tokens[idx];
		const lang = token.info.trim().toLowerCase();

		if (lang === 'mermaid') {
			const escaped = token.content
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;');

			return `<div class="yb-mermaid" data-mermaid-source="${escaped}"><pre class="yb-mermaid-fallback">${escaped}</pre></div>\n`;
		}

		return defaultFence(tokens, idx, options, env, self);
	};
}
