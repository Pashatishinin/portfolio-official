// Server-only helpers: the Astro server talks to the Hono backend on the
// visitor's behalf by forwarding their cookies.
import type { AquariumUser } from "./types";

export const API_URL = (import.meta.env.PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/+$/, "");

const ACCESS_COOKIE = "auth_access_token";
const REFRESH_COOKIE = "auth_refresh_token";

export interface Session {
	user: AquariumUser | null;
	/** Cookie header to use for further server-side API calls in this request. */
	cookie: string;
	/** Set-Cookie headers to pass back to the browser (after a token refresh). */
	setCookies: string[];
	/** True when the backend couldn't be reached at all. */
	unavailable?: boolean;
}

const hasCookie = (header: string, name: string) =>
	header.split(";").some((part) => part.trim().startsWith(`${name}=`));

/** Replace/insert cookies in a Cookie header from a list of Set-Cookie values. */
function mergeCookies(header: string, setCookies: string[]): string {
	const jar = new Map<string, string>();
	for (const part of header.split(";")) {
		const [name, ...rest] = part.trim().split("=");
		if (name) jar.set(name, rest.join("="));
	}
	for (const line of setCookies) {
		const [pair] = line.split(";");
		const [name, ...rest] = (pair ?? "").trim().split("=");
		if (!name) continue;
		const value = rest.join("=");
		if (value) jar.set(name, value);
		else jar.delete(name);
	}
	return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchMe(cookie: string): Promise<Response> {
	return fetch(`${API_URL}/api/me`, { headers: { cookie }, cache: "no-store" });
}

/**
 * Resolves the visitor's session. If the 15-minute access token has expired
 * but the refresh cookie is still valid, refreshes it here so the page
 * renders logged-in instead of bouncing to the login screen.
 */
export async function resolveSession(request: Request, origin: string): Promise<Session> {
	let cookie = request.headers.get("cookie") ?? "";
	const setCookies: string[] = [];

	if (!hasCookie(cookie, ACCESS_COOKIE) && !hasCookie(cookie, REFRESH_COOKIE)) {
		return { user: null, cookie, setCookies };
	}

	try {
		let res = await fetchMe(cookie);

		if (res.status === 401 && hasCookie(cookie, REFRESH_COOKIE)) {
			const refresh = await fetch(`${API_URL}/api/auth/refresh`, {
				method: "POST",
				headers: { cookie, origin },
				cache: "no-store",
			});
			const fresh = refresh.headers.getSetCookie();
			setCookies.push(...fresh);
			if (refresh.ok) {
				cookie = mergeCookies(cookie, fresh);
				res = await fetchMe(cookie);
			}
		}

		if (!res.ok) return { user: null, cookie, setCookies };
		return { user: (await res.json()) as AquariumUser, cookie, setCookies };
	} catch (error) {
		console.error("[aquarium] backend unreachable:", error);
		return { user: null, cookie, setCookies, unavailable: true };
	}
}

/** GET a JSON endpoint of the backend with the visitor's cookies. */
export async function apiGet<T>(path: string, cookie: string): Promise<T> {
	const res = await fetch(`${API_URL}${path}`, { headers: { cookie }, cache: "no-store" });
	if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
	return (await res.json()) as T;
}
