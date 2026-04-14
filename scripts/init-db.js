import Database from 'better-sqlite3';

const dbPath = process.env.DATABASE_URL || '/data/yeetbin.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS bins (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'markdown',
    language TEXT,
    mode TEXT NOT NULL DEFAULT 'read-only',
    password TEXT,
    encrypted INTEGER NOT NULL DEFAULT 0,
    forked_from TEXT,
    expires_at TEXT,
    burn INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

console.log('[init-db] Database ready at', dbPath);
db.close();
