// How someone who sent an inquiry found the site. The browser sends a short summary with the contact
// form (see src/scripts/journey.ts); this checks it and turns it into plain lines for the email.

interface Touch {
	ts: number;
	source: string;
	campaign?: string;
	landing: string;
}
interface Journey {
	first: Touch;
	last: Touch;
	visits: number;
	pages: { p: string; ts: number }[];
}

const PAGE_NAMES: Record<string, string> = {
	'/': 'Home',
	'/music-cinematography': 'Music Cinematography',
	'/narrative-and-documentary': 'Narrative & Documentary',
	'/live-sessions': 'Live Sessions',
	'/photo-gallery': 'Photo Gallery',
	'/about': 'About',
	'/stuck-in-the-desert': 'Stuck in the Desert story',
};

const text = (value: unknown, max: number) =>
	String(value ?? '')
		.replace(/[\u0000-\u001f<>]/g, '')
		.trim()
		.slice(0, max);
const path = (value: unknown) => {
	const p = text(value, 120);
	return p.startsWith('/') ? p.replace(/\/+$/, '') || '/' : '/';
};
const time = (value: unknown) => {
	const n = Number(value);
	// A broken clock (in the future, or before the site existed) is left out.
	return Number.isFinite(n) && n > 1_700_000_000_000 && n < Date.now() + 86_400_000 ? Math.floor(n) : 0;
};
const touch = (value: any): Touch | null => {
	if (!value || typeof value !== 'object') return null;
	const source = text(value.source, 60);
	if (!source) return null;
	const campaign = text(value.campaign, 60);
	return { ts: time(value.ts), source, landing: path(value.landing), ...(campaign && { campaign }) };
};

function parse(raw: unknown): Journey | null {
	try {
		const data = JSON.parse(String(raw ?? '').slice(0, 6000));
		const first = touch(data?.first);
		if (!first) return null;
		const last = touch(data?.last) ?? first;
		const pages = (Array.isArray(data?.pages) ? data.pages : [])
			.slice(-20)
			.map((page: any) => ({ p: path(page?.p), ts: time(page?.ts) }));
		const visits = Math.min(Math.max(Math.floor(Number(data?.visits)) || 1, 1), 999);
		return { first, last, visits, pages };
	} catch {
		return null;
	}
}

const sourceLabel = (t: Touch) => {
	const base = t.source === 'Direct' ? 'Typed in, a bookmark, or a link in a text or email' : t.source;
	return t.campaign ? `${base} · ${t.campaign}` : base;
};
const ago = (ts: number) => {
	if (!ts) return '';
	const days = Math.floor((Date.now() - ts) / 86_400_000);
	return days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
};

/** Plain-English lines for the inquiry email, or '' when the browser kept nothing. */
export function describeJourney(raw: unknown): string {
	const journey = parse(raw);
	if (!journey) return '';
	const lines = [`Found the site: ${sourceLabel(journey.first)}${ago(journey.first.ts) ? `, ${ago(journey.first.ts)}` : ''}`];
	if (journey.last.source !== journey.first.source || journey.last.campaign !== journey.first.campaign) {
		lines.push(`Came back from: ${sourceLabel(journey.last)}`);
	}
	lines.push(`Visits: ${journey.visits}`);
	const seen: string[] = [];
	for (const page of journey.pages) {
		if (page.p === '/contact') continue;
		const name = PAGE_NAMES[page.p] ?? page.p;
		if (!seen.includes(name)) seen.push(name);
	}
	if (seen.length) lines.push(`Looked at: ${seen.join(', ')}`);
	return lines.join('\n');
}
