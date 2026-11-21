import { z } from "zod";
import { ASSIGNEES, LINK_KINDS, MEMBER_ROLES, PROJECT_STATUSES, VISIBILITIES } from "./db/schema";

/** Only http(s) — blocks `javascript:` and friends, since these end up in <a href>. */
const httpUrl = z.url({ protocol: /^https?$/ }).max(2048);

const sortOrder = z.number().int().min(0).max(10_000);

const tags = z
	.array(z.string().trim().min(1).max(40))
	.max(20)
	.transform((list) => [...new Set(list)]);

// Field definitions without defaults — PATCH must never fill in values that
// weren't sent, so defaults are only added on the create schemas below.
const linkFields = {
	label: z.string().trim().min(1).max(120),
	url: httpUrl,
	kind: z.enum(LINK_KINDS),
	visibility: z.enum(VISIBILITIES),
	sortOrder,
};

const projectFields = {
	groupId: z.uuid().nullable(),
	title: z.string().trim().min(1).max(160),
	description: z.string().trim().max(5_000),
	clientSummary: z.string().trim().max(5_000),
	status: z.enum(PROJECT_STATUSES),
	tags,
	sortOrder,
};

export const linkInput = z.object({
	...linkFields,
	kind: linkFields.kind.default("other"),
	visibility: linkFields.visibility.default("internal"),
	sortOrder: sortOrder.optional(),
});

export const linkPatch = z.strictObject(linkFields).partial();

export const projectInput = z.object({
	...projectFields,
	description: projectFields.description.default(""),
	clientSummary: projectFields.clientSummary.default(""),
	status: projectFields.status.default("active"),
	tags: tags.default([]),
	groupId: z.uuid().nullable().default(null),
	sortOrder: sortOrder.optional(),
	links: z.array(linkInput).max(50).default([]),
});

export const projectPatch = z.strictObject(projectFields).partial();

export const projectListQuery = z.object({
	status: z.enum(PROJECT_STATUSES).optional(),
	q: z.string().trim().max(160).optional(),
});

export const idParam = z.object({ id: z.uuid() });

export const groupInput = z.object({
	name: z.string().trim().min(1).max(60),
	sortOrder: sortOrder.optional(),
});

export const groupPatch = z.strictObject({
	name: z.string().trim().min(1).max(60),
	sortOrder,
}).partial();

// ── client portal ────────────────────────────────────────────

const email = z.email().max(254).transform((value) => value.trim().toLowerCase());
const body = z.string().trim().min(1).max(5_000);
const taskTitle = z.string().trim().min(1).max(300);

export const memberInput = z.object({
	email,
	role: z.enum(MEMBER_ROLES).default("commenter"),
});

export const memberPatch = z.strictObject({ role: z.enum(MEMBER_ROLES) });

export const taskInput = z.object({
	title: taskTitle,
	assignee: z.enum(ASSIGNEES).default("owner"),
	visibility: z.enum(VISIBILITIES).default("client"),
});

export const taskPatch = z
	.strictObject({
		title: taskTitle,
		assignee: z.enum(ASSIGNEES),
		visibility: z.enum(VISIBILITIES),
		done: z.boolean(),
	})
	.partial();

export const commentInput = z.object({ body });

export const noteInput = z.object({
	body,
	visibility: z.enum(VISIBILITIES).default("client"),
});

export const notePatch = z.strictObject({ body, visibility: z.enum(VISIBILITIES) }).partial();

/** What a client may send — no visibility: everything a client writes is shared. */
export const portalTaskInput = z.object({
	title: taskTitle,
	assignee: z.enum(ASSIGNEES).default("owner"),
});
export const portalTaskPatch = z.strictObject({ done: z.boolean() });
export const portalNoteInput = z.object({ body });
export const portalNotePatch = z.strictObject({ body });
export const portalLinkInput = z.object({
	label: z.string().trim().min(1).max(120),
	url: httpUrl,
});
