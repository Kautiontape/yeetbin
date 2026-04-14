/**
 * markdown-it plugin for extended Obsidian task states.
 *
 * Adds support for:
 *   - [-] cancelled/dropped task (rendered as a gray dash checkbox)
 *   - [/] in-progress task
 *   - [>] deferred/forwarded task
 *   - [?] question task
 *
 * Must run AFTER markdown-it-task-lists which handles [x] and [ ].
 * Processes remaining list items that start with [X] patterns.
 */
import type MarkdownIt from 'markdown-it';

const TASK_STATE_RE = /^\[([-/>?!*])\]\s*/;

const STATE_CLASSES: Record<string, string> = {
	'-': 'yb-task-cancelled',
	'/': 'yb-task-inprogress',
	'>': 'yb-task-deferred',
	'?': 'yb-task-question',
	'!': 'yb-task-important',
	'*': 'yb-task-star'
};

const STATE_ICONS: Record<string, string> = {
	'-': '\u2796', // heavy minus
	'/': '\uD83D\uDD36', // small orange diamond (in-progress)
	'>': '\u27A1\uFE0F', // right arrow
	'?': '\u2754', // question
	'!': '\u2757', // exclamation
	'*': '\u2B50' // star
};

export function taskStatesPlugin(md: MarkdownIt): void {
	md.core.ruler.after('inline', 'obsidian-task-states', (state) => {
		for (const token of state.tokens) {
			if (token.type !== 'inline') continue;

			const match = token.content.match(TASK_STATE_RE);
			if (!match) continue;

			// Check that this inline is inside a list item
			const parentIdx = state.tokens.indexOf(token);
			if (parentIdx < 1) continue;
			const prev = state.tokens[parentIdx - 1];
			if (prev.type !== 'paragraph_open') continue;
			// Look further back for list_item_open
			const prevPrev = parentIdx >= 2 ? state.tokens[parentIdx - 2] : null;
			if (!prevPrev || prevPrev.type !== 'list_item_open') continue;

			const stateChar = match[1];
			const stateClass = STATE_CLASSES[stateChar] || 'yb-task-other';
			const icon = STATE_ICONS[stateChar] || `[${stateChar}]`;

			// Add class to the list_item_open
			prevPrev.attrJoin('class', `task-list-item ${stateClass}`);

			// Replace the [X] prefix with a styled icon in the inline content
			token.content = token.content.replace(
				TASK_STATE_RE,
				''
			);

			// Prepend icon token
			if (token.children) {
				// Remove the text prefix that has [X]
				for (const child of token.children) {
					if (child.type === 'text') {
						const childMatch = child.content.match(TASK_STATE_RE);
						if (childMatch) {
							child.content = child.content.replace(TASK_STATE_RE, '');
							break;
						}
					}
				}

				// Insert icon as HTML
				const iconToken = new state.Token('html_inline', '', 0);
				iconToken.content = `<span class="yb-task-icon ${stateClass}" aria-label="${stateChar}">${icon}</span> `;
				token.children.unshift(iconToken);
			}
		}
	});
}
