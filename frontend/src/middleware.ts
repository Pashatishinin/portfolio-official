import { defineMiddleware } from "astro:middleware";
import { resolveSession } from "./shared/aquarium/session";

const OWNER_LOGIN = "/aquarium/login";
const CLIENT_LOGIN = "/portal/login";

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);
const isPage = (pathname: string, page: string) => pathname === page || pathname === `${page}/`;

/**
 * Guards the private areas. The check runs on the server before the page
 * renders, so nothing private is ever sent to a visitor who isn't allowed in.
 *
 * /aquarium/*  — the owner only (Google sign-in). Clients are sent to /portal.
 * /portal/*    — invited clients and the owner (preview). A client gets in by
 *                opening the project link and typing an email invited to it.
 */
export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;
	const owner = under(pathname, "/aquarium");
	const portal = under(pathname, "/portal");
	if (!owner && !portal) return next();

	const session = await resolveSession(context.request, context.url.origin);
	const user = session.user;

	const finish = (response: Response) => {
		for (const line of session.setCookies) response.headers.append("set-cookie", line);
		response.headers.set("cache-control", "private, no-store");
		response.headers.set("x-robots-tag", "noindex, nofollow");
		return response;
	};
	const home = user?.role === "owner" ? "/aquarium" : "/portal";

	// Login pages: already signed in → straight to your own area.
	if (isPage(pathname, OWNER_LOGIN) || isPage(pathname, CLIENT_LOGIN)) {
		if (user) return finish(context.redirect(home, 302));
		context.locals.aquarium = { user: null, cookie: session.cookie, unavailable: session.unavailable };
		return finish(await next());
	}

	// A project link is its own front door: without a session it shows the email form.
	const projectLink = /^\/portal\/p\/[^/]+\/?$/.test(pathname);
	if (!user && projectLink) {
		context.locals.aquarium = { user: null, cookie: session.cookie, unavailable: session.unavailable };
		return finish(await next());
	}

	const login = owner ? OWNER_LOGIN : CLIENT_LOGIN;
	if (!user) {
		return finish(context.redirect(session.unavailable ? `${login}?error=unavailable` : login, 302));
	}
	if (owner && user.role !== "owner") return finish(context.redirect("/portal", 302));

	context.locals.aquarium = { user, cookie: session.cookie };
	return finish(await next());
});
