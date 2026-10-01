<script module lang="ts">
	/**
	 * Mark a rendered Mermaid container as openable in the lightbox: it gets a
	 * zoom-in cursor and becomes focusable so Enter/Space can open it too.
	 * ContentPreview delegates the actual click/key handling.
	 */
	export function markExpandable(el: HTMLElement): void {
		el.classList.add('yb-mermaid-expandable');
		el.setAttribute('role', 'button');
		el.setAttribute('tabindex', '0');
		el.setAttribute('aria-label', 'Open diagram viewer');
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		source: SVGSVGElement;
		onclose: () => void;
	}

	let { source, onclose }: Props = $props();

	const MIN_SCALE = 0.05;
	const MAX_SCALE = 10;
	const MAX_FIT_SCALE = 2;
	const FIT_PADDING = 32;
	// Always keep this many px of the diagram on screen so it can't be lost
	const KEEP_VISIBLE = 64;

	let dialogEl: HTMLDialogElement;
	let frameEl: HTMLDivElement;
	let viewportEl: HTMLDivElement;
	let stageEl: HTMLDivElement;

	let scale = $state(1);
	let x = $state(0);
	let y = $state(0);
	let dragging = $state(false);
	let fullscreen = $state(false);
	let canFullscreen = $state(false);

	let svg = $state<SVGSVGElement>();
	let naturalWidth = 0;
	let naturalHeight = 0;
	let returnFocus: HTMLElement | null = null;

	// The clone keeps Mermaid's id: its embedded <style> is scoped to `#mermaid-…`.
	// Sizing is done through width/height rather than a CSS scale() so the
	// browser re-renders the vectors crisply at every zoom level.
	function cloneDiagram(src: SVGSVGElement): SVGSVGElement {
		const vb = src.viewBox?.baseVal;
		if (vb && vb.width && vb.height) {
			naturalWidth = vb.width;
			naturalHeight = vb.height;
		} else {
			const rect = src.getBoundingClientRect();
			naturalWidth = rect.width || 300;
			naturalHeight = rect.height || 150;
		}

		const clone = src.cloneNode(true) as SVGSVGElement;
		clone.removeAttribute('width');
		clone.removeAttribute('height');
		clone.style.removeProperty('max-width');
		clone.style.maxWidth = 'none';
		clone.style.display = 'block';
		return clone;
	}

	function clampX(nx: number, s: number) {
		const vw = viewportEl.clientWidth;
		return Math.min(vw - KEEP_VISIBLE, Math.max(KEEP_VISIBLE - naturalWidth * s, nx));
	}

	function clampY(ny: number, s: number) {
		const vh = viewportEl.clientHeight;
		return Math.min(vh - KEEP_VISIBLE, Math.max(KEEP_VISIBLE - naturalHeight * s, ny));
	}

	function setView(nx: number, ny: number, ns: number) {
		scale = ns;
		x = clampX(nx, ns);
		y = clampY(ny, ns);
	}

	/** Zoom by `factor`, keeping the viewport point (px, py) fixed under the cursor. */
	function zoomAt(factor: number, px: number, py: number) {
		const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
		const ratio = ns / scale;
		setView(px - (px - x) * ratio, py - (py - y) * ratio, ns);
	}

	function zoomAtCenter(factor: number) {
		zoomAt(factor, viewportEl.clientWidth / 2, viewportEl.clientHeight / 2);
	}

	function centerAt(s: number) {
		const vw = viewportEl.clientWidth;
		const vh = viewportEl.clientHeight;
		setView((vw - naturalWidth * s) / 2, (vh - naturalHeight * s) / 2, s);
	}

	function fit() {
		const vw = viewportEl.clientWidth - FIT_PADDING * 2;
		const vh = viewportEl.clientHeight - FIT_PADDING * 2;
		const s = Math.min(vw / naturalWidth, vh / naturalHeight, MAX_FIT_SCALE);
		centerAt(Math.max(MIN_SCALE, s));
	}

	function actualSize() {
		centerAt(1);
	}

	async function toggleFullscreen() {
		if (document.fullscreenElement) {
			await document.exitFullscreen();
		} else {
			await frameEl.requestFullscreen().catch(() => {});
		}
	}

	function close() {
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
		dialogEl.close();
	}

	// --- Pointer handling: one pointer pans, two pointers pinch-zoom ---

	const pointers = new Map<number, { x: number; y: number }>();
	let pinchDistance = 0;
	let pinchMid = { x: 0, y: 0 };

	function localPoint(e: { clientX: number; clientY: number }) {
		const rect = viewportEl.getBoundingClientRect();
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
	}

	function pinchState() {
		const [a, b] = [...pointers.values()];
		return {
			distance: Math.hypot(a.x - b.x, a.y - b.y),
			mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
		};
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		viewportEl.setPointerCapture(e.pointerId);
		pointers.set(e.pointerId, localPoint(e));
		dragging = true;
		if (pointers.size === 2) {
			({ distance: pinchDistance, mid: pinchMid } = pinchState());
		}
	}

	function onPointerMove(e: PointerEvent) {
		const prev = pointers.get(e.pointerId);
		if (!prev) return;
		const point = localPoint(e);
		pointers.set(e.pointerId, point);

		if (pointers.size === 1) {
			setView(x + point.x - prev.x, y + point.y - prev.y, scale);
		} else if (pointers.size === 2) {
			const { distance, mid } = pinchState();
			if (pinchDistance > 0) {
				// Pan with the midpoint, then zoom around it
				x += mid.x - pinchMid.x;
				y += mid.y - pinchMid.y;
				zoomAt(distance / pinchDistance, mid.x, mid.y);
			}
			pinchDistance = distance;
			pinchMid = mid;
		}
	}

	function onPointerUp(e: PointerEvent) {
		pointers.delete(e.pointerId);
		if (pointers.size < 2) pinchDistance = 0;
		if (pointers.size === 0) dragging = false;
	}

	function onDoubleClick(e: MouseEvent) {
		const p = localPoint(e);
		zoomAt(2, p.x, p.y);
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		let delta = e.deltaY;
		if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 33;
		else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= 800;
		// Trackpad pinch arrives as ctrl+wheel with small deltas; mouse wheels
		// send ~100px per notch. Scale each so both feel natural.
		const sensitivity = e.ctrlKey ? 0.01 : 0.002;
		const p = localPoint(e);
		zoomAt(Math.exp(-delta * sensitivity), p.x, p.y);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		const step = 60;
		switch (e.key) {
			case '+':
			case '=':
				zoomAtCenter(1.25);
				break;
			case '-':
			case '_':
				zoomAtCenter(0.8);
				break;
			case '0':
				fit();
				break;
			case '1':
				actualSize();
				break;
			case 'f':
			case 'F':
				if (canFullscreen) toggleFullscreen();
				break;
			case 'ArrowLeft':
				setView(x + step, y, scale);
				break;
			case 'ArrowRight':
				setView(x - step, y, scale);
				break;
			case 'ArrowUp':
				setView(x, y + step, scale);
				break;
			case 'ArrowDown':
				setView(x, y - step, scale);
				break;
			default:
				return;
		}
		e.preventDefault();
	}

	// Close on a backdrop click — but only if the press also started on the
	// backdrop, so a pan that ends outside the dialog doesn't close it.
	let pressedBackdrop = false;

	function onDialogPointerDown(e: PointerEvent) {
		pressedBackdrop = e.target === dialogEl;
	}

	function onDialogClick(e: MouseEvent) {
		if (pressedBackdrop && e.target === dialogEl) close();
		pressedBackdrop = false;
	}

	onMount(() => {
		returnFocus = document.activeElement as HTMLElement | null;
		canFullscreen = document.fullscreenEnabled;

		const clone = cloneDiagram(source);
		stageEl.append(clone);
		svg = clone;

		dialogEl.showModal();
		viewportEl.focus();
		fit();

		// Wheel must be non-passive so preventDefault stops page/browser zoom
		viewportEl.addEventListener('wheel', onWheel, { passive: false });

		// Keep the diagram centred when the viewport resizes (window resize,
		// entering/leaving fullscreen)
		let lastWidth = viewportEl.clientWidth;
		let lastHeight = viewportEl.clientHeight;
		const resizeObserver = new ResizeObserver(() => {
			const w = viewportEl.clientWidth;
			const h = viewportEl.clientHeight;
			setView(x + (w - lastWidth) / 2, y + (h - lastHeight) / 2, scale);
			lastWidth = w;
			lastHeight = h;
		});
		resizeObserver.observe(viewportEl);

		const onFullscreenChange = () => {
			fullscreen = document.fullscreenElement === frameEl;
		};
		document.addEventListener('fullscreenchange', onFullscreenChange);

		return () => {
			viewportEl.removeEventListener('wheel', onWheel);
			resizeObserver.disconnect();
			document.removeEventListener('fullscreenchange', onFullscreenChange);
		};
	});

	$effect(() => {
		if (!svg) return;
		svg.style.width = `${naturalWidth * scale}px`;
		svg.style.height = `${naturalHeight * scale}px`;
	});

	function onDialogClose() {
		returnFocus?.focus({ preventScroll: true });
		onclose();
	}
