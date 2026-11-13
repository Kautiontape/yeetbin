// Builds the local-yeetbin browser extension into extension/dist. Run from the repo root:
//   pnpm build:extension
// The pages import the web app's own components, renderer and stylesheet from src/lib (through
// the package.json "#lib" subpath import, which Vite resolves natively), so a local render looks
// exactly like a published bin.
import { fileURLToPath } from 'node:url';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
	root: here('.'),
	base: './',
	publicDir: here('public'),
	plugins: [tailwindcss(), svelte({ configFile: false, preprocess: vitePreprocess() })],
	resolve: {
		alias: {
			// The only SvelteKit module src/lib touches outside src/lib/server.
			'$app/env': here('src/app-env.ts')
		}
	},
	build: {
		outDir: here('dist'),
		emptyOutDir: true,
		// Mermaid and Shiki are big; this is a local extension, not a page load.
		chunkSizeWarningLimit: 8000,
		modulePreload: { polyfill: false },
		rolldownOptions: {
			input: {
				index: here('index.html'),
				background: here('src/background.ts')
			},
			output: {
				// The manifest names the service worker, so its file name must be stable.
				entryFileNames: (chunk) =>
					chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'
			}
		}
	}
});
