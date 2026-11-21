// The client portal API. Everything here is filtered on the server: internal
// links, tasks and notes and the private description never leave this file,
// so nothing a client could do in the browser can reveal them.
//
// Access: a client sees a project only while their email is in
// project_members for it (re-checked on every request). The owner may open
// any project here read-only — that is the "View as client" preview.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth, roleOf, type AuthUser, type Role } from "../auth";
import { db } from "../db/client";
import {
	links,
	notes,
	projectMembers,
	projects,
	taskComments,
	tasks,
	type Link,
	type Note,
	type Task,
	type TaskComment,
} from "../db/schema";
import { env } from "../env";
import { inBackground, mailHtml, sendMail } from "../mail";
import {
	commentInput,
	idParam,
	portalLinkInput,
	portalNoteInput,
	portalNotePatch,
	portalTaskInput,
	portalTaskPatch,
} from "../validation";
import { validate } from "../validator";

type Env = { Variables: { authUser: AuthUser; viewer: Viewer } };

interface Viewer {
	email: string;
	role: Role;
}

/** How the owner appears to clients. Their email is never sent to the portal. */
const OWNER_LABEL = "Pavlo";

const notFound = () => new HTTPException(404, { message: "Project not found" });

/**
 * Resolves what the viewer may do on a project. Unknown project and
 * "not invited" look identical (404), so ids can't be probed.
 */
async function access(viewer: Viewer, projectId: string) {
	if (viewer.role === "owner") {
		const exists = await db.query.projects.findFirst({ where: eq(projects.id, projectId), columns: { id: true } });
		if (!exists) throw notFound();
		return { canWrite: false, memberId: null as string | null };
	}
	const member = await db.query.projectMembers.findFirst({
		where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.email, viewer.email)),
		columns: { id: true, role: true },
	});
	if (!member) throw notFound();
	return { canWrite: member.role === "commenter", memberId: member.id };
}

async function writeAccess(viewer: Viewer, projectId: string) {
	const result = await access(viewer, projectId);
	if (!result.canWrite) throw new HTTPException(403, { message: "Read-only access" });
	return result;
}

// ── serializers: the ONLY shapes that reach a client ──

const labelFor = (role: "owner" | "client", email: string) => (role === "owner" ? OWNER_LABEL : email);
const doneLabel = (email: string | null) => (!email ? null : env.OWNER_EMAILS.includes(email) ? OWNER_LABEL : email);

const toLink = (link: Link, viewer: Viewer) => ({
	id: link.id,
	label: link.label,
	url: link.url,
	kind: link.kind,
	fromClient: link.addedBy !== null,
	addedBy: link.addedBy,
	mine: link.addedBy !== null && link.addedBy === viewer.email,
	createdAt: link.createdAt,
});

const toComment = (comment: TaskComment, viewer: Viewer) => ({
	id: comment.id,
	body: comment.body,
	authorRole: comment.authorRole,
	author: labelFor(comment.authorRole, comment.authorEmail),
	mine: comment.authorRole === "client" && comment.authorEmail === viewer.email,
	createdAt: comment.createdAt,
});

const toTask = (task: Task & { comments: TaskComment[] }, viewer: Viewer) => ({
	id: task.id,
	title: task.title,
	assignee: task.assignee,
	done: task.done,
	doneAt: task.doneAt,
	doneBy: doneLabel(task.doneBy),
	createdAt: task.createdAt,
	comments: task.comments.map((comment) => toComment(comment, viewer)),
});

const toNote = (note: Note, viewer: Viewer) => ({
	id: note.id,
	body: note.body,
	authorRole: note.authorRole,
	author: labelFor(note.authorRole, note.authorEmail),
	mine: note.authorRole === "client" && note.authorEmail === viewer.email,
	createdAt: note.createdAt,
	updatedAt: note.updatedAt,
});

// ── notifications to the owner ──

function notifyOwner(c: Context, projectId: string, what: string, text: string) {
	const to = env.OWNER_EMAILS[0];
	if (!to) return;
	const viewer = c.get("viewer") as Viewer;
	inBackground(
		c,
		(async () => {
			const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId), columns: { title: true } });
			const title = project?.title ?? "a project";
			const url = `${env.FRONTEND_URL}/aquarium/p/${projectId}`;
			await sendMail({
				to,
				subject: `${viewer.email} ${what} — ${title}`,
				text: `${viewer.email} ${what} on ${title}:\n\n${text}\n\n${url}`,
				html: mailHtml([`${viewer.email} ${what} on ${title}:`, text], { label: "Open project", url }),
			});
		})(),
	);
}

