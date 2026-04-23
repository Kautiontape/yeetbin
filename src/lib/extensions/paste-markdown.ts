import { EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { convertHtmlToMarkdown } from '$lib/utils/html-to-markdown';

const HINT_DURATION = 10_000;

export function pasteMarkdownExtension() {
	return Prec.high(
		EditorView.domEventHandlers({
			paste(event, view) {
				const clipboard = event.clipboardData;
				if (!clipboard?.types.includes('text/html')) return false;

				// Skip code editor pastes (VS Code, JetBrains, etc.)
				if (
					clipboard.types.includes('text/vscode-editor-data') ||
					clipboard.types.includes('application/vnd.code.uri-list')
				) {
					return false;
				}

				const html = clipboard.getData('text/html');
				const plain = clipboard.getData('text/plain');
				const markdown = convertHtmlToMarkdown(html);

				// If conversion result matches plain text, the HTML was just decorative wrappers
				if (markdown.trim() === plain.trim()) return false;

				view.dispatch(
					view.state.replaceSelection(markdown),
					{ userEvent: 'input.paste' }
				);

				showPasteHint(view);

				event.preventDefault();
				return true;
			}
		})
	);
}

function showPasteHint(view: EditorView) {
	const existing = view.dom.parentElement?.querySelector('.yb-paste-hint');
	if (existing) {
		existing.remove();
	}

	const hint = document.createElement('div');
	hint.className = 'yb-paste-hint';

	const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
	const shortcut = isMac ? '⇧⌘V' : 'Ctrl+Shift+V';
	hint.textContent = `Rich text converted to Markdown. Use ${shortcut} to paste without formatting.`;

	view.dom.parentElement?.appendChild(hint);

	setTimeout(() => hint.remove(), HINT_DURATION);
}
