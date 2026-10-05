import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { auth, isOwner, type AuthUser } from "./auth";
import { env } from "./env";
import { groupRoutes } from "./routes/groups";
import { linkRoutes, projectRoutes } from "./routes/projects";

const api = new Hono()
	// Public
	.get("/health", (c) => c.json({ ok: true }))
	.route("/auth", auth.routes)
	.get("/me", async (c) => {
		const user = await auth.getSession(c);
		if (!user || !isOwner(user.email)) return c.json({ error: "unauthorized" }, 401);
		return c.json({ email: user.email, name: user.name, avatarUrl: user.avatarUrl });
	});

// Everything registered after this point requires a valid owner session.
const protectedApi = new Hono<{ Variables: { authUser: AuthUser } }>()
	.use(auth.middleware())
	.use(async (c, next) => {
		// Re-check on every request so removing an email from OWNER_EMAILS
		// locks it out immediately, without waiting for tokens to expire.
		if (!isOwner(c.get("authUser").email)) return c.json({ error: "forbidden" }, 403);
		await next();
	})
	.route("/groups", groupRoutes)
	.route("/projects", projectRoutes)
	.route("/links", linkRoutes);

export const app = new Hono()
	.use(logger())
	.use(secureHeaders())
	.use(
		"/api/*",
		cors({
			origin: env.FRONTEND_URL,
			credentials: true,
			allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type"],
			maxAge: 600,
		}),
	)
	.use("/api/*", csrf({ origin: [env.FRONTEND_URL, env.API_URL] }))
	.use("/api/*", bodyLimit({ maxSize: 256 * 1024 }))
	.route("/api", api)
	.route("/api", protectedApi);

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((error, c) => {
	if (error instanceof HTTPException) {
		const fallback = error.status === 403 ? "forbidden" : error.status === 401 ? "unauthorized" : "error";
		return c.json({ error: error.message || fallback }, error.status);
	}
	console.error(error);
	return c.json({ error: "internal_error" }, 500);
});

/** Import this type in the frontend with `hc<AppType>()` for a fully typed client. */
export type AppType = typeof app;
