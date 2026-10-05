import { defineMiddleware } from "astro:middleware";
import { resolveSession } from "./shared/aquarium/session";

const LOGIN = "/aquarium/login";

/**
 * Guards everything under /aquarium. The check runs on the server before the
 * page renders, so nothing private is ever sent to a visitor who isn't signed in.
 */
export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;
	if (pathname !== "/aquarium" && !pathname.startsWith("/aquarium/")) return next();

	const isLogin = pathname === LOGIN || pathname === `${LOGIN}/`;
	const session = await resolveSession(context.request, context.url.origin);

	const finish = (response: Response) => {
		for (const line of session.setCookies) response.headers.append("set-cookie", line);
		response.headers.set("cache-control", "private, no-store");
		response.headers.set("x-robots-tag", "noindex, nofollow");
		return response;
	};

	if (isLogin) {
		if (session.user) return finish(context.redirect("/aquarium", 302));
		context.locals.aquarium = { user: null, cookie: session.cookie, unavailable: session.unavailable };
		return finish(await next());
	}

	if (!session.user) {
		const target = session.unavailable ? `${LOGIN}?error=unavailable` : LOGIN;
		return finish(context.redirect(target, 302));
	}

	context.locals.aquarium = { user: session.user, cookie: session.cookie };
	return finish(await next());
});
