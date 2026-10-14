import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { describeJourney } from '../../lib/journey';

export const prerender = false;

const TO_EMAIL = 'jacob@jwmedia.biz';
const FROM_EMAIL = 'JWMedia Website <website@jwmedia.biz>';
const REPLY_FROM = 'Jacob Willett <jacob@jwmedia.biz>';

// Work worth a look while they wait, picked by what they're planning.
const LINKS: Record<string, [string, string][]> = {
	'Event or livestream': [['Conferences & livestreams', 'https://jwmedia.biz/conference-video-production-san-diego/'], ['Live sessions', 'https://jwmedia.biz/live-sessions/']],
	'Live session or concert': [['Live sessions', 'https://jwmedia.biz/live-sessions/'], ['Music videos', 'https://jwmedia.biz/music-cinematography/']],
	'Narrative or documentary': [['Narrative & documentary', 'https://jwmedia.biz/narrative-and-documentary/'], ['Music videos', 'https://jwmedia.biz/music-cinematography/']],
	'Photography': [['Photo gallery', 'https://jwmedia.biz/photo-gallery/'], ['Music videos', 'https://jwmedia.biz/music-cinematography/']],
	'Podcast': [['Our team and gear', 'https://jwmedia.biz/about/'], ['Live sessions', 'https://jwmedia.biz/live-sessions/']],
};
const DEFAULT_LINKS: [string, string][] = [['Music videos', 'https://jwmedia.biz/music-cinematography/'], ['Live sessions', 'https://jwmedia.biz/live-sessions/']];

function autoReply(name: string, email: string, service: string) {
	const first = name.split(/\s+/)[0] || 'there';
	const about = service && service !== 'Something else' ? `your ${service.toLowerCase()}` : 'your project';
	const links = (LINKS[service] ?? DEFAULT_LINKS).map(([label, url]) => `${label}: ${url}`);
	return {
		from: REPLY_FROM,
		to: [email],
		reply_to: TO_EMAIL,
		subject: 'Got your message',
		text: [
			`Hi ${first},`,
			`Thanks for reaching out about ${about}. Your message came through, and I'll get back to you within a day.`,
			['If you want to look around in the meantime:', ...links, 'The story behind "Stuck in the Desert," our Best Music Video winner at the 2026 San Diego Music Awards: https://jwmedia.biz/stuck-in-the-desert/'].join('\n'),
			'If anything is urgent, call or text me at (619) 609-7557.',
			'Jacob Willett\nJWMedia',
		].join('\n\n'),
	};
}

export async function POST(context: APIContext) {
	const apiKey = (env as Record<string, string>).RESEND_API_KEY;

	const formData = await context.request.formData();

	// Honeypot: bots fill every field, real users never see or fill this one.
	if (formData.get('company')) {
		return new Response(JSON.stringify({ ok: true }), { status: 200 });
	}

	const name = String(formData.get('name') ?? '').trim();
	const email = String(formData.get('email') ?? '').trim();
	const message = String(formData.get('message') ?? '').trim();
	const field = (key: string, max = 120) => String(formData.get(key) ?? '').trim().slice(0, max);
	const service = field('service');
	const date = field('date', 40);
	const phone = field('phone', 40);
	const budget = field('budget', 40);
	const found = describeJourney(formData.get('journey'));

	if (!name || !email || !message) {
		return new Response(JSON.stringify({ ok: false, error: 'Please fill out every field.' }), {
			status: 400,
		});
	}

	if (!apiKey) {
		console.error('RESEND_API_KEY is not configured.');
		return new Response(
			JSON.stringify({
				ok: false,
				error: 'The contact form is not fully set up yet — please email jacob@jwmedia.biz directly.',
			}),
			{ status: 500 },
		);
	}

	const payload: Record<string, unknown> = {
		from: FROM_EMAIL,
		to: [TO_EMAIL],
		reply_to: email,
		subject: `New inquiry from ${name}${service ? ` — ${service}` : ''} via jwmedia.biz`,
		text: [
			[`Name: ${name}`, `Email: ${email}`, phone && `Phone: ${phone}`, service && `Project: ${service}`, date && `Date: ${date}`, budget && `Budget: ${budget}`]
				.filter(Boolean)
				.join('\n'),
			message,
			found && `— How they found the site —\n${found}`,
		]
			.filter(Boolean)
			.join('\n\n'),
	};

	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const detail = await response.text();
		console.error('Resend API error:', detail);
		return new Response(JSON.stringify({ ok: false, error: 'Something went wrong sending your message.' }), {
			status: 502,
		});
	}

	// A personal "got your message" reply, so they don't move on while they wait. Plain text, from
	// Jacob, so it reads (and lands) like a normal email. If it fails, the inquiry still went through.
	if (/^\S+@\S+\.\S+$/.test(email)) {
		try {
			const reply = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(autoReply(name, email, service)),
			});
			if (!reply.ok) console.error('Auto-reply not sent:', await reply.text());
		} catch (err) {
			console.error('Auto-reply failed', err);
		}
	}

	return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
