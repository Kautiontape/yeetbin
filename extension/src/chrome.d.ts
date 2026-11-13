// The few extension APIs this code calls, declared by hand to avoid adding @types/chrome to the
// web app's dependencies.
declare namespace chrome {
	namespace runtime {
		interface Port {
			name: string;
			postMessage(message: unknown): void;
			disconnect(): void;
			onMessage: { addListener(cb: (message: any, port: Port) => void): void };
			onDisconnect: { addListener(cb: (port: Port) => void): void };
		}
		const lastError: { message?: string } | undefined;
		const id: string;
		function connectNative(application: string): Port;
		function getURL(path: string): string;
		function getManifest(): { version: string };
		function sendMessage(message: unknown): Promise<any>;
		const onMessage: {
			addListener(
				cb: (message: any, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void
			): void;
		};
		const onStartup: { addListener(cb: () => void): void };
		const onInstalled: { addListener(cb: () => void): void };
	}
	namespace tabs {
		interface Tab {
			id?: number;
			windowId: number;
		}
		function create(props: { url: string; active?: boolean }): Promise<Tab>;
	}
	namespace windows {
		function update(windowId: number, info: { focused?: boolean }): Promise<unknown>;
	}
	namespace action {
		const onClicked: { addListener(cb: () => void): void };
	}
	namespace alarms {
		interface Alarm {
			name: string;
		}
		function create(name: string, info: { periodInMinutes?: number; delayInMinutes?: number }): void;
		const onAlarm: { addListener(cb: (alarm: Alarm) => void): void };
	}
}
