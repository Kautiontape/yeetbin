// The server's renderer is isomorphic: markdown-it, the yeetbin plugins and Shiki, with no Node
// APIs. Importing it (rather than the lighter client-render used by the editor preview) means a
// local bin renders with the same HTML a published bin gets from SSR, fenced-code highlighting
// included. If src/lib/server/render.ts ever grows a Node dependency, this build fails loudly.
export { serverRenderContent as renderContent } from '#lib/server/render.js';
