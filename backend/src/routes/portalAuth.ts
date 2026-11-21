// Client sign-in: open the project link → enter your email → if that email is
// invited to THIS project, you're in. No passwords, codes or emails.
//
// The project id in the link (a random UUID) is the "something you have",
// the invited email the "something you know". Both are needed.
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { isOwner, issueClientSession } from "../auth";
import { db } from "../db/client";
import { projectMembers } from "../db/schema";
import { validate } from "../validator";

const enterInput = z.object({
	projectId: z.uuid(),
	email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
});

// Slows down guessing: a few tries per minute per address.
const WINDOW_MS = 60_000;
const MAX_TRIES = 10;
const tries = new Map<string, { n: number; since: number }>();

function tooMany(key: string): boolean {
	const now = Date.now();
	const entry = tries.get(key);
	if (!entry || now - entry.since > WINDOW_MS) {
		tries.set(key, { n: 1, since: now });
		if (tries.size > 5_000) tries.clear();
		return false;
	}
	entry.n += 1;
	return entry.n > MAX_TRIES;
}

export const portalAuthRoutes = new Hono().post("/enter", validate("json", enterInput), async (c) => {
	const { projectId, email } = c.req.valid("json");

	const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
	if (tooMany(`${ip}:${projectId}`)) return c.json({ error: "too_many_attempts" }, 429);

	// The owner signs in with Google; an email typed here must never open the owner's area.
	if (isOwner(email)) return c.json({ error: "no_access" }, 403);

	const member = await db.query.projectMembers.findFirst({
		where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.email, email)),
		columns: { id: true },
	});
	if (!member) return c.json({ error: "no_access" }, 403);

	await issueClientSession(c, email);
	return c.json({ ok: true });
});
