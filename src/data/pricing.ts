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

// Package ranges shown under "Packages" on the service pages. The first package always starts at
// the starting price above, so the two never disagree.
export interface Package {
	name: string;
	price: string;
	detail: string;
}
const from = (service: PricedService) => money(startingPrices[service] ?? 0);

export const packages: Partial<Record<PricedService, Package[]>> = {
	music: [
		{ name: 'Performance video', price: `${from('music')} – $4,000`, detail: 'One shoot day at one or two locations, lit and shot on cinema cameras, then edited and color graded in-house.' },
		{ name: 'Concept video', price: '$5,000 – $8,000', detail: 'A story or concept built around the song, with more locations, a bigger crew and a full lighting package.' },
		{ name: 'Campaigns', price: 'Quoted per project', detail: 'Multi-day shoots for lead singles and album rollouts.' },
	],
	live: [
		{ name: 'Demo taping', price: from('live'), detail: 'A multi-camera taping of your set or session, edited and mixed from the board.' },
		{ name: 'Full set', price: '$2,000 – $3,000', detail: 'Three or more cameras on a full show, with the whole set edited plus standalone songs for release.' },
	],
	events: [
		{ name: 'Livestream', price: `From ${from('events')}`, detail: 'Up to four cameras switched live, with board audio and full recordings delivered after.' },
		{ name: 'Full-day coverage', price: 'From $5,000', detail: 'A full day of multi-camera recording, with a recap film and edited sessions.' },
		{ name: 'Multi-day conferences', price: 'Quoted per event', detail: 'Multiple rooms or days, scoped with you well ahead of the event.' },
	],
	photo: [
		{ name: 'Band & promo shoot', price: from('photo'), detail: 'Two to three hours in the studio or on location, with edited images ready for press and streaming.' },
		{ name: 'Full show', price: '$1,000 – $1,500', detail: 'Coverage of the performance, the venue and the crowd.' },
	],
};
