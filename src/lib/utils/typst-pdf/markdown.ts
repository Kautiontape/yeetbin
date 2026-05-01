// Walk markdown-it tokens and emit Typst markup.
//
// We share the same MarkdownIt instance as the screen renderer so that all the
// custom plugins (callout, wikilink, mermaid, task-states, katex, mark) end up
// with identical token shapes. We don't render through HTML — we walk tokens
// directly to produce clean Typst.

import MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it/index.js';
import taskLists from 'markdown-it-task-lists';
import markPlugin from 'markdown-it-mark';
import footnotePlugin from 'markdown-it-footnote';
import _katexModule from '@vscode/markdown-it-katex';
import { calloutPlugin } from '$lib/plugins/callout';
import { wikilinkPlugin } from '$lib/plugins/wikilink';
import { mermaidPlugin } from '$lib/plugins/mermaid';
import { taskStatesPlugin } from '$lib/plugins/task-states';

import { escapeMarkup, escapeString, rawBlock } from './escape';
import { latexMathToTypst } from './math';

const katexPlugin = (_katexModule as { default?: unknown }).default || _katexModule;

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
md.use(taskLists, { enabled: true, label: true });
md.use(taskStatesPlugin);
md.use(markPlugin);
md.use(footnotePlugin);
md.use(katexPlugin as never, { throwOnError: false });
md.use(calloutPlugin);
md.use(wikilinkPlugin);
md.use(mermaidPlugin);

export interface MermaidEmbed {
	id: string;
	source: string;
}

export interface ConvertResult {
	typst: string;
	mermaids: MermaidEmbed[];
	dataUriImages: Record<string, string>;
	httpImages: Record<string, { url: string; alt: string }>;
}

interface Ctx {
	mermaids: MermaidEmbed[];
	dataUris: Record<string, string>;
	httpImages: Record<string, { url: string; alt: string }>;
	imageCounter: number;
	// Footnotes: pre-walked typst body per footnote id, and total ref count per id.
	footnoteBodies: Map<number, string>;
	footnoteRefCounts: Map<number, number>;
}

export function markdownToTypst(content: string): ConvertResult {
	const tokens = md.parse(content, {});
	const ctx: Ctx = {
		mermaids: [],
		dataUris: {},
		httpImages: {},
		imageCounter: 0,
		footnoteBodies: new Map(),
		footnoteRefCounts: new Map()
	};
	prescanFootnotes(tokens, ctx);
	const out = walkBlocks(tokens, ctx);
	return {
		typst: out,
		mermaids: ctx.mermaids,
		dataUriImages: ctx.dataUris,
		httpImages: ctx.httpImages
	};
}

function walkBlocks(tokens: Token[], ctx: Ctx): string {
	let out = '';
	let i = 0;

	// Track list item attributes for task-list detection.
	const listItemAttrs: Record<string, string>[] = [];

	while (i < tokens.length) {
		const t = tokens[i];

		switch (t.type) {
			case 'heading_open': {
				const level = parseInt(t.tag.slice(1), 10);
				const inline = tokens[i + 1];
				out += '\n' + '='.repeat(level) + ' ' + walkInline(inline.children || [], ctx) + '\n';
				i += 3; // open, inline, close
				continue;
			}

			case 'paragraph_open': {
				if (t.hidden) { i++; continue; }
				const inline = tokens[i + 1];
				const body = walkInline(inline.children || [], ctx);
				out += '\n' + body + '\n';
				i += 3;
				continue;
			}

			case 'bullet_list_open':
			case 'ordered_list_open': {
				const ordered = t.type === 'ordered_list_open';
				const end = matchClose(tokens, i, ordered ? 'ordered_list_close' : 'bullet_list_close');
				out += '\n' + walkList(tokens.slice(i + 1, end), ctx, ordered, 0) + '\n';
				i = end + 1;
				continue;
			}

			case 'fence':
			case 'code_block': {
				const lang = (t.info || '').trim().toLowerCase();
				if (lang === 'mermaid') {
					const id = `m${ctx.mermaids.length}`;
					ctx.mermaids.push({ id, source: t.content });
					// Embed via shadow file added before compile; reference by path.
					out += `\n#align(center, image("/${id}.svg", width: 90%))\n`;
				} else {
					out += '\n' + rawBlock(t.content.replace(/\n$/, ''), lang || null) + '\n';
				}
				i++;
				continue;
			}

			case 'blockquote_open': {
				const close = matchClose(tokens, i, 'blockquote_close');
				const inner = tokens.slice(i + 1, close);
				const callout = detectCallout(inner);
				if (callout) {
					out += '\n' + emitCallout(callout, inner, ctx) + '\n';
				} else {
					const innerStr = walkBlocks(inner, ctx);
					out += `\n#yb-blockquote[\n${innerStr.trim()}\n]\n`;
				}
				i = close + 1;
				continue;
			}

			case 'hr': {
				out += '\n#yb-hr()\n';
				i++;
				continue;
			}

			case 'table_open': {
				const close = matchClose(tokens, i, 'table_close');
				out += '\n' + walkTable(tokens.slice(i + 1, close), ctx) + '\n';
				i = close + 1;
				continue;
			}

			case 'math_block': {
				const tx = latexMathToTypst(t.content.trim());
				out += `\n$ ${tx} $\n`;
				i++;
				continue;
			}

			case 'html_block': {
				// We disabled html in markdown-it config, but plugins (callouts) emit
				// the open/close handlers; html_block tokens shouldn't appear.
				i++;
				continue;
			}

			case 'footnote_block_open': {
				// Skip the entire footnotes section — Typst auto-places notes at
				// page bottom via #footnote, which we emit at each ref site.
				const close = matchClose(tokens, i, 'footnote_block_close');
				i = close + 1;
				continue;
			}

			case 'list_item_open':
			case 'list_item_close':
			case 'bullet_list_close':
			case 'ordered_list_close':
			case 'blockquote_close':
			case 'heading_close':
			case 'paragraph_close':
				// Should be consumed by their open handlers
				i++;
				continue;

			case 'inline': {
				out += walkInline(t.children || [], ctx);
				i++;
				continue;
			}

			default:
				i++;
		}
	}

	return out;
}

