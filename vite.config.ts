import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess(),
			// No paths.origin on purpose: production never set ORIGIN, so adapter-node derives
			// the origin from the Host header (https by default), which is what nginx on ktn
			// forwards. Pinning it here would break CSRF checks for any other hostname.
			adapter: adapter({ out: 'build' })
		})
	],
	// The Typst WASM compiler is large (~28MB) and only loaded on demand from
	// DownloadPdfButton. Excluding it from dep optimization stops Vite from
	// trying to pre-bundle it during dev startup.
	optimizeDeps: {
		exclude: [
			'@myriaddreamin/typst.ts',
			'@myriaddreamin/typst-ts-web-compiler',
			'@myriaddreamin/typst-ts-renderer'
		]
	},
	assetsInclude: ['**/*.wasm']
});
