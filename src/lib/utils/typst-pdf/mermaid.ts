// Render a mermaid diagram source to an SVG string, using the same library
// the screen renderer uses. We theme it light so it composes with the PDF's
// white page background.

let initialized = false;
let mermaidLib: typeof import('mermaid').default | null = null;

async function getMermaid() {
	if (mermaidLib && initialized) return mermaidLib;
	mermaidLib = (await import('mermaid')).default;
	mermaidLib.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
	initialized = true;
	return mermaidLib;
}

export async function renderMermaidToSvg(id: string, source: string): Promise<string> {
	const mermaid = await getMermaid();
	try {
		const { svg } = await mermaid.render(`pdf-${id}-${Math.random().toString(36).slice(2)}`, source);
		return svg;
	} catch {
		// Fallback: emit a tiny SVG containing the source text so the PDF still
		// compiles instead of failing.
		return fallbackSvg(source);
	}
}

function fallbackSvg(source: string): string {
	const escaped = source
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 80" width="600" height="80">` +
		`<rect width="100%" height="100%" fill="#f3f4f6"/>` +
		`<text x="10" y="20" font-family="monospace" font-size="11" fill="#6b7280">[mermaid: failed to render]</text>` +
		`<text x="10" y="40" font-family="monospace" font-size="10" fill="#374151">${escaped.slice(0, 100)}</text>` +
		`</svg>`
	);
}
