/**
 * markdown-it plugin for Obsidian-style wikilinks.
 *
 * Renders [[Page Name]] and [[Page Name|Display Text]] as styled spans.
 * Since there's no vault to link to, they're displayed as non-clickable references.
 */
import type MarkdownIt from 'markdown-it';

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function wikilinkPlugin(md: MarkdownIt): void {
	md.inline.ruler.push('wikilink', (state, silent) => {
		const src = state.src.slice(state.pos);

		if (src[0] !== '[' || src[1] !== '[') return false;

		// Find closing ]]
		const closeIdx = src.indexOf(']]', 2);
		if (closeIdx === -1) return false;

		const inner = src.slice(2, closeIdx);
		if (!inner || inner.includes('\n')) return false;

		if (!silent) {
			const parts = inner.split('|');
			const page = parts[0].trim();
			const display = (parts[1] || parts[0]).trim();

			const token = state.push('wikilink', '', 0);
			token.content = display;
			token.meta = { page };
		}

		state.pos += closeIdx + 2;
		return true;
	});

	md.renderer.rules.wikilink = function (tokens, idx) {
		const token = tokens[idx];
		const display = escapeHtml(token.content);
		const page = escapeHtml(token.meta.page);
		return `<span class="yb-wikilink" title="${page}">${display}</span>`;
	};
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
