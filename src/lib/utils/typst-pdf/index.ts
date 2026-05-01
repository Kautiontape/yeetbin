// Generate a PDF entirely client-side using the Typst WASM compiler.
//
// Pipeline:
//   1. Convert source content to Typst markup (markdown-it walker, or wrap raw)
//   2. Render any embedded mermaid diagrams to SVG
//   3. Mount mermaid SVGs and data-URI images into the Typst virtual filesystem
//   4. Compile to PDF bytes
//   5. Trigger a browser download

import { PREAMBLE } from './template';
import { markdownToTypst } from './markdown';
import { rawBlock, escapeMarkup } from './escape';
import { renderMermaidToSvg } from './mermaid';

import wasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';

let initialized: Promise<unknown> | null = null;

// Locally-bundled fonts. Served by SvelteKit from /static/fonts/ at the origin
// root in both dev and prod. Loading them through typst.ts's loadFonts() with
// `assets: false` means we never hit jsdelivr (or any third party) — the only
// network requests during PDF compile are these font files from our own origin.
const LOCAL_FONTS = [
	'/fonts/Inter-Regular.ttf',
	'/fonts/Inter-Italic.ttf',
	'/fonts/Inter-Bold.ttf',
	'/fonts/Inter-BoldItalic.ttf',
	'/fonts/JetBrainsMono-Regular.ttf',
	'/fonts/JetBrainsMono-Italic.ttf',
	'/fonts/JetBrainsMono-Bold.ttf',
	'/fonts/NewCMMath-Book.otf',
	// Symbol coverage: Inter is missing some Misc Symbols glyphs (notably ☑).
	// Noto Sans Symbols 2 fills in ballot boxes, dingbats, arrows, etc.
	'/fonts/NotoSansSymbols2-Regular.ttf',
	// Color emoji via COLR/CPAL (callout icons + user-pasted emoji).
	'/fonts/NotoColorEmoji-Regular-COLR.subset.ttf'
];

async function getTypst() {
	const mod = await import('@myriaddreamin/typst.ts');
	const { $typst, loadFonts } = mod;
	if (!initialized) {
		initialized = (async () => {
			try {
				await $typst.setCompilerInitOptions({
					getModule: () => ({ module_or_path: wasmUrl }),
					beforeBuild: [loadFonts(LOCAL_FONTS, { assets: false })]
				});
			} catch (e) {
				// $typst is a module-global singleton; if a previous load already
				// initialized it (e.g. during HMR), setting options throws. That's
				// fine — we just keep using the existing compiler.
				if (!String(e).includes('has been initialized')) throw e;
			}
		})();
	}
	await initialized;
	return $typst;
}

export interface GeneratePdfInput {
	content: string;
	type: 'markdown' | 'code' | 'mermaid' | 'plain' | string;
	language?: string | null;
}

export async function generatePdf({ content, type, language }: GeneratePdfInput): Promise<Uint8Array> {
	const $typst = await getTypst();

	let body: string;
	let mermaidSources: { id: string; source: string }[] = [];
	let dataUriImages: Record<string, string> = {};
	let httpImages: Record<string, { url: string; alt: string }> = {};

	if (type === 'markdown') {
		const r = markdownToTypst(content);
		body = r.typst;
		mermaidSources = r.mermaids;
		dataUriImages = r.dataUriImages;
		httpImages = r.httpImages;
	} else if (type === 'mermaid') {
		mermaidSources = [{ id: 'main', source: content }];
		body = `\n#align(center, image("/main.svg", width: 90%))\n`;
	} else if (type === 'code') {
		body = '\n' + rawBlock(content, language || null) + '\n';
	} else {
		body = '\n' + rawBlock(content) + '\n';
	}

	// Mount mermaid SVGs and data-URI images as shadow files.
	await $typst.resetShadow();
	for (const m of mermaidSources) {
		const svg = await renderMermaidToSvg(m.id, m.source);
		await $typst.mapShadow(`/${m.id}.svg`, new TextEncoder().encode(svg));
	}
	for (const [key, uri] of Object.entries(dataUriImages)) {
		const bytes = decodeDataUri(uri);
		if (bytes) await $typst.mapShadow(`/${key}`, bytes);
	}

	// External http(s) images: fetch in parallel. Successes get mounted;
	// failures (CORS, 404, network) get rewritten to a placeholder so the
	// document still compiles. The bin contents never leave the browser —
	// only the image URLs (which the screen renderer already fetches).
	if (Object.keys(httpImages).length) {
		const results = await Promise.all(
			Object.entries(httpImages).map(async ([key, info]) => {
				try {
					const res = await fetch(info.url, { mode: 'cors', credentials: 'omit' });
					if (!res.ok) throw new Error(`${res.status}`);
					const bytes = new Uint8Array(await res.arrayBuffer());
					return { key, bytes, info };
				} catch {
					return { key, bytes: null, info };
				}
			})
		);
		for (const r of results) {
			if (r.bytes) {
				await $typst.mapShadow(`/${r.key}`, r.bytes);
			} else {
				// Rewrite the unresolved image reference to a placeholder
				const placeholder = `#emph[image: ${escapeMarkup(r.info.alt || r.info.url)}]`;
				body = body.replaceAll(`#image("/${r.key}")`, placeholder);
			}
		}
	}

	const fullSource = PREAMBLE + body + '\n';
	const pdf = await $typst.pdf({ mainContent: fullSource });
	if (!pdf) throw new Error('Typst returned no PDF bytes');
	return pdf;
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
	const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

function decodeDataUri(uri: string): Uint8Array | null {
	const m = /^data:[^;,]+(?:;base64)?,(.*)$/i.exec(uri);
	if (!m) return null;
	const isBase64 = /;base64,/i.test(uri);
	try {
		if (isBase64) {
			const bin = atob(m[1]);
			const out = new Uint8Array(bin.length);
			for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
			return out;
		}
		return new TextEncoder().encode(decodeURIComponent(m[1]));
	} catch {
		return null;
	}
}
