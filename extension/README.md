# yeetbin (local)

A browser extension that renders markdown, code, Mermaid and text with yeetbin's own
renderer, entirely in the browser. Bins are kept in the extension's IndexedDB. Nothing is
uploaded until you press **Publish** on a bin, which posts it to
`https://yeet.kautiontape.com` with the same options as the web editor (expiry, burn,
encrypt, password, mode).

It works in Vivaldi, Chromium, Chrome and Brave (Manifest V3).

## Build

From the repo root:

```sh
pnpm build:extension     # → extension/dist
```

The pages import the web app's components, stylesheet and server renderer from `src/lib`,
so a local bin renders like a published one, Shiki highlighting included. Rebuild after
changing anything in `src/lib` or `src/app.css`, then press reload on the extension.

## Install

1. Open `vivaldi://extensions` (or `chrome://extensions`) and turn on Developer mode.
2. Click **Load unpacked** and pick `extension/dist`.

The manifest's `key` pins the extension ID to `dbkggnlfieppdhhcblaegcohnenmilbd`, and the
CLI's native host manifest allows only that ID. Keep the key as it is.

## Getting content in

- **Paste** anywhere on the extension's home page, or **drop** a file on it. Click the
  toolbar icon to open the home page.
- Use **New** for the full editor. **Save locally** stores the bin.
- Run **`yeet notes.md`** from a terminal. This needs the CLI's native host, set up once
  with `yeet --install-native-host` (see
  [yeetbin-app](https://github.com/Kautiontape/yeetbin-app#local-yeetbin)). The home page
  says whether the CLI bridge is connected.

## How the CLI bridge works

The service worker keeps a native messaging port open to `com.kautiontape.yeetbin`, which
the browser runs as `yeet chrome-extension://…/`. While that port is open, `yeet` listens on
`$XDG_RUNTIME_DIR/yeet/local.sock`, and a CLI yeet travels over that socket. Chrome caps a
host-to-browser message at 1 MB, so the content arrives as a header and then chunks of at
most 128 KiB (see `src/background.ts`). The extension stores the bin, opens a tab if the CLI
asked for one, and replies with the `chrome-extension://` URL.

## Known differences from the web app

- No Download PDF: the Typst engine is a 28 MB WASM module. Print still works.
- No edit, fork, password, burn or expiry for local bins. Those options exist only when
  you publish.

## Matching the website

- Build against the same dependencies the site deploys with. If `git pull` brings new
  lockfile changes, reinstall and rebuild, or the local look drifts (a Tailwind bump once
  changed the default font stack).
- Chromium styles every extension page with `body { font-size: 75% }` and its UI font.
  `src/app.css` undoes that. Without it, local bins render at 12px.
