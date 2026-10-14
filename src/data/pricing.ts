// Starting prices shown on the site ("Starting at $5,500"), taken from the
// "Production Rates 2026" rate card (effective October 2026). Change a number here and every page
// that shows it updates: the service pages, the home page's "What We Do" list, and the
// conference page. A service set to null shows no price ("quoted per project").
export const startingPrices = {
	music: 5500, // Music videos: Performance package $5,500 – $8,500
	live: 2000, // Live Session package $2,000 – $3,500
	events: 3000, // Livestream package $3,000 – $5,500
	photo: 1200, // Live Concert photography $1,200 – $2,000 per show (No Corners Cut Productions)
	narrative: null, // not on the rate card yet
	podcast: null, // not on the rate card yet
} as const;

export type PricedService = keyof typeof startingPrices;

export const money = (dollars: number) => `$${dollars.toLocaleString('en-US')}`;

// Budget ranges offered (optionally) on the contact form, lined up with the rate card's tiers.
export const budgetRanges = ['Under $2,000', '$2,000 – $5,000', '$5,000 – $10,000', '$10,000 – $20,000', '$20,000+', 'Not sure yet'];
