export interface DetectedType {
	type: string;
	language?: string;
}

// Maps a file extension to a code language supported by the `code` content type.
const codeLanguages: Record<string, string> = {
	js: 'javascript',
	mjs: 'javascript',
	cjs: 'javascript',
	jsx: 'javascript',
	ts: 'typescript',
	tsx: 'typescript',
	py: 'python',
	html: 'html',
	htm: 'html',
	css: 'css',
	json: 'json',
	sh: 'bash',
	bash: 'bash',
	rs: 'rust',
	go: 'go',
	sql: 'sql'
};

// Extensions that map directly to a non-code content type.
const directTypes: Record<string, string> = {
	md: 'markdown',
	markdown: 'markdown',
	mmd: 'mermaid',
	mermaid: 'mermaid',
	txt: 'text'
};

/**
 * Detect the editor content type (and code language) from a file name's extension.
 * Unrecognized or extensionless files fall back to plain text.
 */
export function detectFromFilename(name: string): DetectedType {
	const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';

	if (ext in directTypes) {
		return { type: directTypes[ext] };
	}
	if (ext in codeLanguages) {
		return { type: 'code', language: codeLanguages[ext] };
	}
	return { type: 'text' };
}
