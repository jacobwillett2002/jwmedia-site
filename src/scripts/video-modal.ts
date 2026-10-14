// In-site video player for links marked with data-video-id (see VideoModal.astro).
import { lockScroll, unlockScroll } from './scroll-lock';

const modal = document.getElementById('video-modal');
const frame = modal?.querySelector<HTMLElement>('.vm-frame');
const titleEl = document.getElementById('video-modal-title');
const externals = Array.from(modal?.querySelectorAll<HTMLAnchorElement>('[data-vm-external]') ?? []);
const closeBtn = modal?.querySelector<HTMLButtonElement>('button[data-vm-close]');

let lastTrigger: HTMLElement | null = null;
let closeTimer = 0;
const animated = () => document.documentElement.classList.contains('motion');

function embedUrl(provider: string, id: string) {
	if (provider === 'vimeo') return `https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=1&dnt=1`;
	return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
}

function open(trigger: HTMLAnchorElement) {
	if (!modal || !frame) return;
	const id = trigger.dataset.videoId ?? '';
	const provider = trigger.dataset.videoProvider ?? 'youtube';
	const title = trigger.dataset.videoTitle ?? '';
	window.clearTimeout(closeTimer);
	lastTrigger = trigger;

	if (titleEl) titleEl.textContent = title;
	externals.forEach((link) => {
		link.href = trigger.href;
		link.textContent = provider === 'vimeo' ? 'Watch on Vimeo ↗' : 'Watch on YouTube ↗';
	});

	frame.querySelector('iframe')?.remove();
	const iframe = document.createElement('iframe');
	iframe.src = embedUrl(provider, id);
	iframe.title = title ? `${title} — video` : 'Video';
	iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
	iframe.allowFullscreen = true;
	iframe.referrerPolicy = 'strict-origin-when-cross-origin';
	iframe.className = 'absolute inset-0 h-full w-full';
	iframe.addEventListener('load', () => frame.classList.add('is-loaded'), { once: true });
	frame.classList.remove('is-loaded');
	frame.appendChild(iframe);

	modal.classList.remove('hidden');
	modal.classList.add('flex');
	lockScroll();
	requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
	closeBtn?.focus({ preventScroll: true });
}

function close() {
	if (!modal || modal.classList.contains('hidden')) return;
	modal.classList.remove('is-open');
	const finish = () => {
		modal.classList.add('hidden');
		modal.classList.remove('flex');
		frame?.querySelector('iframe')?.remove(); // stops playback
		unlockScroll();
		lastTrigger?.focus({ preventScroll: true });
	};
	if (animated()) closeTimer = window.setTimeout(finish, 320);
	else finish();
}

document.addEventListener('click', (e) => {
	const target = e.target as HTMLElement | null;
	const link = target?.closest<HTMLAnchorElement>('a[data-video-id]');
	if (link && modal) {
		// Let modified clicks (new tab, etc.) behave like normal links.
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		open(link);
		return;
	}
	if (target?.closest('[data-vm-close]')) close();
});

// Focus bookends: tabbing out of the embedded player lands back on Close.
modal?.querySelectorAll<HTMLElement>('[data-vm-sentinel]').forEach((el) =>
	el.addEventListener('focus', () => closeBtn?.focus()),
);

document.addEventListener('keydown', (e) => {
	if (!modal || modal.classList.contains('hidden')) return;
	if (e.key === 'Escape') {
		e.preventDefault();
		close();
		return;
	}
	if (e.key === 'Tab') {
		// Keep keyboard focus inside the player.
		const focusables = Array.from(
			modal.querySelectorAll<HTMLElement>('.vm-stage a[href], .vm-stage button, .vm-stage iframe'),
		).filter((el) => el.offsetParent !== null);
		if (!focusables.length) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}
});
