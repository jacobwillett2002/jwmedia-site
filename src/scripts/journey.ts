// Remembers, in this visitor's own browser only, how they found the site and which pages they looked at.
// Nothing leaves the browser until they send the contact form; then a short summary goes with it, so
// the inquiry email says where the lead came from. No cookies, no third parties.

const KEY = 'jwm_journey';
const NEW_VISIT_AFTER = 30 * 60 * 1000; // 30 minutes away counts as a new visit
const MAX_PAGES = 30;

export interface Touch {
	ts: number;
	source: string;
	campaign?: string;
	landing: string;
}
export interface Journey {
	v: 1;
	first: Touch;
	last: Touch;
	visits: number;
	seen: number;
	pages: { p: string; ts: number }[];
}

const FRIENDLY: [RegExp, string][] = [
	[/(^|\.)instagram\.com$/, 'Instagram'],
	[/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'],
	[/(^|\.)google\.[a-z.]+$/, 'Google'],
	[/(^|\.)bing\.com$/, 'Bing'],
	[/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
	[/(^|\.)(search\.)?yahoo\.com$/, 'Yahoo'],
	[/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
	[/(^|\.)tiktok\.com$/, 'TikTok'],
	[/(^|\.)yelp\.com$/, 'Yelp'],
	[/(^|\.)theknot\.com$/, 'The Knot'],
	[/(^|\.)weddingwire\.com$/, 'WeddingWire'],
	[/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
	[/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, 'Pinterest'],
	[/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X (Twitter)'],
	[/(^|\.)reddit\.com$/, 'Reddit'],
	[/(^|\.)nocornerscutphotography\.com$/, 'No Corners Cut Photography'],
	[/(^|\.)spotify\.com$/, 'Spotify'],
];

const tidy = (value: string, max = 60) => value.replace(/[^\w .@&'’()/+-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const nice = (value: string) => {
	const named = FRIENDLY.find(([pattern]) => pattern.test(value.toLowerCase()));
	if (named) return named[1];
	return value.length <= 3 ? value.toUpperCase() : value.charAt(0).toUpperCase() + value.slice(1);
};

/** Where this page view came from, or null when it is a click from inside the site or has no clue. */
function sourceOfThisView(): Omit<Touch, 'ts' | 'landing'> | null {
	const params = new URLSearchParams(location.search);
	// A tagged link wins: ?from=flyer, ?utm_source=instagram&utm_campaign=koat-fest, ?ref=...
	const tagged = params.get('utm_source') || params.get('from') || params.get('ref') || params.get('source');
	const campaign = tidy(params.get('utm_campaign') || params.get('campaign') || '');
	if (tagged) {
		const medium = (params.get('utm_medium') || '').toLowerCase();
		const paid = /cpc|ppc|paid|^ads?$/.test(medium) || params.has('gclid');
		return { source: `${nice(tidy(tagged, 40))}${paid ? ' (ad)' : ''}`, ...(campaign && { campaign }) };
	}
	if (params.has('gclid') || params.has('gbraid') || params.has('wbraid')) return { source: 'Google (ad)', ...(campaign && { campaign }) };
	let host = '';
	try {
		host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
	} catch {
		host = '';
	}
	if (host && host !== location.hostname.replace(/^www\./, '') && !/(^|\.)jwmedia\.biz$|pages\.dev$|workers\.dev$|localhost$/.test(host)) {
		return { source: nice(host) };
	}
	if (params.has('fbclid')) return { source: 'Facebook' };
	if (params.has('igshid') || params.has('igsh')) return { source: 'Instagram' };
	return null;
}

export function readJourney(): Journey | null {
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
		return parsed && parsed.v === 1 && parsed.first ? (parsed as Journey) : null;
	} catch {
		return null;
	}
}

/** Called on every public page. */
export function recordPage() {
	try {
		const now = Date.now();
		const path = location.pathname.replace(/\/+$/, '') || '/';
		const found = sourceOfThisView();
		const touch = (source: string): Touch => ({ ts: now, source, landing: path, ...(found?.campaign && { campaign: found.campaign }) });
		let journey = readJourney();
		if (!journey) {
			const first = touch(found?.source ?? 'Direct');
			journey = { v: 1, first, last: first, visits: 1, seen: now, pages: [] };
		} else {
			const newVisit = now - journey.seen > NEW_VISIT_AFTER;
			if (newVisit) journey.visits += 1;
			// The latest outside source is kept as well as the first, so "found on Google, came back from Instagram" shows.
			if (found) journey.last = touch(found.source);
			else if (newVisit) journey.last = touch('Direct');
			journey.seen = now;
		}
		const previous = journey.pages[journey.pages.length - 1];
		if (!previous || previous.p !== path) journey.pages.push({ p: path, ts: now });
		journey.pages = journey.pages.slice(-MAX_PAGES);
		localStorage.setItem(KEY, JSON.stringify(journey));
	} catch {
		/* storage blocked (private window): the site works the same, the inquiry just has no source */
	}
}

/** The short summary that goes with an inquiry. */
export function journeySummary() {
	const journey = readJourney();
	if (!journey) return '';
	return JSON.stringify({
		first: journey.first,
		last: journey.last,
		visits: journey.visits,
		pages: journey.pages.slice(-20),
	});
}

/** Which service someone was most recently looking at, to pre-select it on the inquiry form. */
export function likelyService(): string {
	const journey = readJourney();
	if (!journey) return '';
	const SERVICE_PAGES: [RegExp, string][] = [
		[/^\/music-cinematography/, 'Music video'],
		[/^\/stuck-in-the-desert/, 'Music video'],
		[/^\/narrative-and-documentary/, 'Narrative or documentary'],
		[/^\/live-sessions/, 'Live session or concert'],
		[/^\/photo-gallery/, 'Photography'],
	];
	for (const page of [...journey.pages].reverse()) {
		const match = SERVICE_PAGES.find(([pattern]) => pattern.test(page.p));
		if (match) return match[1];
	}
	return '';
}
