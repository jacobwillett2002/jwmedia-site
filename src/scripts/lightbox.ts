// Photo viewer for `.gallery-item` buttons (see Lightbox.astro).
import { lockScroll, unlockScroll } from './scroll-lock';

const lightboxEl = document.getElementById('lightbox');
const imageEl = document.getElementById('lightbox-image') as HTMLImageElement | null;
if (lightboxEl && imageEl) setup(lightboxEl, imageEl);

function setup(lightbox: HTMLElement, lightboxImage: HTMLImageElement) {
	const items = Array.from(document.querySelectorAll<HTMLButtonElement>('.gallery-item'));
	const sources = items.map((item) => item.querySelector('img')?.src ?? '');
	const alts = items.map((item) => item.querySelector('img')?.alt ?? '');
	const closeBtn = document.getElementById('lightbox-close');
	const prevBtn = document.getElementById('lightbox-prev');
	const nextBtn = document.getElementById('lightbox-next');
	const captionEl = document.getElementById('lightbox-caption');

	// "Caption · 3 / 12", numbered within each captioned group.
	const captions = items.map((item, i) => {
		const label = item.dataset.caption;
		if (!label) return `${i + 1} / ${items.length}`;
		const group = items.filter((other) => other.dataset.caption === label);
		return `${label} · ${group.indexOf(item) + 1} / ${group.length}`;
	});

	let currentIndex = 0;
	let closeTimer = 0;
	let swapToken = 0;
	let isOpen = false;
	let lastTrigger: HTMLElement | null = null;
	const animated = () => document.documentElement.classList.contains('motion');

	const setMeta = (index: number) => {
		lightboxImage.alt = alts[index];
		if (captionEl) captionEl.textContent = captions[index];
	};

	function open(index: number) {
		currentIndex = index;
		window.clearTimeout(closeTimer);
		swapToken++;
		lastTrigger = items[index];
		lightboxImage.classList.remove('is-loading');
		lightboxImage.src = sources[currentIndex];
		setMeta(currentIndex);
		lightbox.classList.remove('hidden');
		lightbox.classList.add('flex');
		if (!isOpen) lockScroll();
		isOpen = true;
		// Let the browser paint it once before fading in.
		requestAnimationFrame(() => requestAnimationFrame(() => lightbox.classList.add('is-open')));
		closeBtn?.focus({ preventScroll: true });
		warm(index + 1);
		warm(index - 1);
	}

	function close() {
		if (!isOpen) return;
		isOpen = false;
		lightbox.classList.remove('is-open');
		const hide = () => {
			lightbox.classList.add('hidden');
			lightbox.classList.remove('flex');
		};
		unlockScroll();
		lastTrigger?.focus({ preventScroll: true });
		if (animated()) closeTimer = window.setTimeout(hide, 300);
		else hide();
	}

	// Moving between photos: the next photo is fetched while the current one stays up, then a copy of
	// the current one fades out drifting the way it leaves while the next fades in from the other side.
	// Never a blank screen while a big photo downloads. (Fade only, no drift, for reduced motion.)
	const ghost = document.getElementById('lightbox-ghost') as HTMLImageElement | null;
	let ghostTimer = 0;
	function leaveWithGhost() {
		if (!ghost || !lightboxImage.currentSrc) return;
		const frame = lightbox.getBoundingClientRect();
		const rect = lightboxImage.getBoundingClientRect();
		if (!rect.width) return;
		window.clearTimeout(ghostTimer);
		ghost.classList.remove('is-leaving');
		ghost.src = lightboxImage.currentSrc;
		Object.assign(ghost.style, {
			left: `${rect.left - frame.left}px`,
			top: `${rect.top - frame.top}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`,
			opacity: getComputedStyle(lightboxImage).opacity,
		});
		void ghost.offsetWidth;
		ghost.style.opacity = '';
		ghost.classList.add('is-leaving');
		ghostTimer = window.setTimeout(() => ghost.removeAttribute('src'), 650);
	}

	function warm(index: number) {
		const near = new Image();
		near.src = sources[(index + sources.length) % sources.length];
	}

	function show(delta: number) {
		const dir = delta > 0 ? 1 : -1;
		currentIndex = (currentIndex + delta + sources.length) % sources.length;
		const src = sources[currentIndex];
		setMeta(currentIndex);
		const token = ++swapToken;
		const incoming = new Image();
		incoming.src = src;
		// Only dim the current photo if the next one is slow to arrive.
		const dimTimer = window.setTimeout(() => token === swapToken && lightboxImage.classList.add('is-loading'), 250);
		const swap = () => {
			window.clearTimeout(dimTimer);
			if (token !== swapToken) return;
			leaveWithGhost();
			lightbox.style.setProperty('--dir', String(dir));
			lightboxImage.classList.add('is-entering');
			lightboxImage.classList.remove('is-loading');
			lightboxImage.src = src;
			void lightboxImage.offsetWidth;
			lightboxImage.classList.remove('is-entering');
		};
		incoming.decode().then(swap, swap);
		warm(currentIndex + dir);
	}

	items.forEach((item, index) => {
		item.addEventListener('click', () => open(index));
	});

	closeBtn?.addEventListener('click', close);
	prevBtn?.addEventListener('click', () => show(-1));
	nextBtn?.addEventListener('click', () => show(1));
	lightbox.addEventListener('click', (e) => {
		if (e.target === lightbox) close();
	});

	document.addEventListener('keydown', (e) => {
		if (!isOpen) return;
		if (e.key === 'Escape') close();
		if (e.key === 'ArrowLeft') show(-1);
		if (e.key === 'ArrowRight') show(1);
		if (e.key === 'Tab') {
			// Keep keyboard focus on the viewer's controls while it's open.
			const controls = [closeBtn, prevBtn, nextBtn].filter(Boolean) as HTMLElement[];
			const at = controls.indexOf(document.activeElement as HTMLElement);
			e.preventDefault();
			const next = at === -1 ? 0 : (at + (e.shiftKey ? -1 : 1) + controls.length) % controls.length;
			controls[next].focus();
		}
	});

	// Swipe left/right on phones.
	let startX = 0;
	let startY = 0;
	let tracking = false;
	lightbox.addEventListener(
		'touchstart',
		(e) => {
			if (e.touches.length !== 1) return;
			tracking = true;
			startX = e.touches[0].clientX;
			startY = e.touches[0].clientY;
		},
		{ passive: true },
	);
	lightbox.addEventListener(
		'touchend',
		(e) => {
			if (!tracking) return;
			tracking = false;
			const t = e.changedTouches[0];
			const dx = t.clientX - startX;
			const dy = t.clientY - startY;
			if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(dx < 0 ? 1 : -1);
		},
		{ passive: true },
	);
}
