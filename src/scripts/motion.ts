// Site-wide motion. Loaded once from Layout.astro.
// Pairs with src/styles/motion.css. If this file never runs, the inline
// failsafe in Layout.astro removes `html.motion` and everything stays visible.

declare global {
	interface Window {
		__jwmMotion?: boolean;
	}
}

window.__jwmMotion = true;

const root = document.documentElement;
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionOn = () => root.classList.contains('motion');
const REVEAL_SELECTOR = '[data-reveal],[data-split]';

function revealAll() {
	document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => el.classList.add('is-in'));
}

// If the visitor switches on "reduce motion" mid-visit, stop everything at once.
reduceQuery.addEventListener?.('change', (e) => {
	if (e.matches) {
		root.classList.remove('motion');
		revealAll();
		document.querySelectorAll<HTMLVideoElement>('[data-reel-video]').forEach((v) => v.pause());
	}
});

// ---------------------------------------------------------------------------
// Scroll reveals
// Elements entering view together are staggered by their on-screen order
// (row by row, left to right), so a grid of cards cascades naturally.
// ---------------------------------------------------------------------------
function initReveals() {
	const targets = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
	if (!motionOn() || !('IntersectionObserver' in window)) {
		revealAll();
		return;
	}

	const reveal = (el: HTMLElement, delay: number) => {
		el.style.setProperty('--d', `${delay}ms`);
		el.classList.add('is-in');
		el.dispatchEvent(new CustomEvent('reveal', { detail: { delay } }));
	};

	const io = new IntersectionObserver(
		(entries) => {
			const incoming = entries
				.filter((e) => e.isIntersecting)
				.map((e) => ({ el: e.target as HTMLElement, rect: e.boundingClientRect }));
			incoming.sort((a, b) => Math.round(a.rect.top) - Math.round(b.rect.top) || a.rect.left - b.rect.left);
			let k = 0;
			for (const { el } of incoming) {
				io.unobserve(el);
				const fixed = el.dataset.delay;
				reveal(el, fixed !== undefined ? Number(fixed) : Math.min(k++, 6) * 90);
			}
		},
		{ rootMargin: '0px 0px -6% 0px', threshold: 0 },
	);
	targets.forEach((el) => io.observe(el));

	// Anything left at the very bottom of the page can't scroll past the
	// trigger line, so reveal stragglers once the visitor hits the end.
	const sweepBottom = () => {
		if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
			document.querySelectorAll<HTMLElement>(`:is(${REVEAL_SELECTOR}):not(.is-in)`).forEach((el) => {
				io.unobserve(el);
				reveal(el, 0);
			});
		}
	};
	window.addEventListener('scroll', sweepBottom, { passive: true });
	window.addEventListener('resize', sweepBottom, { passive: true });
	sweepBottom();
}

// ---------------------------------------------------------------------------
// Number count-up: <span data-count aria-hidden="true">40+</span>
// (pair it with a visually hidden copy of the real value for screen readers)
// ---------------------------------------------------------------------------
function initCounters() {
	document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
		const final = (el.textContent ?? '').trim();
		const match = final.match(/^(\d+)(.*)$/);
		if (!match || !motionOn()) return;
		const target = Number(match[1]);
		const suffix = match[2];
		const host = el.closest<HTMLElement>('[data-reveal]') ?? el;
		if (host.classList.contains('is-in')) return;

		el.textContent = `0${suffix}`;
		host.addEventListener(
			'reveal',
			(ev) => {
				const delay = ((ev as CustomEvent).detail?.delay ?? 0) + 250;
				const duration = target > 9 ? 1600 : 900;
				setTimeout(() => {
					const start = performance.now();
					const tick = (now: number) => {
						const p = Math.min(1, (now - start) / duration);
						const eased = 1 - Math.pow(1 - p, 3);
						el.textContent = p < 1 ? `${Math.round(target * eased)}${suffix}` : final;
						if (p < 1) requestAnimationFrame(tick);
					};
					requestAnimationFrame(tick);
				}, delay);
			},
			{ once: true },
		);
	});
}

// ---------------------------------------------------------------------------
// Header: a firmer background once the page has scrolled
// Reading progress bar: [data-read-progress]
// ---------------------------------------------------------------------------
function initScrollChrome() {
	const header = document.querySelector<HTMLElement>('[data-site-header]');
	const bar = document.querySelector<HTMLElement>('[data-read-progress]');
	let queued = false;
	const update = () => {
		queued = false;
		const y = window.scrollY;
		header?.toggleAttribute('data-scrolled', y > 8);
		if (bar) {
			const max = document.documentElement.scrollHeight - window.innerHeight;
			bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
		}
	};
	window.addEventListener(
		'scroll',
		() => {
			if (!queued) {
				queued = true;
				requestAnimationFrame(update);
			}
		},
		{ passive: true },
	);
	window.addEventListener('resize', update, { passive: true });
	update();
}

