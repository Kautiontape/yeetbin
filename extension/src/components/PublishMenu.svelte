<script lang="ts">
	// The web editor's publish bar, folded into a dropdown: same options, same API call, aimed
	// at the public instance instead of a relative /api/bin.
	import { encrypt } from '#lib/utils/crypto.js';
	import { PUBLIC_URL } from '../lib/config';
	import { addPublication, type LocalBin } from '../lib/store';

	interface Props {
		bin: LocalBin;
		onpublished: (bin: LocalBin, url: string) => void;
	}

	let { bin, onpublished }: Props = $props();

	const host = new URL(PUBLIC_URL).host;

	let open = $state(false);
	let selectedMode = $state<'read-only' | 'editable' | 'forkable'>('read-only');
	let expiry = $state('');
	let burn = $state(false);
	let encrypted = $state(false);
	let showPassword = $state(false);
	let password = $state('');
	let publishing = $state(false);
	let error = $state('');
	let containerEl: HTMLDivElement;

	$effect(() => {
		if (encrypted) selectedMode = 'read-only';
	});

	function computeExpiresAt(): string | null {
		if (!expiry) return null;
		const ms: Record<string, number> = {
			'1h': 3600000,
			'24h': 86400000,
			'7d': 604800000,
			'30d': 2592000000
		};
		return new Date(Date.now() + (ms[expiry] || 0)).toISOString();
	}

	async function publish() {
		if (publishing) return;
		publishing = true;
		error = '';
		try {
			let content = bin.content;
			let key = '';
			if (encrypted) {
				const result = await encrypt(bin.content);
				content = result.ciphertext;
				key = result.key;
			}
			const expiresAt = computeExpiresAt();
			const usePassword = showPassword && password.length > 0;

			let res: Response;
			try {
				res = await fetch(`${PUBLIC_URL}/api/bin`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						content,
						type: bin.type,
						language: bin.type === 'code' ? bin.language : null,
						mode: encrypted ? 'read-only' : selectedMode,
						encrypted,
						burn,
						expires_at: expiresAt,
						password: usePassword ? password : null
					})
				});
			} catch {
				error = `Couldn't reach ${host}`;
				return;
			}

			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data.id) {
				error = data.error || `Publish failed (${res.status})`;
				return;
			}

			const url = `${PUBLIC_URL}/${data.id}${encrypted ? `#key=${key}` : ''}`;
			const updated = await addPublication(bin.id, {
				url,
				id: data.id,
				at: new Date().toISOString(),
				burn,
				encrypted,
				password: usePassword,
				expires_at: expiresAt
			});
			password = '';
			open = false;
			if (updated) onpublished(updated, url);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to publish';
		} finally {
			publishing = false;
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (open && containerEl && !containerEl.contains(e.target as Node)) open = false;
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div bind:this={containerEl} class="relative inline-flex">
	<button
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
		class="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5"
	>
		Publish
		<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 mt-1 w-72 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg z-20 p-3 space-y-3 text-sm"
		>
			<p class="text-xs text-neutral-500">
				Uploads this bin to <span class="font-medium text-neutral-700 dark:text-neutral-300">{host}</span>.
				The local copy stays here.
			</p>

			<div class="grid grid-cols-2 gap-2">
				<select
					bind:value={selectedMode}
					disabled={encrypted}
					class="px-2 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="read-only">Read-only</option>
					<option value="editable">Editable</option>
					<option value="forkable">Forkable</option>
				</select>
				<select
					bind:value={expiry}
					class="px-2 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="">Permanent</option>
					<option value="1h">1 hour</option>
					<option value="24h">24 hours</option>
					<option value="7d">7 days</option>
					<option value="30d">30 days</option>
				</select>
			</div>

			<div class="flex items-center gap-3">
				<label
					class="flex items-center gap-1.5 text-neutral-500 cursor-pointer"
					title="Burn after reading: the content stays hidden until someone opens it, then it's deleted from the server."
				>
					<input type="checkbox" bind:checked={burn} class="rounded" />
					Burn
				</label>
				<label class="flex items-center gap-1.5 text-neutral-500 cursor-pointer">
					<input type="checkbox" bind:checked={encrypted} class="rounded" />
					Encrypt
				</label>
				<label class="flex items-center gap-1.5 text-neutral-500 cursor-pointer">
					<input type="checkbox" bind:checked={showPassword} class="rounded" />
					Password
				</label>
			</div>

			{#if showPassword}
				<input
					type="password"
					bind:value={password}
					placeholder="Set password..."
					class="w-full px-2 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			{/if}

			{#if error}
				<p class="text-red-500">{error}</p>
			{/if}

			<button
				onclick={publish}
				disabled={publishing}
				class="w-full px-4 py-2 font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
			>
				{publishing ? 'Publishing...' : `Publish to ${host}`}
			</button>
		</div>
	{/if}
</div>
