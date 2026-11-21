import type { Context } from "hono";
import { env } from "./env";

export interface Mail {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

/**
 * Sends one email through Resend's HTTP API (works the same on Node and on
 * Cloudflare Workers). Without RESEND_API_KEY the mail is only logged, so
 * local development needs no email account: the message shows up in the
 * backend's terminal.
 */
export async function sendMail(mail: Mail): Promise<void> {
	if (!env.RESEND_API_KEY) {
		console.info(`[mail:dev] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
		return;
	}
	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			authorization: `Bearer ${env.RESEND_API_KEY}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			from: env.MAIL_FROM,
			to: [mail.to],
			subject: mail.subject,
			text: mail.text,
			html: mail.html,
		}),
	});
	if (!res.ok) {
		// Never log the body we sent: it may hold a sign-in code.
		throw new Error(`Resend responded ${res.status}: ${await res.text().catch(() => "")}`);
	}
}

/**
 * Runs work after the response is sent. On Workers that needs waitUntil, or the
 * runtime may cut it off; on Node the promise simply keeps running.
 */
export function inBackground(c: Context, work: Promise<unknown>) {
	const guarded = work.catch((error) => console.error("[background]", error));
	try {
		c.executionCtx.waitUntil(guarded);
	} catch {
		// No execution context (Node dev server) — nothing else to do.
	}
}

const escapeHtml = (value: string) =>
	value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** Minimal, mail-client-safe layout in the site's colours. */
export function mailHtml(lines: string[], cta?: { label: string; url: string }) {
	const body = lines.map((line) => `<p style="margin:0 0 14px">${escapeHtml(line)}</p>`).join("");
	const button = cta
		? `<p style="margin:24px 0 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#141821;color:#faf6ef;padding:12px 22px;text-decoration:none">${escapeHtml(cta.label)}</a></p>`
		: "";
	return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#141821;background:#faf6ef;padding:32px">${body}${button}</div>`;
}
