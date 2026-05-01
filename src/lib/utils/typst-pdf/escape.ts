// Typst markup-mode special characters. We escape these globally in user text
// to prevent accidental interpretation. Line-leading markers (= - + /) are also
// escaped so paragraph text starting with them doesn't become a heading/list.
const TYPST_INLINE_SPECIAL = /([\\#$~`*_<>@\[\]])/g;
const TYPST_LINE_LEADING = /^([=\-+\/])/gm;

export function escapeMarkup(text: string): string {
	return text
		.replace(TYPST_INLINE_SPECIAL, '\\$1')
		.replace(TYPST_LINE_LEADING, '\\$1');
}

// For embedding inside Typst string literals "..."
// Typst strings support \n, \t, \\, \", \u{XXXX} escapes.
export function escapeString(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\r/g, '')
		.replace(/\n/g, '\\n')
		.replace(/\t/g, '\\t');
}

// Render a raw block via #raw(). Body is passed as a Typst string literal so
// no markup interpretation can touch it.
export function rawBlock(text: string, lang?: string | null): string {
	const langPart = lang ? `, lang: "${escapeString(lang)}"` : '';
	return `#raw(block: true${langPart}, "${escapeString(text)}")`;
}

export function rawInline(text: string): string {
	return `#raw("${escapeString(text)}")`;
}
