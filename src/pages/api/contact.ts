import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const TO_EMAIL = 'jacob@jwmedia.biz';
const FROM_EMAIL = 'JWMedia Website <website@jwmedia.biz>';

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
		subject: `New inquiry from ${name} via jwmedia.biz`,
		text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
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

	return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
