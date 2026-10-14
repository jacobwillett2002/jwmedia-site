// Google reviews shown on the site. Paste real reviews only, exactly as written on Google (trimming
// is fine), with the reviewer's name as Google shows it. The reviews section stays hidden until
// at least one quote is here, and the Google links stay hidden until the links are filled in.
export interface Review {
	quote: string;
	name: string;
	/** Optional: the project or band, e.g. "The Gravities — Stuck in the Desert" */
	project?: string;
}

/** The public profile (where people read the reviews), e.g. https://g.page/... or a maps.app.goo.gl link. */
export const googleProfileUrl = 'https://share.google/xoYKstVPusc50FEMN';
/** Business Profile > "Ask for reviews" link, e.g. https://g.page/r/XXXX/review, which opens the review box directly.
    Until that's added, the profile link is used (visitors press "Write a review" there). */
export const googleReviewUrl = googleProfileUrl;

export const reviews: Review[] = [];