function walkList(items: Token[], ctx: Ctx, ordered: boolean, depth: number): string {
	const out: string[] = [];
	let i = 0;
	let counter = 1;
	while (i < items.length) {
		if (items[i].type !== 'list_item_open') { i++; continue; }
		const open = items[i];
		const close = matchClose(items, i, 'list_item_close');

		const cls = open.attrGet('class') || '';
		const isTask = cls.includes('task-list-item');
		let taskState: 'unchecked' | 'checked' | 'cancelled' | null = null;
		if (isTask) {
			if (cls.includes('yb-task-cancelled')) taskState = 'cancelled';
			else taskState = 'unchecked'; // default; checked detected from inline
		}

		const innerTokens = items.slice(i + 1, close);

		// Detect "checked" state from the rendered inline (markdown-it-task-lists
		// inserts a checkbox input with disabled+checked attributes).
		if (isTask) {
			for (const tk of innerTokens) {
				if (tk.type === 'inline' && tk.children) {
					const hasChecked = tk.children.some(
						(c) => c.type === 'html_inline' && /<input[^>]*checked/.test(c.content)
					);
					if (hasChecked) taskState = 'checked';
					// Strip checkbox <input> tokens from output
					tk.children = tk.children.filter(
						(c) => !(c.type === 'html_inline' && /<input/.test(c.content))
					);
				}
			}
		}

		const body = walkBlocks(innerTokens, ctx).trim();
		const indent = '  '.repeat(depth);
		const marker = ordered ? `${counter}.` : '-';

		if (isTask && taskState) {
			out.push(`${indent}${marker} #yb-task("${taskState}") ${body}`);
		} else {
			// Multi-line item: indent continuation lines so Typst keeps them in the item
			const lines = body.split('\n');
			out.push(`${indent}${marker} ${lines[0] || ''}`);
			for (let l = 1; l < lines.length; l++) {
				out.push(`${indent}  ${lines[l]}`);
			}
		}

		counter++;
		i = close + 1;
	}
	return out.join('\n');
}

interface CalloutInfo {
	kind: string;
	title: string | null;
	firstInlineIdx: number;
}

const CALLOUT_RE = /^\[!(\w+)\]([+-])?\s*(.*)$/i;
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

function detectCallout(innerTokens: Token[]): CalloutInfo | null {
	for (let i = 0; i < innerTokens.length; i++) {
		const tk = innerTokens[i];
		if (tk.type === 'inline') {
			const firstLine = (tk.content || '').split('\n')[0];
			const m = CALLOUT_RE.exec(firstLine);
			if (!m) return null;
			const raw = m[1].toLowerCase();
			const kind = CALLOUT_ALIASES[raw] || raw;
			const title = m[3]?.trim() || null;
			return { kind, title, firstInlineIdx: i };
		}
	}
	return null;
}

