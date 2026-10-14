// Project cards on a desktop: hovering a card pops it forward and plays a silent preview of the
// video inside the thumbnail. Clicking still opens the full video in the theater player.
//
// To make the preview start almost at once, the preview player is loaded quietly (hidden and
// paused) for cards that sit on screen for a moment. Hovering then only has to press play, and the
// player stays hidden until YouTube reports it is actually playing, so its buttons never show.
// At most MAX_LIVE players are kept loaded; the one used longest ago is let go first. Each one is
// a full YouTube player, so keeping this small keeps scrolling smooth and leaves bandwidth for
// the page's photos.
//
// Each card can set where its preview starts with "previewStart" (seconds) in its project file.

const MAX_LIVE = 3;
const POP = 1.15; // how much larger a card grows on hover
const HEADER = 73; // height of the fixed menu bar

const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
const saveData = connection?.saveData === true;
// On a slow connection, don't load players in the background; a hover still loads one.
const slowConnection = /(^|-)2g$|^3g$/.test(connection?.effectiveType ?? '');

interface Preview {
	card: HTMLElement;
	frame: HTMLIFrameElement | null;
	usedAt: number;
	hovering: boolean;
	playing: boolean;
	corrected: boolean;
	lastTime?: number;
	revealTimer?: number;
	fallbackTimer?: number;
	settleTimer?: number;
}

const previews: Preview[] = [];
const byWindow = new Map<Window, Preview>();

function send(p: Preview, func: string, args: unknown[] = []) {
	p.frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
}
const startOf = (p: Preview) => Number(p.card.dataset.previewStart || 0);

function reveal(p: Preview) {
	window.clearTimeout(p.revealTimer);
	// A short beat after "playing" lets YouTube's start-up overlay finish before the picture shows.
	p.revealTimer = window.setTimeout(() => p.hovering && p.frame?.classList.add('is-on'), 350);
}
function conceal(p: Preview) {
	window.clearTimeout(p.revealTimer);
	window.clearTimeout(p.fallbackTimer);
	p.frame?.classList.remove('is-on');
}

function unload(p: Preview) {
	conceal(p);
	if (p.frame?.contentWindow) byWindow.delete(p.frame.contentWindow);
	p.frame?.remove();
	p.frame = null;
	p.playing = false;
}

function load(p: Preview) {
	if (p.frame) return;
	const media = p.card.querySelector<HTMLElement>('.card-media');
	if (!media) return;
	// Keep the number of loaded players in check.
	const live = previews.filter((other) => other.frame && other !== p);
	if (live.length >= MAX_LIVE) {
		const oldest = live.filter((other) => !other.hovering).sort((a, b) => a.usedAt - b.usedAt)[0];
		if (oldest) unload(oldest);
	}
	const id = p.card.dataset.preview!;
	const start = startOf(p);
	const frame = document.createElement('iframe');
	frame.src =
		`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?enablejsapi=1&origin=${encodeURIComponent(location.origin)}` +
		`&mute=1&controls=0&disablekb=1&fs=0&playsinline=1&rel=0&iv_load_policy=3&modestbranding=1&loop=1&playlist=${encodeURIComponent(id)}` +
		(start ? `&start=${start}` : '');
	frame.allow = 'autoplay; encrypted-media';
	frame.tabIndex = -1;
	frame.title = '';
	frame.setAttribute('aria-hidden', 'true');
	frame.className = 'card-preview';
	frame.addEventListener('load', () => {
		if (frame.contentWindow) byWindow.set(frame.contentWindow, p);
		// Ask the player to report its state, then make sure it stays silent.
		frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id, channel: 'widget' }), '*');
		send(p, 'mute');
		if (p.hovering) play(p);
	});
	// Above the still, below the soft fade into the card and the play button.
	const fade = media.querySelector(':scope > .bg-gradient-to-t');
	media.insertBefore(frame, fade);
	p.frame = frame;
	p.usedAt = Date.now();
}

