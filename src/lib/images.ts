// Size limits for photos. Every <Image> also has a plain `src` (used by the lightbox, and by
// very old browsers that ignore `srcset`). Left alone, that `src` is the photo at full camera
// resolution — up to ~5,800px wide and several megabytes — so these helpers cap it.

/** Width for an image's fallback `src`: no wider than `max`, never enlarged. */
export function capWidth(image: ImageMetadata, max: number): number {
	return Math.min(image.width, max);
}

/**
 * Width that keeps the photo's longest side within `longEdge` pixels. Used for photos that open
 * in the lightbox, so portrait shots get the same full-screen sharpness as landscape ones.
 */
export function fitLongEdge(image: ImageMetadata, longEdge = 2400): number {
	if (image.width >= image.height) return Math.min(image.width, longEdge);
	return Math.min(image.width, Math.round((longEdge * image.width) / image.height));
}
