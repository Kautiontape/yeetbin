// Service worker: the bridge between the `yeet` CLI and local bins.
//
// The worker keeps a native-messaging port open to the `yeet` binary, which Chrome launches as
// the host (`yeet --install-native-host` registers it). While the port is open the host listens
// on a Unix socket, so `yeet notes.md` lands here instead of on the internet. An open native
// port also keeps an MV3 service worker alive, which is what keeps the socket up.
//
// Host → extension messages are capped at 1 MB, so content arrives as a header followed by
// chunks:
//   {kind:'yeet', req, title, type, language, open, chunks}
//   {kind:'chunk', req, seq, data}            × chunks
// and the reply is {kind:'result', req, id, url} or {kind:'result', req, error}.
import { NATIVE_HOST } from './lib/config';
import { binUrl, createBin } from './lib/store';

interface Pending {
	title: string;
	type: string;
	language: string;
	open: boolean;
	parts: (string | undefined)[];
	received: number;
}

let port: chrome.runtime.Port | null = null;
let lastError: string | null = null;
let quickFailures = 0;
const pending = new Map<number, Pending>();

function connect() {
	if (port) return;
	let p: chrome.runtime.Port;
	try {
		p = chrome.runtime.connectNative(NATIVE_HOST);
	} catch (e) {
		lastError = e instanceof Error ? e.message : String(e);
		return;
	}
	port = p;
	const connectedAt = Date.now();
	p.onMessage.addListener(onMessage);
	p.onDisconnect.addListener(() => {
		lastError = chrome.runtime.lastError?.message ?? 'disconnected';
		if (port === p) port = null;
		pending.clear();
		// A missing host stays missing until it's installed; the alarm below retries then.
		if (/not found|forbidden/i.test(lastError)) return;
		// Otherwise (the host crashed, a new binary was installed) retry soon, backing off
		// when the host keeps dying at startup so a broken install doesn't spawn a process
		// every two seconds. Past a minute the alarm takes over.
		quickFailures = Date.now() - connectedAt < 5000 ? quickFailures + 1 : 0;
		const delay = 2000 * 2 ** quickFailures;
		if (delay < 60_000) setTimeout(connect, delay);
	});
	p.postMessage({ kind: 'hello', version: chrome.runtime.getManifest().version });
	lastError = null;
}

function reply(message: Record<string, unknown>) {
	try {
		port?.postMessage({ kind: 'result', ...message });
	} catch {
		// The port died mid-request; the CLI times out and says so.
	}
}

async function finish(req: number, p: Pending) {
	try {
		const bin = await createBin({
			content: p.parts.join(''),
			type: p.type,
			language: p.language || null,
			title: p.title,
			source: 'cli'
		});
		const url = chrome.runtime.getURL(binUrl(bin.id));
		if (p.open) {
			const tab = await chrome.tabs.create({ url, active: true });
			chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
		}
		reply({ req, id: bin.id, url });
	} catch (e) {
		reply({ req, error: e instanceof Error ? e.message : String(e) });
	}
}

function onMessage(msg: any) {
	if (!msg || typeof msg.req !== 'number') return;
	if (msg.kind === 'yeet') {
		const chunks = Number(msg.chunks);
		if (!Number.isInteger(chunks) || chunks < 1) {
			reply({ req: msg.req, error: 'bad chunk count' });
			return;
		}
		pending.set(msg.req, {
			title: String(msg.title ?? ''),
			type: String(msg.type ?? 'markdown'),
			language: String(msg.language ?? ''),
			open: !!msg.open,
			parts: new Array(chunks),
			received: 0
		});
	} else if (msg.kind === 'chunk') {
		const p = pending.get(msg.req);
		const seq = Number(msg.seq);
		if (!p || !Number.isInteger(seq) || seq < 0 || seq >= p.parts.length) return;
		if (p.parts[seq] === undefined) p.received++;
		p.parts[seq] = String(msg.data ?? '');
		if (p.received === p.parts.length) {
			pending.delete(msg.req);
			finish(msg.req, p);
		}
	}
}

// Pages ask whether the CLI bridge is up, to show setup hints.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (msg?.kind !== 'status') return;
	connect();
	// connectNative fails asynchronously, so give a fresh attempt a moment to settle.
	setTimeout(() => sendResponse({ connected: port !== null, error: lastError }), 300);
	return true;
});

chrome.action.onClicked.addListener(() => {
	chrome.tabs.create({ url: chrome.runtime.getURL('index.html#/') });
});

// Wakes the worker after it was allowed to stop (no host installed yet) and reconnects.
chrome.alarms.create('yeet-reconnect', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === 'yeet-reconnect') connect();
});
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();
