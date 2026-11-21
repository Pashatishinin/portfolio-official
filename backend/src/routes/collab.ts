// Owner-side routes for everything shared with clients: members, tasks,
// task comments and notes. Mounted inside the owner-only part of the API.
import { asc, desc, eq, max } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthUser } from "../auth";
import { db } from "../db/client";
import { links, notes, projectMembers, projects, taskComments, tasks } from "../db/schema";
import {
	commentInput,
	idParam,
	memberInput,
	memberPatch,
	noteInput,
	notePatch,
	taskInput,
	taskPatch,
} from "../validation";
import { validate } from "../validator";

type Env = { Variables: { authUser: AuthUser } };

async function assertProject(id: string) {
	const row = await db.query.projects.findFirst({ where: eq(projects.id, id), columns: { id: true } });
	if (!row) throw new HTTPException(404, { message: "Project not found" });
}

const touchProject = (id: string) => db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, id));

/** Everything the owner's project page needs, in one round trip. */
export async function loadProjectDetail(id: string) {
	const project = await db.query.projects.findFirst({
		where: eq(projects.id, id),
		with: {
			links: { orderBy: [asc(links.sortOrder), asc(links.createdAt)] },
			members: { orderBy: [asc(projectMembers.createdAt)] },
			tasks: {
				orderBy: [asc(tasks.sortOrder), asc(tasks.createdAt)],
				with: { comments: { orderBy: [asc(taskComments.createdAt)] } },
			},
			notes: { orderBy: [desc(notes.createdAt)] },
		},
	});
	if (!project) throw new HTTPException(404, { message: "Project not found" });
	return project;
}

async function findTask(id: string) {
	const task = await db.query.tasks.findFirst({
		where: eq(tasks.id, id),
		with: { comments: { orderBy: [asc(taskComments.createdAt)] } },
	});
	if (!task) throw new HTTPException(404, { message: "Task not found" });
	return task;
}

export const projectCollabRoutes = new Hono<Env>()
	.get("/:id/detail", validate("param", idParam), async (c) => c.json(await loadProjectDetail(c.req.valid("param").id)))

	// ── members ──
	.post("/:id/members", validate("param", idParam), validate("json", memberInput), async (c) => {
		const { id } = c.req.valid("param");
		await assertProject(id);
		const input = c.req.valid("json");
		const [member] = await db
			.insert(projectMembers)
			.values({ ...input, projectId: id })
			.onConflictDoUpdate({
				target: [projectMembers.projectId, projectMembers.email],
				set: { role: input.role, updatedAt: new Date() },
			})
			.returning();
		return c.json(member, 201);
	})

	// ── tasks ──
	.post("/:id/tasks", validate("param", idParam), validate("json", taskInput), async (c) => {
		const { id } = c.req.valid("param");
		await assertProject(id);
		const [row] = await db.select({ last: max(tasks.sortOrder) }).from(tasks).where(eq(tasks.projectId, id));
		const [task] = await db
			.insert(tasks)
			.values({
				...c.req.valid("json"),
				projectId: id,
				createdBy: c.get("authUser").email,
				sortOrder: row?.last == null ? 0 : row.last + 1,
			})
			.returning();
		await touchProject(id);
		return c.json({ ...task!, comments: [] }, 201);
	})

	// ── notes ──
	.post("/:id/notes", validate("param", idParam), validate("json", noteInput), async (c) => {
		const { id } = c.req.valid("param");
		await assertProject(id);
		const [note] = await db
			.insert(notes)
			.values({ ...c.req.valid("json"), projectId: id, authorEmail: c.get("authUser").email, authorRole: "owner" })
			.returning();
		await touchProject(id);
		return c.json(note, 201);
	});

export const memberRoutes = new Hono<Env>()
	.patch("/:id", validate("param", idParam), validate("json", memberPatch), async (c) => {
		const [member] = await db
			.update(projectMembers)
			.set({ ...c.req.valid("json"), updatedAt: new Date() })
			.where(eq(projectMembers.id, c.req.valid("param").id))
			.returning();
		if (!member) throw new HTTPException(404, { message: "Member not found" });
		return c.json(member);
	})
	// Takes effect at once: every portal request re-checks membership.
	.delete("/:id", validate("param", idParam), async (c) => {
		const [member] = await db.delete(projectMembers).where(eq(projectMembers.id, c.req.valid("param").id)).returning();
		if (!member) throw new HTTPException(404, { message: "Member not found" });
		return c.body(null, 204);
	});

export const taskRoutes = new Hono<Env>()
	.patch("/:id", validate("param", idParam), validate("json", taskPatch), async (c) => {
		const { id } = c.req.valid("param");
		const patch = c.req.valid("json");
		const doneFields =
			patch.done === undefined
				? {}
				: patch.done
					? { doneAt: new Date(), doneBy: c.get("authUser").email }
					: { doneAt: null, doneBy: null };
		const [task] = await db
			.update(tasks)
			.set({ ...patch, ...doneFields, updatedAt: new Date() })
			.where(eq(tasks.id, id))
			.returning({ projectId: tasks.projectId });
		if (!task) throw new HTTPException(404, { message: "Task not found" });
		await touchProject(task.projectId);
		return c.json(await findTask(id));
	})
	.delete("/:id", validate("param", idParam), async (c) => {
		const [task] = await db.delete(tasks).where(eq(tasks.id, c.req.valid("param").id)).returning();
		if (!task) throw new HTTPException(404, { message: "Task not found" });
		return c.body(null, 204);
	})
	.post("/:id/comments", validate("param", idParam), validate("json", commentInput), async (c) => {
		const { id } = c.req.valid("param");
		const task = await findTask(id);
		const [comment] = await db
			.insert(taskComments)
			.values({ taskId: id, body: c.req.valid("json").body, authorEmail: c.get("authUser").email, authorRole: "owner" })
			.returning();
		await touchProject(task.projectId);
		return c.json(comment, 201);
	});

export const commentRoutes = new Hono<Env>().delete("/:id", validate("param", idParam), async (c) => {
	const [comment] = await db.delete(taskComments).where(eq(taskComments.id, c.req.valid("param").id)).returning();
	if (!comment) throw new HTTPException(404, { message: "Comment not found" });
	return c.body(null, 204);
});

export const noteRoutes = new Hono<Env>()
	.patch("/:id", validate("param", idParam), validate("json", notePatch), async (c) => {
		const [note] = await db
			.update(notes)
			.set({ ...c.req.valid("json"), updatedAt: new Date() })
			.where(eq(notes.id, c.req.valid("param").id))
			.returning();
		if (!note) throw new HTTPException(404, { message: "Note not found" });
		return c.json(note);
	})
	.delete("/:id", validate("param", idParam), async (c) => {
		const [note] = await db.delete(notes).where(eq(notes.id, c.req.valid("param").id)).returning();
		if (!note) throw new HTTPException(404, { message: "Note not found" });
		return c.body(null, 204);
	});
