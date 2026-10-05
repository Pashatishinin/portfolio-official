import { and, asc, desc, eq, ilike, max, or, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/client";
import { groups, links, projects } from "../db/schema";
import {
	idParam,
	linkInput,
	linkPatch,
	projectInput,
	projectListQuery,
	projectPatch,
} from "../validation";
import { validate as zValidator } from "../validator";

const withLinks = {
	links: { orderBy: [asc(links.sortOrder), asc(links.createdAt)] },
};

async function assertGroup(groupId: string | null | undefined) {
	if (!groupId) return;
	const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId), columns: { id: true } });
	if (!group) throw new HTTPException(400, { message: "Group not found" });
}

async function findProject(id: string) {
	const project = await db.query.projects.findFirst({
		where: eq(projects.id, id),
		with: withLinks,
	});
	if (!project) throw new HTTPException(404, { message: "Project not found" });
	return project;
}

export const projectRoutes = new Hono()
	// List — optional ?status=active&q=search
	.get("/", zValidator("query", projectListQuery), async (c) => {
		const { status, q } = c.req.valid("query");
		const filters: SQL[] = [];
		if (status) filters.push(eq(projects.status, status));
		if (q) {
			const pattern = `%${q}%`;
			filters.push(or(ilike(projects.title, pattern), ilike(projects.description, pattern))!);
		}

		const items = await db.query.projects.findMany({
			where: filters.length ? and(...filters) : undefined,
			orderBy: [asc(projects.sortOrder), desc(projects.updatedAt)],
			with: withLinks,
		});
		return c.json({ items });
	})

	// Create — links can be sent along in the same request
	.post("/", zValidator("json", projectInput), async (c) => {
		const { links: linkList, ...data } = c.req.valid("json");
		await assertGroup(data.groupId);
		const id = crypto.randomUUID();

		await db.batch([
			db.insert(projects).values({ ...data, id }),
			...linkList.map((link, index) =>
				db.insert(links).values({ ...link, sortOrder: link.sortOrder ?? index, projectId: id }),
			),
		] as const);

		return c.json(await findProject(id), 201);
	})

	.get("/:id", zValidator("param", idParam), async (c) => {
		return c.json(await findProject(c.req.valid("param").id));
	})

	.patch("/:id", zValidator("param", idParam), zValidator("json", projectPatch), async (c) => {
		const { id } = c.req.valid("param");
		const data = c.req.valid("json");
		await assertGroup(data.groupId);

		const updated = await db
			.update(projects)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(projects.id, id))
			.returning({ id: projects.id });
		if (!updated.length) throw new HTTPException(404, { message: "Project not found" });

		return c.json(await findProject(id));
	})

	.delete("/:id", zValidator("param", idParam), async (c) => {
		const { id } = c.req.valid("param");
		// Links go with it via ON DELETE CASCADE.
		const deleted = await db
			.delete(projects)
			.where(eq(projects.id, id))
			.returning({ id: projects.id });
		if (!deleted.length) throw new HTTPException(404, { message: "Project not found" });

		return c.body(null, 204);
	})

	// Add a link to a project
	.post("/:id/links", zValidator("param", idParam), zValidator("json", linkInput), async (c) => {
		const { id } = c.req.valid("param");
		await findProject(id);

		const input = c.req.valid("json");
		let sortOrder = input.sortOrder;
		if (sortOrder === undefined) {
			// Append to the end of the project's link list.
			const [row] = await db
				.select({ last: max(links.sortOrder) })
				.from(links)
				.where(eq(links.projectId, id));
			sortOrder = row?.last == null ? 0 : row.last + 1;
		}

		const [link] = await db
			.insert(links)
			.values({ ...input, sortOrder, projectId: id })
			.returning();

		await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, id));
		return c.json(link, 201);
	});

export const linkRoutes = new Hono()
	.patch("/:id", zValidator("param", idParam), zValidator("json", linkPatch), async (c) => {
		const { id } = c.req.valid("param");
		const [link] = await db
			.update(links)
			.set({ ...c.req.valid("json"), updatedAt: new Date() })
			.where(eq(links.id, id))
			.returning();
		if (!link) throw new HTTPException(404, { message: "Link not found" });

		await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, link.projectId));
		return c.json(link);
	})

	.delete("/:id", zValidator("param", idParam), async (c) => {
		const { id } = c.req.valid("param");
		const [link] = await db.delete(links).where(eq(links.id, id)).returning();
		if (!link) throw new HTTPException(404, { message: "Link not found" });

		await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, link.projectId));
		return c.body(null, 204);
	});
