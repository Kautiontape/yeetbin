const MAX_SLUG_LEN = 60;

function slugify(input: string): string {
	return input
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{Diacritic}/gu, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_SLUG_LEN)
		.replace(/-+$/, '');
}

export function inferPdfFilename(
	content: string | null | undefined,
	fallback: string
): string {
	const fallbackName = `${fallback}.pdf`;
	if (!content) return fallbackName;

	const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
	if (!lines.length) return fallbackName;

	let candidate = lines[0];
	const heading = content.match(/^#+\s+(.+?)\s*$/m);
	if (heading) candidate = heading[1];

	candidate = candidate.replace(/[*_`~\[\]()]/g, '');

	const slug = slugify(candidate);
	return slug ? `${slug}.pdf` : fallbackName;
}
