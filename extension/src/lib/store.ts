// Local bins live in IndexedDB in the extension's origin, shared by the pages and the
// service worker. Nothing here leaves the machine.
import { CONTENT_TYPES } from './config';

export interface Publication {
	url: string;
	id: string;
	at: string;
	burn: boolean;
	encrypted: boolean;
	password: boolean;
	expires_at: string | null;
}

export interface LocalBin {
	id: string;
	content: string;
	type: string;
	language: string | null;
	title: string;
	source: 'cli' | 'editor' | 'paste' | 'drop';
	created_at: string;
	updated_at: string;
	published: Publication[];
}

const DB_NAME = 'yeetbin-local';
const STORE = 'bins';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	dbPromise ??= new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
			store.createIndex('created_at', 'created_at');
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => {
			dbPromise = null;
			reject(req.error);
		};
	});
	return dbPromise;
}

async function run<T>(
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, mode);
		const req = fn(tx.objectStore(STORE));
		tx.oncomplete = () => resolve(req.result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

const ID_ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

export function newId(length = 8): string {
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

/** A title for a bin that came without a file name: its first heading or first line. */
export function deriveTitle(content: string): string {
	const lines = content.split('\n').map((l) => l.trim());
	const heading = lines.find((l) => /^#{1,6}\s+\S/.test(l));
	const line = heading ?? lines.find((l) => l.length > 0) ?? 'Untitled';
	const clean = line.replace(/^#{1,6}\s+/, '');
	return clean.length > 80 ? clean.slice(0, 79) + '…' : clean;
}

export function normaliseType(type: unknown): string {
	return typeof type === 'string' && (CONTENT_TYPES as readonly string[]).includes(type)
		? type
		: 'markdown';
}

export async function createBin(fields: {
	content: string;
	type?: string;
	language?: string | null;
	title?: string;
	source: LocalBin['source'];
}): Promise<LocalBin> {
	const now = new Date().toISOString();
	const type = normaliseType(fields.type);
	const bin: LocalBin = {
		id: newId(),
		content: fields.content,
		type,
		language: type === 'code' ? fields.language || 'text' : null,
		title: fields.title?.trim() || deriveTitle(fields.content),
		source: fields.source,
		created_at: now,
		updated_at: now,
		published: []
	};
	await run('readwrite', (s) => s.add(bin));
	return bin;
}

export function getBin(id: string): Promise<LocalBin | undefined> {
	return run('readonly', (s) => s.get(id) as IDBRequest<LocalBin | undefined>);
}

export async function listBins(): Promise<LocalBin[]> {
	const all = await run('readonly', (s) => s.getAll() as IDBRequest<LocalBin[]>);
	return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function addPublication(id: string, pub: Publication): Promise<LocalBin | undefined> {
	const bin = await getBin(id);
	if (!bin) return undefined;
	bin.published = [...bin.published, pub];
	bin.updated_at = new Date().toISOString();
	await run('readwrite', (s) => s.put(bin));
	return bin;
}

export async function deleteBin(id: string): Promise<void> {
	await run('readwrite', (s) => s.delete(id));
}

export function binUrl(id: string): string {
	return `index.html#/b/${id}`;
}
