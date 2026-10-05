import type { LinkKind } from "./types";

export interface DetectedService {
	/** Human name shown as the default label, e.g. "GitHub". */
	name: string;
	/** Closest kind the API knows about. */
	kind: LinkKind;
	/** Hostname without "www.", used for the favicon and the muted domain line. */
	host: string;
}

type Rule = [match: (host: string, path: string) => boolean, name: string, kind: LinkKind];

const is = (...domains: string[]) => (host: string) =>
	domains.some((d) => host === d || host.endsWith(`.${d}`));

// Order matters: the first match wins, so specific hosts go before broad ones.
const RULES: Rule[] = [
	[is("github.com"), "GitHub", "github"],
	[is("gitlab.com"), "GitLab", "github"],
	[is("bitbucket.org"), "Bitbucket", "github"],
	[is("vercel.app"), "Vercel preview", "deploy"],
	[is("vercel.com"), "Vercel", "deploy"],
	[is("netlify.app", "netlify.com"), "Netlify", "deploy"],
	[is("pages.dev"), "Cloudflare Pages", "deploy"],
	[is("workers.dev"), "Cloudflare Worker", "deploy"],
	[is("cloudflare.com"), "Cloudflare", "deploy"],
	[is("railway.app", "railway.com"), "Railway", "deploy"],
	[is("render.com"), "Render", "deploy"],
	[is("fly.io"), "Fly.io", "deploy"],
	[is("sanity.studio"), "Sanity Studio", "docs"],
	[is("sanity.io"), "Sanity", "docs"],
	[is("console.neon.tech", "neon.tech", "neon.com"), "Neon", "other"],
	[is("supabase.com", "supabase.co"), "Supabase", "other"],
	[is("console.firebase.google.com", "firebase.google.com"), "Firebase", "other"],
	[is("console.cloud.google.com"), "Google Cloud", "other"],
	[is("analytics.google.com"), "Google Analytics", "other"],
	[(h, p) => h === "search.google.com" && p.startsWith("/search-console"), "Search Console", "other"],
	[is("play.google.com"), "Google Play Console", "other"],
	[is("docs.google.com"), "Google Docs", "docs"],
	[is("drive.google.com"), "Google Drive", "drive"],
	[is("appstoreconnect.apple.com"), "App Store Connect", "other"],
	[is("developer.apple.com"), "Apple Developer", "other"],
	[is("apps.apple.com"), "App Store", "other"],
	[is("figma.com"), "Figma", "figma"],
	[is("framer.com", "framer.website"), "Framer", "design"],
	[is("webflow.com"), "Webflow", "design"],
	[is("dribbble.com"), "Dribbble", "design"],
	[is("behance.net"), "Behance", "design"],
	[is("notion.so", "notion.site"), "Notion", "notion"],
	[is("linear.app"), "Linear", "docs"],
	[is("trello.com"), "Trello", "docs"],
	[is("atlassian.net", "atlassian.com"), "Atlassian", "docs"],
	[is("npmjs.com"), "npm", "other"],
	[is("stripe.com"), "Stripe", "other"],
	[is("resend.com"), "Resend", "other"],
	[is("sentry.io"), "Sentry", "other"],
	[is("posthog.com"), "PostHog", "other"],
	[is("shopify.com", "myshopify.com"), "Shopify", "other"],
	[is("slack.com"), "Slack", "other"],
	[is("discord.com", "discord.gg"), "Discord", "other"],
	[is("dropbox.com"), "Dropbox", "drive"],
	[is("namecheap.com", "porkbun.com", "godaddy.com"), "Domain registrar", "other"],
];

/** Adds https:// when the user pasted a bare domain. Returns null for anything that isn't http(s). */
export function normalizeUrl(input: string): string | null {
	const raw = input.trim();
	if (!raw) return null;
	const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
	try {
		const url = new URL(withScheme);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
		return url.toString();
	} catch {
		return null;
	}
}

export function detectService(input: string): DetectedService | null {
	const normalized = normalizeUrl(input);
	if (!normalized) return null;
	const url = new URL(normalized);
	const host = url.hostname.replace(/^www\./, "");
	for (const [match, name, kind] of RULES) {
		if (match(host, url.pathname)) return { name, kind, host };
	}
	return { name: "Website", kind: "other", host };
}

/** Short, readable version of a URL for the muted line on a card. */
export function displayUrl(input: string): string {
	try {
		const url = new URL(input);
		const host = url.hostname.replace(/^www\./, "");
		const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
		return `${host}${path}`;
	} catch {
		return input;
	}
}

export function faviconUrl(host: string): string {
	return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}
