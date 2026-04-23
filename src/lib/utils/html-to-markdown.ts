import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

let service: TurndownService | null = null;

function getService(): TurndownService {
	if (service) return service;

	service = new TurndownService({
		headingStyle: 'atx',
		codeBlockStyle: 'fenced',
		bulletListMarker: '-',
		emDelimiter: '*',
		strongDelimiter: '**',
		hr: '---'
	});

	service.use(gfm);

	// Convert <mark> to ==highlight== (matches markdown-it-mark)
	service.addRule('mark', {
		filter: 'mark',
		replacement(content) {
			return `==${content}==`;
		}
	});

	return service;
}

export function convertHtmlToMarkdown(html: string): string {
	return getService().turndown(html);
}