export const portalRoutes = new Hono<Env>()
	.use(auth.middleware())
	.use(async (c, next) => {
		const user = c.get("authUser");
		c.set("viewer", { email: user.email.toLowerCase(), role: roleOf(user) });
		await next();
	})

	.get("/projects", async (c) => {
		const viewer = c.get("viewer");
		let ids: string[] | null = null;
		if (viewer.role === "client") {
			const rows = await db
				.select({ projectId: projectMembers.projectId })
				.from(projectMembers)
				.where(eq(projectMembers.email, viewer.email));
			ids = rows.map((r) => r.projectId);
			if (!ids.length) return c.json({ items: [] });
		}
		const rows = await db.query.projects.findMany({
			where: ids ? inArray(projects.id, ids) : undefined,
			orderBy: [desc(projects.updatedAt)],
			columns: { id: true, title: true, clientSummary: true, status: true, updatedAt: true },
			with: {
				links: { where: eq(links.visibility, "client"), columns: { id: true } },
				tasks: { where: eq(tasks.visibility, "client"), columns: { done: true } },
			},
		});
		return c.json({
			items: rows.map(({ links: shared, tasks: list, ...project }) => ({
				...project,
				linkCount: shared.length,
				taskCount: list.length,
				openTaskCount: list.filter((t) => !t.done).length,
			})),
		});
	})

	.get("/projects/:id", validate("param", idParam), async (c) => {
		const viewer = c.get("viewer");
		const { id } = c.req.valid("param");
		const { canWrite, memberId } = await access(viewer, id);

		const project = await db.query.projects.findFirst({
			where: eq(projects.id, id),
			columns: { id: true, title: true, clientSummary: true, status: true, updatedAt: true },
			with: {
				links: { where: eq(links.visibility, "client"), orderBy: [asc(links.sortOrder), asc(links.createdAt)] },
				tasks: {
					where: eq(tasks.visibility, "client"),
					orderBy: [asc(tasks.sortOrder), asc(tasks.createdAt)],
					with: { comments: { orderBy: [asc(taskComments.createdAt)] } },
				},
				notes: { where: eq(notes.visibility, "client"), orderBy: [desc(notes.createdAt)] },
				members: { columns: { email: true }, orderBy: [asc(projectMembers.createdAt)] },
			},
		});
		if (!project) throw notFound();

		if (memberId) {
			inBackground(
				c,
				db.update(projectMembers).set({ lastSeenAt: new Date() }).where(eq(projectMembers.id, memberId)),
			);
		}

		return c.json({
			id: project.id,
			title: project.title,
			clientSummary: project.clientSummary,
			status: project.status,
			updatedAt: project.updatedAt,
			viewer: { email: viewer.email, role: viewer.role, canWrite },
			members: project.members.map((m) => m.email),
			links: project.links.map((link) => toLink(link, viewer)),
			tasks: project.tasks.map((task) => toTask(task, viewer)),
			notes: project.notes.map((note) => toNote(note, viewer)),
		});
	})

	// ── links the client shares ──
	.post("/projects/:id/links", validate("param", idParam), validate("json", portalLinkInput), async (c) => {
		const viewer = c.get("viewer");
		const { id } = c.req.valid("param");
		await writeAccess(viewer, id);
		const [link] = await db
			.insert(links)
			.values({ ...c.req.valid("json"), projectId: id, kind: "other", visibility: "client", addedBy: viewer.email })
			.returning();
		await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, id));
		notifyOwner(c, id, "shared a link", `${link!.label}: ${link!.url}`);
		return c.json(toLink(link!, viewer), 201);
	})

	.delete("/links/:id", validate("param", idParam), async (c) => {
		const viewer = c.get("viewer");
		const link = await db.query.links.findFirst({ where: eq(links.id, c.req.valid("param").id) });
		// Clients may remove only the links they added themselves.
		if (!link || link.addedBy !== viewer.email) throw new HTTPException(404, { message: "Link not found" });
		await writeAccess(viewer, link.projectId);
		await db.delete(links).where(eq(links.id, link.id));
		return c.body(null, 204);
	})

	// ── tasks ──
	.post("/projects/:id/tasks", validate("param", idParam), validate("json", portalTaskInput), async (c) => {
		const viewer = c.get("viewer");
		const { id } = c.req.valid("param");
		await writeAccess(viewer, id);
		const input = c.req.valid("json");
		const [task] = await db
			.insert(tasks)
			.values({ ...input, projectId: id, visibility: "client", createdBy: viewer.email, sortOrder: 10_000 })
			.returning();
		await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, id));
		notifyOwner(c, id, "added a task", input.title);
		return c.json(toTask({ ...task!, comments: [] }, viewer), 201);
	})

	.patch("/tasks/:id", validate("param", idParam), validate("json", portalTaskPatch), async (c) => {
		const viewer = c.get("viewer");
		const id = c.req.valid("param").id;
		const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
		if (!task || task.visibility !== "client") throw new HTTPException(404, { message: "Task not found" });
		await writeAccess(viewer, task.projectId);

		const { done } = c.req.valid("json");
		await db
			.update(tasks)
			.set({ done, doneAt: done ? new Date() : null, doneBy: done ? viewer.email : null, updatedAt: new Date() })
			.where(eq(tasks.id, id));
		await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, task.projectId));
		if (done) notifyOwner(c, task.projectId, "completed a task", task.title);

		const fresh = await db.query.tasks.findFirst({
			where: eq(tasks.id, id),
			with: { comments: { orderBy: [asc(taskComments.createdAt)] } },
		});
		return c.json(toTask(fresh!, viewer));
	})

	.post("/tasks/:id/comments", validate("param", idParam), validate("json", commentInput), async (c) => {
		const viewer = c.get("viewer");
		const task = await db.query.tasks.findFirst({ where: eq(tasks.id, c.req.valid("param").id) });
		if (!task || task.visibility !== "client") throw new HTTPException(404, { message: "Task not found" });
		await writeAccess(viewer, task.projectId);

		const { body } = c.req.valid("json");
		const [comment] = await db
			.insert(taskComments)
			.values({ taskId: task.id, body, authorEmail: viewer.email, authorRole: "client" })
			.returning();
		notifyOwner(c, task.projectId, `commented on “${task.title}”`, body);
		return c.json(toComment(comment!, viewer), 201);
	})

	// ── notes ──
	.post("/projects/:id/notes", validate("param", idParam), validate("json", portalNoteInput), async (c) => {
		const viewer = c.get("viewer");
		const { id } = c.req.valid("param");
		await writeAccess(viewer, id);
		const { body } = c.req.valid("json");
		const [note] = await db
			.insert(notes)
			.values({ projectId: id, body, visibility: "client", authorEmail: viewer.email, authorRole: "client" })
			.returning();
		await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, id));
		notifyOwner(c, id, "left a note", body);
		return c.json(toNote(note!, viewer), 201);
	})

	.patch("/notes/:id", validate("param", idParam), validate("json", portalNotePatch), async (c) => {
		const viewer = c.get("viewer");
		const note = await ownNote(viewer, c.req.valid("param").id);
		const [updated] = await db
			.update(notes)
			.set({ body: c.req.valid("json").body, updatedAt: new Date() })
			.where(eq(notes.id, note.id))
			.returning();
		return c.json(toNote(updated!, viewer));
	})

	.delete("/notes/:id", validate("param", idParam), async (c) => {
		const viewer = c.get("viewer");
		const note = await ownNote(viewer, c.req.valid("param").id);
		await db.delete(notes).where(eq(notes.id, note.id));
		return c.body(null, 204);
	});

/** A client may change only notes they wrote, on a project they still belong to. */
async function ownNote(viewer: Viewer, id: string) {
	const note = await db.query.notes.findFirst({ where: eq(notes.id, id) });
	if (!note || note.authorRole !== "client" || note.authorEmail !== viewer.email || note.visibility !== "client") {
		throw new HTTPException(404, { message: "Note not found" });
	}
	await writeAccess(viewer, note.projectId);
	return note;
}