function emitCallout(info: CalloutInfo, innerTokens: Token[], ctx: Ctx): string {
	// Strip the [!type] from the first inline so it doesn't end up in the body.
	// We do this by mutating a shallow copy of children for that one token.
	const stripped = innerTokens.map((tk, idx) => {
		if (idx !== info.firstInlineIdx || tk.type !== 'inline') return tk;
		const lines = (tk.content || '').split('\n');
		const remaining = lines.slice(1).join('\n').trim();
		const cloned = Object.assign(Object.create(Object.getPrototypeOf(tk)), tk) as Token;
		cloned.content = remaining;
		if (cloned.children) {
			let softbreakIdx = -1;
			for (let c = 0; c < cloned.children.length; c++) {
				if (cloned.children[c].type === 'softbreak') { softbreakIdx = c; break; }
			}
			cloned.children = softbreakIdx >= 0
				? cloned.children.slice(softbreakIdx + 1)
				: [];
		}
		// If the inline is now empty, mark it hidden — the open paragraph stays
		// visible but yields nothing, which renders as a small gap. We can't
		// hide the paragraph here without scanning more state; the gap is mild.
		if (!remaining) cloned.hidden = true;
		return cloned;
	});

	const body = walkBlocks(stripped, ctx).trim();
	const titleArg = info.title ? `title: [${escapeMarkup(info.title)}], ` : '';
	return `#yb-callout(kind: "${escapeString(info.kind)}", ${titleArg}[\n${body}\n])`;
}

function walkTable(tokens: Token[], ctx: Ctx): string {
	// Collect cells row by row.
	let cols = 0;
	const headerRow: string[] = [];
	const bodyRows: string[][] = [];
	let inHeader = false;
	let currentRow: string[] | null = null;

	let i = 0;
	while (i < tokens.length) {
		const t = tokens[i];
		switch (t.type) {
			case 'thead_open': inHeader = true; break;
			case 'thead_close': inHeader = false; break;
			case 'tr_open': currentRow = []; break;
			case 'tr_close':
				if (currentRow) {
					if (inHeader) headerRow.push(...currentRow);
					else bodyRows.push(currentRow);
					currentRow = null;
				}
				break;
			case 'th_open':
			case 'td_open': {
				const inline = tokens[i + 1];
				const content = inline?.type === 'inline' ? walkInline(inline.children || [], ctx) : '';
				currentRow?.push(content);
				i += 3; // open, inline, close
				continue;
			}
		}
		i++;
	}

	cols = Math.max(headerRow.length, bodyRows[0]?.length ?? 0);
	if (cols === 0) return '';

	const fmt = (cell: string) => `[${cell}]`;
	const headerCells = headerRow.length
		? `table.header(${headerRow.map(fmt).join(', ')}),\n  `
		: '';
	const bodyCells = bodyRows
		.map((r) => r.map(fmt).join(', '))
		.join(',\n  ');

	return `#table(\n  columns: ${cols},\n  ${headerCells}${bodyCells}\n)`;
}

function walkInline(children: Token[], ctx: Ctx): string {
	let out = '';
	const stack: string[] = [];
	for (const c of children) {
		switch (c.type) {
			case 'text':
				out += escapeMarkup(c.content);
				break;
			case 'softbreak':
				out += ' ';
				break;
			case 'hardbreak':
				out += ' \\\n';
				break;
			case 'em_open':
				out += '#emph[';
				stack.push(']');
				break;
			case 'em_close':
				out += stack.pop() ?? ']';
				break;
			case 'strong_open':
				out += '#strong[';
				stack.push(']');
				break;
			case 'strong_close':
				out += stack.pop() ?? ']';
				break;
			case 's_open':
				out += '#strike[';
				stack.push(']');
				break;
			case 's_close':
				out += stack.pop() ?? ']';
				break;
			case 'mark_open':
				out += '#yb-highlight[';
				stack.push(']');
				break;
			case 'mark_close':
				out += stack.pop() ?? ']';
				break;
			case 'code_inline':
				out += `#raw("${escapeString(c.content)}")`;
				break;
			case 'link_open': {
				const href = c.attrGet('href') || '';
				out += `#link("${escapeString(href)}")[`;
				stack.push(']');
				break;
			}
			case 'link_close':
				out += stack.pop() ?? ']';
				break;
			case 'image': {
				const src = c.attrGet('src') || '';
				const alt = c.content || c.attrGet('alt') || '';
				if (src.startsWith('data:image/')) {
					const key = `img_${ctx.imageCounter++}`;
					ctx.dataUris[key] = src;
					out += `#image("/${key}")`;
				} else if (/^https?:\/\//i.test(src)) {
					const key = `img_${ctx.imageCounter++}`;
					ctx.httpImages[key] = { url: src, alt };
					out += `#image("/${key}")`;
				} else {
					out += `#emph[image: ${escapeMarkup(alt || src)}]`;
				}
				break;
			}
			case 'math_inline': {
				const tx = latexMathToTypst(c.content);
				out += `$${tx}$`;
				break;
			}
			case 'wikilink': {
				const meta = c.meta as { page?: string } | undefined;
				const display = c.content || meta?.page || '';
				out += `#yb-wikilink([${escapeMarkup(display)}])`;
				break;
			}
			case 'footnote_ref': {
				const meta = c.meta as { id: number; subId?: number; label?: string } | undefined;
				if (!meta) break;
				// Inline footnotes (^[...]) omit subId — treat as 0.
				out += emitFootnoteRef(meta.id, meta.subId ?? 0, ctx);
				break;
			}
			case 'html_inline':
				// Drop html_inline (we never enabled html); plugins should have handled.
				break;
			default:
				if (c.children) out += walkInline(c.children, ctx);
		}
	}
	return out;
}