function play(p: Preview) {
	p.corrected = false;
	p.lastTime = undefined;
	p.usedAt = Date.now();
	send(p, 'seekTo', [startOf(p), true]);
	send(p, 'playVideo');
	// If the player never reports back, show it anyway after a moment.
	window.clearTimeout(p.fallbackTimer);
	p.fallbackTimer = window.setTimeout(() => p.hovering && p.frame?.classList.add('is-on'), 1600);
	if (p.playing) reveal(p);
}

function stop(p: Preview) {
	p.hovering = false;
	conceal(p);
	send(p, 'pauseVideo');
}

window.addEventListener('message', (event) => {
	const p = event.source ? byWindow.get(event.source as Window) : undefined;
	if (!p) return;
	let data: { event?: string; info?: any } | undefined;
	try {
		data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
	} catch {
		return;
	}
	const info = data?.info;
	if (typeof info?.currentTime === 'number') p.lastTime = info.currentTime;
	// If a preview is found playing from the very beginning, ask it once to jump to its start.
	const start = startOf(p);
	if (p.playing && start > 1 && !p.corrected && p.lastTime !== undefined && p.lastTime < start - 2) {
		p.corrected = true;
		send(p, 'seekTo', [start, true]);
	}
	const state = info?.playerState ?? (data?.event === 'onStateChange' ? info : undefined);
	if (state === undefined) return;
	p.playing = state === 1;
	if (p.playing && p.hovering) {
		window.clearTimeout(p.fallbackTimer);
		reveal(p);
	}
	// Paused, buffering or ended: keep YouTube's overlay out of sight.
	if (!p.playing) conceal(p);
});

/* ---------- pop out: the card grows, but never past the window edges or under the menu ---------- */
function popOut(p: Preview) {
	const card = p.card;
	window.clearTimeout(p.settleTimer);
	const rect = card.getBoundingClientRect();
	const margin = 16;
	const top = HEADER + margin;
	const room = Math.min((window.innerWidth - margin * 2) / rect.width, (window.innerHeight - top - margin) / rect.height);
	const scale = Math.min(POP, room);
	if (scale <= 1.02) return;
	const grow = scale - 1;
	const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
	const left = clamp(rect.left - (rect.width * grow) / 2, margin, window.innerWidth - margin - rect.width * scale);
	const upper = clamp(rect.top - (rect.height * grow) / 2, top, window.innerHeight - margin - rect.height * scale);
	card.style.transformOrigin = `${(rect.left - left) / grow}px ${(rect.top - upper) / grow}px`;
	card.style.zIndex = '30';
	card.classList.add('is-popped');
	card.style.transform = `scale(${scale})`;
}
function settle(p: Preview) {
	p.card.classList.remove('is-popped');
	p.card.style.transform = '';
	// Stay above the neighbours until the shrink has finished.
	p.settleTimer = window.setTimeout(() => (p.card.style.zIndex = ''), 260);
}

if (canHover) {
	const nearby =
		'IntersectionObserver' in window && !saveData && !slowConnection
			? new IntersectionObserver(
					(entries) => {
						for (const entry of entries) {
							const p = previews.find((item) => item.card === entry.target);
							if (!p) continue;
							const el = entry.target as HTMLElement & { _wait?: number };
							window.clearTimeout(el._wait);
							// Only cards that stay on screen for a moment are loaded, not ones scrolled past.
							if (entry.isIntersecting) el._wait = window.setTimeout(() => load(p), 700);
						}
					},
					{ threshold: 0.5 },
				)
			: null;

	document.querySelectorAll<HTMLElement>('.project-card').forEach((card) => {
		const p: Preview = { card, frame: null, usedAt: 0, hovering: false, playing: false, corrected: false };
		card.classList.add('can-pop');
		card.addEventListener('pointerenter', () => popOut(p));
		card.addEventListener('pointerleave', () => settle(p));
		if (!card.dataset.preview || saveData) return;
		previews.push(p);
		nearby?.observe(card);
		card.addEventListener('pointerenter', () => {
			p.hovering = true;
			if (!p.frame) load(p);
			else play(p);
		});
		card.addEventListener('pointerleave', () => stop(p));
		// Opening the full video stops the preview.
		card.querySelector('[data-video-id]')?.addEventListener('click', () => {
			stop(p);
			settle(p);
		});
	});
}