// ---------------------------------------------------------------------------
// Phones have no hover, so project cards "light up" (colour, zoom, play
// button) as they pass through the middle of the screen instead.
// ---------------------------------------------------------------------------
function initTouchCards() {
	if (!motionOn() || !window.matchMedia('(hover: none)').matches) return;
	const cards = document.querySelectorAll<HTMLElement>('.project-card');
	if (!cards.length) return;
	const io = new IntersectionObserver(
		(entries) => entries.forEach((e) => e.target.classList.toggle('is-active', e.isIntersecting)),
		{ rootMargin: '-38% 0px -38% 0px', threshold: 0 },
	);
	cards.forEach((card) => io.observe(card));
}

// ---------------------------------------------------------------------------
// Home hero reel: crossfading stills with a slow Ken Burns drift — or, if a
// showreel video is set, that video. Either pauses when the tab is hidden or
// the hero is scrolled away, and has a pause button.
// ---------------------------------------------------------------------------
function setPauseButton(btn: HTMLButtonElement | null, paused: boolean, noun: string) {
	if (!btn) return;
	btn.setAttribute('aria-pressed', String(paused));
	btn.setAttribute('aria-label', paused ? `Play hero ${noun}` : `Pause hero ${noun}`);
	btn.dataset.state = paused ? 'paused' : 'playing';
}

function initReel() {
	const reel = document.querySelector<HTMLElement>('[data-reel]');
	if (!reel) return;
	const video = reel.querySelector<HTMLVideoElement>('[data-reel-video]');

	if (!video) {
		runStills(reel);
		return;
	}
	if (!motionOn()) {
		// Reduced motion: no video, just the first still.
		video.remove();
		return;
	}
	video
		.play()
		.then(() => runVideo(reel, video))
		// Can't play here (unsupported format, data saver…): fall back to the stills.
		.catch(() => {
			video.remove();
			runStills(reel);
		});
}

function runVideo(reel: HTMLElement, video: HTMLVideoElement) {
	reel.dataset.mode = 'video';
	const pauseBtn = document.querySelector<HTMLButtonElement>('[data-reel-pause]');
	let userPaused = false;
	let offscreen = false;
	const sync = () => {
		if (userPaused || offscreen || document.hidden) video.pause();
		else video.play().catch(() => {});
		setPauseButton(pauseBtn, userPaused, 'video');
	};
	pauseBtn?.addEventListener('click', () => {
		userPaused = !userPaused;
		sync();
	});
	document.addEventListener('visibilitychange', sync);
	new IntersectionObserver(([entry]) => {
		offscreen = !entry.isIntersecting;
		sync();
	}).observe(reel);
}

