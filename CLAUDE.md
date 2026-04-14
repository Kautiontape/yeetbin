# yeetbin

Self-hosted, open-source content-sharing tool. Paste markdown, code, diagrams, or text and get a shareable link.

## Development

```bash
pnpm dev        # Start dev server on :5173
pnpm build      # Build for production
pnpm preview    # Preview production build
pnpm check      # TypeScript check
```

## Database

SQLite via Drizzle ORM. Database file at `./data/yeetbin.db`.

```bash
pnpm db:push      # Push schema to database
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Run migrations
```

## Stack

- SvelteKit + TypeScript + Tailwind CSS 4
- SQLite via Drizzle ORM + better-sqlite3
- CodeMirror 6 (editor)
- markdown-it (rendering)
- Docker + nginx (deployment on ktn, port 8108)

## Architecture

- Content type registry at `src/lib/content-types/registry.ts`
- Server-only code in `src/lib/server/`
- SSR markdown rendering for reader views
- API at `/api/bin/` for programmatic access
