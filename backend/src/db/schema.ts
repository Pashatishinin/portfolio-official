import { relations } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

export const projectStatus = pgEnum("project_status", PROJECT_STATUSES);
export const linkKind = pgEnum("link_kind", LINK_KINDS);

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
		description: text("description").notNull().default(""),
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
		sortOrder: integer("sort_order").notNull().default(0),
		...timestamps,
	},
	(table) => [index("links_project_idx").on(table.projectId)],
);

export const groupsRelations = relations(groups, ({ many }) => ({
	projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
	links: many(links),
	group: one(groups, { fields: [projects.groupId], references: [groups.id] }),
}));

export const linksRelations = relations(links, ({ one }) => ({
	project: one(projects, { fields: [links.projectId], references: [projects.id] }),
}));

export type Group = typeof groups.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Link = typeof links.$inferSelect;