// Pre-scan tokens to (a) count how many times each footnote id is referenced
// in the body and (b) extract the typst-converted body for each footnote
// definition. Both are needed before walking content so the FIRST ref site
// can emit `#footnote[body + N backrefs]` with all subId backrefs included.
function prescanFootnotes(tokens: Token[], ctx: Ctx): void {
	// Count refs everywhere (refs live in inline children).
	const visit = (toks: Token[]) => {
		for (const t of toks) {
			if (t.type === 'footnote_ref' && t.meta) {
				const id = (t.meta as { id: number }).id;
				ctx.footnoteRefCounts.set(id, (ctx.footnoteRefCounts.get(id) ?? 0) + 1);
			}
			if (t.children) visit(t.children);
		}
	};
	visit(tokens);

	// Extract footnote definitions from the footnote_block.
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].type !== 'footnote_block_open') continue;
		const blockEnd = matchClose(tokens, i, 'footnote_block_close');
		let j = i + 1;
		while (j < blockEnd) {
			if (tokens[j].type === 'footnote_open') {
				const meta = tokens[j].meta as { id: number } | undefined;
				const itemEnd = matchClose(tokens, j, 'footnote_close');
				if (meta) {
					// Walk inner block tokens, but strip the footnote_anchor tokens
					// (we emit our own backrefs).
					const inner = tokens.slice(j + 1, itemEnd).filter(
						(t) => t.type !== 'footnote_anchor'
					);
					const body = walkBlocks(inner, ctx).trim();
					ctx.footnoteBodies.set(meta.id, body);
				}
				j = itemEnd + 1;
			} else {
				j++;
			}
		}
		i = blockEnd;
	}
}

// Emit a footnote reference at a specific site.
//   First occurrence (subId 0): defines the note with body + backref links to
//     each ref site (one ↩ per ref, subscripted when there are multiple), and
//     attaches label <fn-{id}> so subsequent refs can point to it.
//   Subsequent occurrences: just call #footnote(<fn-{id}>).
// In both cases, an empty box labeled <fnref-{id}-{subId}> is placed first
// so the backref ↩ has somewhere to jump to.
function emitFootnoteRef(id: number, subId: number, ctx: Ctx): string {
	const anchor = `#box[]<fnref-${id}-${subId}>`;
	if (subId === 0) {
		const body = ctx.footnoteBodies.get(id) ?? '';
		const refCount = ctx.footnoteRefCounts.get(id) ?? 1;
		let backrefs = '';
		if (refCount === 1) {
			backrefs = ` #h(0.4em) #link(<fnref-${id}-0>)[↩]`;
		} else {
			const parts: string[] = [];
			for (let n = 0; n < refCount; n++) {
				parts.push(`#link(<fnref-${id}-${n}>)[↩#sub[${n + 1}]]`);
			}
			backrefs = ` #h(0.4em) ${parts.join(' ')}`;
		}
		return `${anchor}#footnote[${body}${backrefs}]<fn-${id}>`;
	}
	return `${anchor}#footnote(<fn-${id}>)`;
}

function matchClose(tokens: Token[], openIdx: number, closeType: string): number {
	const openType = tokens[openIdx].type;
	let depth = 1;
	for (let i = openIdx + 1; i < tokens.length; i++) {
		if (tokens[i].type === openType) depth++;
		else if (tokens[i].type === closeType) {
			depth--;
			if (depth === 0) return i;
		}
	}
	return tokens.length - 1;
}