function runStills(reel: HTMLElement) {
	const host = reel.closest<HTMLElement>('section') ?? reel;
	const slides = Array.from(reel.querySelectorAll<HTMLElement>('[data-reel-slide]'));
	if (!motionOn() || slides.length < 2) return;

	const hold = Number(reel.dataset.hold ?? 6500);
	const fade = 1800;
	const titleEl = document.querySelector<HTMLElement>('[data-reel-title]');
	const indexEl = document.querySelector<HTMLElement>('[data-reel-index]');
	const dots = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-reel-dot]'));
	const pauseBtn = document.querySelector<HTMLButtonElement>('[data-reel-pause]');

	let current = 0;
	let timer = 0;
	let startedAt = performance.now();
	let remaining = hold;
	let userPaused = false;
	let hiddenPaused = false;
	let offscreenPaused = false;
	let transitioning = false;

	const pad = (n: number) => String(n + 1).padStart(2, '0');

	const restartDot = (dot: HTMLElement) => {
		dot.classList.remove('is-active');
		void dot.offsetWidth; // restart the CSS progress animation
		dot.classList.add('is-active');
	};

	const updateUi = (n: number) => {
		dots.forEach((dot, i) => {
			dot.classList.toggle('is-done', i < n);
			dot.setAttribute('aria-current', i === n ? 'true' : 'false');
			if (i !== n) dot.classList.remove('is-active');
		});
		if (dots[n]) restartDot(dots[n]);
		if (indexEl) indexEl.textContent = pad(n);
		if (titleEl) {
			const next = slides[n].dataset.title ?? '';
			titleEl.classList.add('is-swapping');
			setTimeout(() => {
				titleEl.textContent = next;
				titleEl.classList.remove('is-swapping');
			}, 320);
		}
	};

	// Stills after the first are rendered without their image address (see HeroReel.astro), so
	// they don't download alongside the first one. Give a still its address when it's next up.
	const hydrate = (slide: HTMLElement | undefined) => {
		const img = slide?.querySelector<HTMLImageElement>('img[data-srcset]');
		if (!img) return;
		img.srcset = img.dataset.srcset!;
		img.src = img.dataset.src!;
		delete img.dataset.srcset;
		delete img.dataset.src;
	};

	const isPaused = () => userPaused || hiddenPaused || offscreenPaused;

	const schedule = (ms: number) => {
		clearTimeout(timer);
		remaining = ms;
		startedAt = performance.now();
		if (!isPaused()) timer = window.setTimeout(() => go((current + 1) % slides.length), ms);
	};

	const go = (n: number) => {
		if (n === current || transitioning) return;
		const prev = slides[current];
		const next = slides[n];
		hydrate(next);
		const img = next.querySelector('img');
		if (next.dataset.broken) {
			// A still that failed to load: skip straight past it.
			const after = (n + 1) % slides.length;
			if (after === current) schedule(hold);
			else go(after);
			return;
		}
		transitioning = true;

		const show = () => {
			prev.classList.remove('is-active');
			prev.classList.add('is-leaving');
			next.classList.add('is-active');
			window.setTimeout(() => prev.classList.remove('is-leaving'), fade + 200);
			current = n;
			transitioning = false;
			updateUi(n);
			schedule(hold);
			// Start fetching the still after this one while this one is on screen.
			hydrate(slides[(n + 1) % slides.length]);
		};

		if (!img || (img.complete && img.naturalWidth > 0)) {
			show();
		} else {
			img.loading = 'eager';
			img.decode().then(show, () => {
				// Couldn't load this still; mark it and move on to the next one.
				transitioning = false;
				next.dataset.broken = '1';
				const dot = dots[n];
				if (dot) dot.hidden = true;
				go(n);
			});
		}
	};

	let wasPaused = false;
	const syncPause = () => {
		const paused = isPaused();
		setPauseButton(pauseBtn, userPaused, 'slideshow');
		if (paused === wasPaused) return; // only act on playing ⇄ paused changes
		wasPaused = paused;
		host.toggleAttribute('data-reel-paused', paused);
		if (paused) {
			clearTimeout(timer);
			remaining = Math.max(0, remaining - (performance.now() - startedAt));
		} else {
			schedule(remaining);
		}
	};

	dots.forEach((dot, i) =>
		dot.addEventListener('click', () => {
			if (i === current) return;
			go(i);
		}),
	);
	pauseBtn?.addEventListener('click', () => {
		userPaused = !userPaused;
		syncPause();
	});
	document.addEventListener('visibilitychange', () => {
		hiddenPaused = document.hidden;
		syncPause();
	});
	new IntersectionObserver(
		([entry]) => {
			offscreenPaused = !entry.isIntersecting;
			syncPause();
		},
		{ threshold: 0 },
	).observe(reel);

	// Once the page has finished loading, fetch the second still (each later one is fetched while
	// the one before it is showing).
	const warm = () => hydrate(slides[1]);
	if (document.readyState === 'complete') warm();
	else window.addEventListener('load', warm, { once: true });

	if (dots[0]) restartDot(dots[0]);
	dots[0]?.setAttribute('aria-current', 'true');
	schedule(hold);
}

// ---------------------------------------------------------------------------
// Lazy-loaded photos on cards and galleries fade up when they arrive.
// ---------------------------------------------------------------------------
function initImageFade() {
	if (!motionOn()) return;
	document.querySelectorAll<HTMLImageElement>('.project-card img, .gallery-item img').forEach((img) => {
		if (img.complete) return;
		img.classList.add('img-pending');
		const done = () => {
			img.classList.remove('img-pending');
			img.classList.add('img-in');
		};
		img.addEventListener('load', done, { once: true });
		img.addEventListener('error', () => img.classList.remove('img-pending'), { once: true });
	});
}

// ---------------------------------------------------------------------------

function start() {
	initScrollChrome();
	initImageFade();
	initCounters();
	initTouchCards();
	initReel();

	// Let the display font arrive before headlines animate, so the words don't
	// swap typeface mid-rise. Never wait longer than ~700ms.
	const fontsReady = document.fonts?.ready ?? Promise.resolve();
	Promise.race([fontsReady, new Promise((r) => setTimeout(r, 700))]).then(initReveals);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
	start();
}

export {};
