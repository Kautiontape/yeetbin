# yeetbin — Product Specification

> A self-hosted, open-source bin for yeeting notes, code, diagrams, and anything else into shareable links with beautiful rendering.

## Vision

yeetbin is what yeet.md would be if it were open-source and self-hosted. Paste Obsidian-flavored markdown, code, Mermaid diagrams, or plain text — get a permanent, shareable link with gorgeous rendering. Recipients see rendered output by default, can toggle to source, fork into their own version, or export as PDF/HTML/Rich Text. Optional encryption covers PrivateBin's use case too.

## Core Concepts

### Bins
A **bin** is a single piece of content with metadata:
- **Content** — the raw text (markdown, code, mermaid, plain text, etc.)
- **Type** — content type, selected manually by creator (markdown, code, mermaid, text)
- **ID** — random short alphanumeric slug (e.g. `x7kQ3f`)
- **Mode** — one of: `read-only`, `editable`, `forkable`
- **Expiry** — permanent (default), timed (1h/24h/7d/30d), or burn-after-reading
- **Password** — optional, for access control
- **Encrypted** — optional client-side zero-knowledge encryption
- **Forked from** — optional link to parent bin (no ongoing sync)
- **Created at** / **Updated at** timestamps

### Content Types (Extensible Registry)
The system uses a plugin registry for content types. Each type provides:
- An **editor component** (what the creator types into)
- A **renderer component** (what the reader sees)
- A **language identifier** (for code types: python, javascript, etc.)

**Initial types:**
| Type | Editor | Renderer |
|------|--------|----------|
| Markdown | CodeMirror with markdown mode | Obsidian-flavored markdown renderer |
| Code | CodeMirror with language modes | Syntax-highlighted code (Shiki) |
| Mermaid | CodeMirror with mermaid hints | Live Mermaid diagram |
| Plain Text | CodeMirror, no highlighting | Monospace preformatted text |

Adding a new type = adding an editor+renderer pair and registering it. No core changes needed.

### Modes
- **Read-only** — viewers can see content but not modify it. Can fork.
- **Editable** — anyone with the link can edit and save (last-write-wins, no conflict resolution).
- **Forkable** — viewers cannot edit the original but can create a new bin from it. The fork has a `forked_from` field pointing to the original.