</script>

<dialog
	bind:this={dialogEl}
	onclose={onDialogClose}
	onpointerdown={onDialogPointerDown}
	onclick={onDialogClick}
	onkeydown={onKeydown}
	aria-label="Diagram viewer"
	class="yb-print-hide m-auto h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-h-none max-w-none overflow-hidden rounded-lg border border-neutral-200 bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-black/60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
>
	<div bind:this={frameEl} class="flex h-full w-full flex-col bg-white dark:bg-neutral-900">
		<div
			class="flex items-center gap-1 border-b border-neutral-200 px-3 py-2 dark:border-neutral-700"
		>
			<p class="hidden text-xs text-neutral-500 sm:block">
				Scroll or pinch to zoom · drag to pan · double-click to zoom in
			</p>

			<div class="ml-auto flex items-center gap-1">
				<button
					onclick={() => zoomAtCenter(0.8)}
					class="rounded-md p-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
					aria-label="Zoom out"
					title="Zoom out (−)"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="7" />
						<path stroke-linecap="round" d="M21 21l-4.35-4.35M8 11h6" />
					</svg>
				</button>
				<button
					onclick={actualSize}
					class="min-w-14 rounded-md px-2 py-1 text-sm tabular-nums transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
					aria-label="Reset to actual size"
					title="Actual size (1)"
				>
					{Math.round(scale * 100)}%
				</button>
				<button
					onclick={() => zoomAtCenter(1.25)}
					class="rounded-md p-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
					aria-label="Zoom in"
					title="Zoom in (+)"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="7" />
						<path stroke-linecap="round" d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
					</svg>
				</button>

				<span class="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700"></span>

				<button
					onclick={fit}
					class="rounded-md p-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
					aria-label="Fit to screen"
					title="Fit to screen (0)"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
						<rect x="9" y="9" width="6" height="6" rx="1" />
					</svg>
				</button>
				{#if canFullscreen}
					<button
						onclick={toggleFullscreen}
						class="rounded-md p-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
						aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
						title={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
					>
						{#if fullscreen}
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
							</svg>
						{:else}
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
							</svg>
						{/if}
					</button>
				{/if}
				<button
					onclick={close}
					class="rounded-md p-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
					aria-label="Close"
					title="Close (Esc)"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<div
			bind:this={viewportEl}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			ondblclick={onDoubleClick}
			tabindex="-1"
			role="application"
			aria-label="Diagram. Use + and − to zoom, arrow keys to pan, 0 to fit."
			class="relative flex-1 touch-none select-none overflow-hidden outline-none {dragging
				? 'cursor-grabbing'
				: 'cursor-grab'}"
		>
			<div
				bind:this={stageEl}
				class="absolute left-0 top-0 origin-top-left"
				style:transform="translate({x}px, {y}px)"
			></div>
		</div>
	</div>
</dialog>
