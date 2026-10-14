// Starting prices shown on the site ("Starting at $1,000"): JWMedia's everyday rates for
// independent artists and local clients, set against what San Diego production companies publish
// (October 2026): full-service music/concert videos about $2,500–$3,200, multi-camera livestreams
// about $2,400–$2,900, studio podcast sessions $350–$400 before editing, event photography from
// about $400 for two hours. (The "Production Rates 2026" sheet is the booking agent's
// card for label-level clients and is not used here.) Change a number and every page that shows it
// updates: the service pages, the home page's "What We Do" list, each video's page, and the
// conference page. A service set to null shows no price ("quoted per project").
export const startingPrices = {
	music: 2500, // Music videos
	live: 1000, // Live sessions and demo tapings
	events: 2500, // Conferences, corporate events and multi-camera livestreams
	photo: 600, // Photography
	podcast: 1000, // Podcast production: on location, three cameras switched live (mobile crews charge $600 raw, $1,200 edited)
	narrative: null, // Short films and documentaries: quoted per project
} as const;

export type PricedService = keyof typeof startingPrices;

export const money = (dollars: number) => `$${dollars.toLocaleString('en-US')}`;

// Budget ranges offered (optionally) on the contact form.
export const budgetRanges = ['Under $1,000', '$1,000 – $2,500', '$2,500 – $5,000', '$5,000 – $10,000', '$10,000+', 'Not sure yet'];
