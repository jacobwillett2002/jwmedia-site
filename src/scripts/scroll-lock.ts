// Shared by the video player and the photo lightbox: stop the page behind an
// open overlay from scrolling. Counted, so two overlays can't fight over it.
let locks = 0;

export function lockScroll() {
	locks++;
	if (locks === 1) {
		const root = document.documentElement;
		// Pad by the scrollbar's width so the page behind doesn't jump sideways.
		root.style.setProperty('--scrollbar-width', `${window.innerWidth - root.clientWidth}px`);
		root.classList.add('scroll-locked');
	}
}

export function unlockScroll() {
	locks = Math.max(0, locks - 1);
	if (locks === 0) document.documentElement.classList.remove('scroll-locked');
}
