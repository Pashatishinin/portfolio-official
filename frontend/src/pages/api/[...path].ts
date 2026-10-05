import type { APIRoute } from "astro";
import { INTERNAL_API_URL } from "../../shared/aquarium/session";

/**
 * Same-origin proxy: https://www.pavlotishynin.com/api/* → the Aquarium Worker.
 *
 * The Worker lives on *.workers.dev, a different site from www.pavlotishynin.com,
 * so the browser would treat its cookies as third-party and drop them. Routing
 * the API through the site keeps the session cookies on www.pavlotishynin.com.
 * The target is fixed (AQUARIUM_API_ORIGIN), so this can't be used to reach
 * anything else.
 */

// Hop-by-hop / transport headers that must not be copied between connections.
const DROP_REQUEST = ["host", "connection", "content-length", "accept-encoding", "x-forwarded-host"];
// fetch() already decoded the body, so the original encoding/length no longer apply.
const DROP_RESPONSE = ["content-encoding", "content-length", "transfer-encoding", "connection"];

export const ALL: APIRoute = async ({ request, url }) => {
	const target = new URL(url.pathname + url.search, INTERNAL_API_URL);

	// Misconfiguration guard: without AQUARIUM_API_ORIGIN the proxy would call itself.
	if (target.origin === url.origin) {
		return Response.json({ error: "api_proxy_misconfigured" }, { status: 502 });
	}

	const headers = new Headers(request.headers);
	for (const name of DROP_REQUEST) headers.delete(name);

	const hasBody = request.method !== "GET" && request.method !== "HEAD";

	let upstream: Response;
	try {
		upstream = await fetch(target, {
			method: request.method,
			headers,
			body: hasBody ? await request.arrayBuffer() : undefined,
			// OAuth redirects (to Google and back to /aquarium) must reach the browser as-is.
			redirect: "manual",
		});
	} catch (error) {
		console.error("[api proxy] upstream unreachable:", error);
		return Response.json({ error: "api_unreachable" }, { status: 502 });
	}

	const responseHeaders = new Headers();
	upstream.headers.forEach((value, name) => {
		if (name === "set-cookie" || DROP_RESPONSE.includes(name)) return;
		responseHeaders.set(name, value);
	});
	// Several Set-Cookie headers (access + refresh tokens) must stay separate.
	for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", cookie);
	responseHeaders.set("x-robots-tag", "noindex, nofollow");

	return new Response(upstream.status === 204 || upstream.status === 304 ? null : upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: responseHeaders,
	});
};
