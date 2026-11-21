import { relations } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const PROJECT_STATUSES = ["idea", "active", "paused", "done", "archived"] as const;
export const LINK_KINDS = [
	"github",
	"deploy",
	"figma",
	"notion",
	"docs",
	"design",
	"drive",
	"other",
] as const;

/** internal = only the owner sees it; client = everyone invited to the project sees it. */
export const VISIBILITIES = ["internal", "client"] as const;
/** commenter = can add notes, tasks, comments and links; viewer = read-only. */
export const MEMBER_ROLES = ["commenter", "viewer"] as const;
/** Who a task is for. */
export const ASSIGNEES = ["owner", "client"] as const;
/** Who wrote a note or comment — stored so the API never has to guess from the email. */
export const AUTHOR_ROLES = ["owner", "client"] as const;

export const projectStatus = pgEnum("project_status", PROJECT_STATUSES);
export const linkKind = pgEnum("link_kind", LINK_KINDS);
export const visibility = pgEnum("visibility", VISIBILITIES);
export const memberRole = pgEnum("member_role", MEMBER_ROLES);
export const assignee = pgEnum("assignee", ASSIGNEES);
export const authorRole = pgEnum("author_role", AUTHOR_ROLES);

const timestamps = {
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdateFn(() => new Date()),
};

export const groups = pgTable("groups", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	sortOrder: integer("sort_order").notNull().default(0),
	...timestamps,
});

export const projects = pgTable(
	"projects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Deleting a group keeps its projects; they just become ungrouped.
		groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
		title: text("title").notNull(),
		/** Private note — never sent to clients. */
		description: text("description").notNull().default(""),
		/** What invited clients read at the top of their portal page. */
		clientSummary: text("client_summary").notNull().default(""),
		status: projectStatus("status").notNull().default("active"),
		tags: text("tags").array().notNull().default([]),
		sortOrder: integer("sort_order").notNull().default(0),
		...timestamps,
	},
	(table) => [
		index("projects_status_idx").on(table.status),
		index("projects_group_idx").on(table.groupId),
	],
);

export const links = pgTable(
	"links",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		label: text("label").notNull(),
		url: text("url").notNull(),
		kind: linkKind("kind").notNull().default("other"),
		// Safe default: a new link is private until it is explicitly shared.
		visibility: visibility("visibility").notNull().default("internal"),
		/** null = added by the owner; otherwise the email of the client who added it in the portal. */
		addedBy: text("added_by"),
		sortOrder: integer("sort_order").notNull().default(0),
		...timestamps,
	},
	(table) => [index("links_project_idx").on(table.projectId)],
);

export const projectMembers = pgTable(
	"project_members",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		/** Always stored lower-case. */
		email: text("email").notNull(),
		role: memberRole("role").notNull().default("commenter"),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
		...timestamps,
	},
	(table) => [
		uniqueIndex("project_members_project_email_uq").on(table.projectId, table.email),
		index("project_members_email_idx").on(table.email),
	],
);

export const tasks = pgTable(
	"tasks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		assignee: assignee("assignee").notNull().default("owner"),
		visibility: visibility("visibility").notNull().default("client"),
		done: boolean("done").notNull().default(false),
		doneAt: timestamp("done_at", { withTimezone: true }),
		doneBy: text("done_by"),
		createdBy: text("created_by").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		...timestamps,
	},
	(table) => [index("tasks_project_idx").on(table.projectId)],
);

export const taskComments = pgTable(
	"task_comments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		taskId: uuid("task_id")
			.notNull()
			.references(() => tasks.id, { onDelete: "cascade" }),
		authorEmail: text("author_email").notNull(),
		authorRole: authorRole("author_role").notNull(),
		body: text("body").notNull(),
		...timestamps,
	},
	(table) => [index("task_comments_task_idx").on(table.taskId)],
);

export const notes = pgTable(
	"notes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		authorEmail: text("author_email").notNull(),
		authorRole: authorRole("author_role").notNull(),
		body: text("body").notNull(),
		visibility: visibility("visibility").notNull().default("client"),
		...timestamps,
	},
	(table) => [index("notes_project_idx").on(table.projectId)],
);

export const groupsRelations = relations(groups, ({ many }) => ({
	projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
	links: many(links),
	members: many(projectMembers),
	tasks: many(tasks),
	notes: many(notes),
	group: one(groups, { fields: [projects.groupId], references: [groups.id] }),
}));

export const linksRelations = relations(links, ({ one }) => ({
	project: one(projects, { fields: [links.projectId], references: [projects.id] }),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
	project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
	project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
	comments: many(taskComments),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
	task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
	project: one(projects, { fields: [notes.projectId], references: [projects.id] }),
}));

export type Group = typeof groups.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Link = typeof links.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;
export type Note = typeof notes.$inferSelect;
