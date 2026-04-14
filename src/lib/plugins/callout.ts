/**
 * markdown-it plugin for Obsidian-style callouts.
 *
 * Transforms blockquotes starting with [!type] into styled callout blocks:
 *   > [!note] Title
 *   > Content here
 *
 * Supports foldable callouts with +/- indicators:
 *   > [!note]+ Expanded by default
 *   > [!note]- Collapsed by default
 */
import type MarkdownIt from 'markdown-it';

// Match [!type] at start of content — no $ anchor, .* stops at first \n
const CALLOUT_RE = /^\[!(\w+)\]([+-])?\s*(.*)/i;

const CALLOUT_ALIASES: Record<string, string> = {
	summary: 'abstract',
	tldr: 'abstract',
	check: 'success',
	done: 'success',
	help: 'question',
	faq: 'question',
	fail: 'failure',
	missing: 'failure',
	attention: 'caution'
};

const CALLOUT_ICONS: Record<string, string> = {
	note: '\u270F\uFE0F',
	tip: '\uD83D\uDD25',
	info: '\u2139\uFE0F',
	warning: '\u26A0\uFE0F',
	danger: '\u26A1',
	bug: '\uD83D\uDC1B',
	example: '\uD83D\uDCCB',
	quote: '\u275D',
	abstract: '\uD83D\uDCCB',
	todo: '\u2705',
	success: '\u2714\uFE0F',
	question: '\u2753',
	failure: '\u274C',
	important: '\u2757',
	caution: '\u26A0\uFE0F'
};

export function calloutPlugin(md: MarkdownIt): void {
	const defaultRenderOpen =
		md.renderer.rules.blockquote_open ||
		function (tokens, idx, options, _env, self) {
			return self.renderToken(tokens, idx, options);
		};

	const defaultRenderClose =
		md.renderer.rules.blockquote_close ||
		function (tokens, idx, options, _env, self) {
			return self.renderToken(tokens, idx, options);
		};

	md.renderer.rules.blockquote_open = function (tokens, idx, options, env, self) {
		// Find the first inline token inside this blockquote
		const level = tokens[idx].level;
		let inlineIdx = -1;
		for (let i = idx + 1; i < tokens.length; i++) {
			if (tokens[i].type === 'blockquote_close' && tokens[i].level === level) break;
			if (tokens[i].type === 'inline') {
				inlineIdx = i;
				break;
			}
		}

		if (inlineIdx === -1) {
			return defaultRenderOpen(tokens, idx, options, env, self);
		}

		const inlineToken = tokens[inlineIdx];
		const firstLine = inlineToken.content.split('\n')[0];
		const match = firstLine.match(CALLOUT_RE);

		if (!match) {
			return defaultRenderOpen(tokens, idx, options, env, self);
		}

		const rawType = match[1].toLowerCase();
		const foldIndicator = match[2] || '';
		const titleText = match[3]?.trim() || '';
		const calloutType = CALLOUT_ALIASES[rawType] || rawType;
		const displayTitle = titleText || calloutType.charAt(0).toUpperCase() + calloutType.slice(1);
		const isFoldable = foldIndicator === '+' || foldIndicator === '-';
		const isCollapsed = foldIndicator === '-';
		const icon = CALLOUT_ICONS[calloutType] || CALLOUT_ICONS[rawType] || '';

		// Remove the [!type] first line from BOTH content and children
		const lines = inlineToken.content.split('\n');
		const remaining = lines.slice(1).join('\n').trim();
		inlineToken.content = remaining;

		// Children are what actually render — strip everything up to first softbreak
		if (inlineToken.children) {
			let softbreakIdx = -1;
			for (let i = 0; i < inlineToken.children.length; i++) {
				if (inlineToken.children[i].type === 'softbreak') {
					softbreakIdx = i;
					break;
				}
			}
			if (softbreakIdx >= 0) {
				inlineToken.children.splice(0, softbreakIdx + 1);
			} else {
				// Entire content is the [!type] line
				inlineToken.children.length = 0;
			}
		}

		// If the inline is now empty, hide the wrapping paragraph
		if (!remaining) {
			for (let i = inlineIdx - 1; i >= idx; i--) {
				if (tokens[i].type === 'paragraph_open') {
					tokens[i].hidden = true;
					break;
				}
			}
			for (let i = inlineIdx + 1; i < tokens.length; i++) {
				if (tokens[i].type === 'paragraph_close') {
					tokens[i].hidden = true;
					break;
				}
			}
			inlineToken.hidden = true;
		}

		// Mark for the close handler
		(tokens[idx] as any)._callout = true;
		(tokens[idx] as any)._calloutFoldable = isFoldable;

		const tag = isFoldable ? 'details' : 'div';
		const openAttr = isFoldable && !isCollapsed ? ' open' : '';
		const titleTag = isFoldable ? 'summary' : 'div';
		const iconSpan = icon ? `<span class="yb-callout-icon">${icon}</span> ` : '';

		return (
			`<${tag} class="yb-callout yb-callout-${calloutType}"${openAttr}>` +
			`<${titleTag} class="yb-callout-title">${iconSpan}${escapeHtml(displayTitle)}</${titleTag}>` +
			`<div class="yb-callout-content">`
		);
	};

	md.renderer.rules.blockquote_close = function (tokens, idx, options, env, self) {
		// Find the matching open
		let openIdx = -1;
		let depth = 0;
		for (let i = idx - 1; i >= 0; i--) {
			if (tokens[i].type === 'blockquote_close') depth++;
			if (tokens[i].type === 'blockquote_open') {
				if (depth === 0) {
					openIdx = i;
					break;
				}
				depth--;
			}
		}

		if (openIdx >= 0 && (tokens[openIdx] as any)._callout) {
			const isFoldable = (tokens[openIdx] as any)._calloutFoldable;
			return `</div></${isFoldable ? 'details' : 'div'}>`;
		}

		return defaultRenderClose(tokens, idx, options, env, self);
	};
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
