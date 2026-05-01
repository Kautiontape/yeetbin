import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
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