### Encryption
- Optional toggle at publish time
- Content encrypted in the browser using AES-256-GCM before sending to server
- Encryption key is in the URL fragment (`#key=...`), never sent to server
- Server stores only ciphertext — zero-knowledge
- Encrypted bins are always **read-only** (server can't serve decrypted content for editing)
- Covers PrivateBin's core use case

## User Flows

### Creator Flow
1. Visit `yeet.kautiontape.com` — lands on editor
2. Select content type from dropdown (default: markdown)
3. Write or paste content in editor
4. Toggle preview to see rendered output
5. Set options: mode (read-only/editable/forkable), expiry, password, encryption
6. Click **Publish** — get shareable link
7. Link is copied to clipboard automatically

### Reader Flow
1. Open shared link — sees beautifully rendered content (SSR, instant load)
2. If password-protected: prompted for password first
3. If encrypted: decryption happens client-side using URL fragment key
4. Toggle **Source** to see raw content
5. If bin is editable: **Edit** button opens editor with current content
6. If bin is forkable: **Fork** button creates new bin pre-filled with content
7. Export via: **Print/PDF** (browser print + server PDF via bentopdf), **Copy HTML**, **Copy Rich Text**

### Fork Flow
1. Reader clicks **Fork** on a forkable (or read-only) bin
2. New editor opens with content pre-filled
3. Creator modifies and publishes as a new bin
4. New bin has `forked_from` pointing to original
5. Original bin is unaffected

## Markdown Rendering (Obsidian-Flavored)

Must support:
- Standard CommonMark + GFM (tables, task lists, strikethrough)
- **Callouts** — `> [!note]`, `> [!warning]`, etc. with Obsidian styling
- **Highlights** — `==highlighted text==`
- **KaTeX** — inline `$...$` and display `$$...$$` math
- **Mermaid** — fenced code blocks with `mermaid` language tag
- **Syntax highlighting** — fenced code blocks with language tags
- **Wikilinks display** — `[[Page Name]]` rendered as styled text (not clickable links, since there's no vault)
- **Embedded content** — YouTube embeds, image URLs rendered inline

## Export Features

- **Print to PDF** — clean `@media print` stylesheet for Ctrl+P, plus "Download PDF" button that calls bentopdf (already running at pdf.kautiontape.com, port 8107)
- **Copy as HTML** — copies rendered HTML to clipboard
- **Copy as Rich Text** — copies rendered content as rich text (paste into Google Docs, email, etc.)
- **Copy Source** — copies raw markdown/code to clipboard

## UI Design

### Principles
- Minimal chrome, content is the focus
- Dark/light theme toggle (respect system preference, persist choice)
- Responsive — works on mobile (stacked layout)

### Editor View
```
+---------------------------------------+
| [yeetbin]   [New] [Type: MD v]  [moon]|
+---------------------------------------+
|                                       |
|   Editor (CodeMirror)                 |
|   or                                  |
|   Preview (rendered)                  |
|   [Toggle: Edit | Preview]            |
|                                       |
+---------------------------------------+
| Mode: [RO v] Expiry: [Never v]       |
| [ ] Password  [ ] Encrypt            |
|                            [Publish]  |
+---------------------------------------+
```

### Reader View
```
+---------------------------------------+
| [yeetbin]  [Edit/Fork] [Source] [...]|
+---------------------------------------+
|                                       |
|   Beautiful rendered content          |
|   Full-width, reading-optimized      |
|                                       |
+---------------------------------------+
| [...] menu: PDF | Copy HTML | Copy RT |
+---------------------------------------+
```

### Mobile
- Single column, all controls accessible
- Editor/preview toggle (no split pane on any device)

## Technical Architecture

### Stack
- **Frontend**: SvelteKit + TypeScript
- **Backend**: SvelteKit server routes (API)
- **Database**: SQLite (via Drizzle ORM or better-sqlite3)
- **Rendering**: Server-side (SSR) with client hydration
- **Editor**: CodeMirror 6
- **Markdown**: markdown-it + plugins (callouts, highlight, KaTeX, Mermaid)
- **Code highlighting**: Shiki
- **Diagrams**: Mermaid.js
- **Encryption**: Web Crypto API (AES-256-GCM)
- **PDF**: Browser print + bentopdf integration

### API Endpoints
```
POST   /api/bin              Create bin
GET    /api/bin/:id          Fetch bin (JSON)
PUT    /api/bin/:id          Update bin (if editable)
POST   /api/bin/:id/fork     Fork bin
DELETE /api/bin/:id          Delete bin (admin/creator)
```

### Database Schema
```sql
CREATE TABLE bins (
  id          TEXT PRIMARY KEY,     -- random short ID
  content     TEXT NOT NULL,        -- raw content (or ciphertext if encrypted)
  type        TEXT NOT NULL,        -- 'markdown' | 'code' | 'mermaid' | 'text'
  language    TEXT,                 -- for code type: 'python', 'javascript', etc.
  mode        TEXT NOT NULL,        -- 'read-only' | 'editable' | 'forkable'
  password    TEXT,                 -- bcrypt hash, nullable
  encrypted   INTEGER DEFAULT 0,   -- boolean: client-side encrypted
  forked_from TEXT,                 -- parent bin ID, nullable
  expires_at  TEXT,                 -- ISO timestamp, nullable (null = permanent)
  burn        INTEGER DEFAULT 0,   -- boolean: delete after first view
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
```

### ID Generation
- 6-8 character alphanumeric (a-zA-Z0-9)
- Generated server-side with collision check
- Short enough for easy sharing, long enough for uniqueness at hobby scale

### Expiry & Cleanup
- Cron job (or SvelteKit scheduled task) runs periodically
- Deletes bins where `expires_at < now()`
- Burn-after-reading: bin deleted on first `GET /api/bin/:id` (after serving content)

## Deployment

- **Domain**: `yeet.kautiontape.com`
- **Port**: 8108
- **Container**: Single Docker image (Node.js alpine + SQLite)
- **Reverse proxy**: nginx on ktn host
- **SSL**: Cloudflare (wildcard already configured)
- **CI/CD**: GitHub Actions with self-hosted runner on ktn
- **Repo**: `Kautiontape/yeetbin` on GitHub
- **Data**: SQLite file in a Docker volume for persistence

## Build Phases

### Phase 1: Full Loop MVP
- SvelteKit project scaffold with Docker
- SQLite database with bins table
- Create bin → publish → view → source toggle
- Basic markdown rendering (CommonMark + GFM, no Obsidian extensions yet)
- Random ID generation
- Read-only mode only
- Dark/light theme

### Phase 2: Obsidian Rendering
- Callouts, highlights, KaTeX, Mermaid in fenced blocks
- Wikilinks display
- Print stylesheet

### Phase 3: Modes & Collaboration
- Editable and forkable modes
- Fork flow with `forked_from` tracking
- Password protection

### Phase 4: Content Types
- Code type with Shiki highlighting + language selector
- Mermaid type with dedicated diagram renderer
- Plain text type
- Type registry architecture

### Phase 5: Expiry & Encryption
- Optional expiry (1h/24h/7d/30d)
- Burn-after-reading
- Client-side encryption (AES-256-GCM, key in URL fragment)

### Phase 6: Export & Polish
- Copy as HTML, Copy as Rich Text
- PDF download via bentopdf integration
- Mobile responsive polish
- Error handling, rate limiting, input size limits

### Phase 7: Deployment & Open Source
- Dockerfile + docker-compose.yml
- GitHub Actions deploy workflow
- nginx vhost config
- README, LICENSE (MIT), contributing guide
- Deploy to yeet.kautiontape.com
