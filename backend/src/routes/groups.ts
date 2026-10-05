import { asc, eq, max } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/client";
import { groups } from "../db/schema";
import { groupInput, groupPatch, idParam } from "../validation";
import { validate as zValidator } from "../validator";

export const groupRoutes = new Hono()
	.get("/", async (c) => {
		const items = await db.query.groups.findMany({
			orderBy: [asc(groups.sortOrder), asc(groups.createdAt)],
		});
		return c.json({ items });
	})

	.post("/", zValidator("json", groupInput), async (c) => {
		const input = c.req.valid("json");
		let sortOrder = input.sortOrder;
		if (sortOrder === undefined) {
			const [row] = await db.select({ last: max(groups.sortOrder) }).from(groups);
			sortOrder = row?.last == null ? 0 : row.last + 1;
		}
		const [group] = await db.insert(groups).values({ ...input, sortOrder }).returning();
		return c.json(group, 201);
	})

	.patch("/:id", zValidator("param", idParam), zValidator("json", groupPatch), async (c) => {
		const [group] = await db
			.update(groups)
			.set({ ...c.req.valid("json"), updatedAt: new Date() })
			.where(eq(groups.id, c.req.valid("param").id))
			.returning();
		if (!group) throw new HTTPException(404, { message: "Group not found" });
		return c.json(group);
	})

	// Projects in the group are kept and become ungrouped (ON DELETE SET NULL).
	.delete("/:id", zValidator("param", idParam), async (c) => {
		const deleted = await db
			.delete(groups)
			.where(eq(groups.id, c.req.valid("param").id))
			.returning({ id: groups.id });
		if (!deleted.length) throw new HTTPException(404, { message: "Group not found" });
		return c.body(null, 204);
	});
