import { z } from "zod";
import { LINK_KINDS, PROJECT_STATUSES } from "./db/schema";

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
	sortOrder,
};

const projectFields = {
	groupId: z.uuid().nullable(),
	title: z.string().trim().min(1).max(160),
	description: z.string().trim().max(5_000),
	status: z.enum(PROJECT_STATUSES),
	tags,
	sortOrder,
};

export const linkInput = z.object({
	...linkFields,
	kind: linkFields.kind.default("other"),
	sortOrder: sortOrder.optional(),
});

export const linkPatch = z.strictObject(linkFields).partial();

export const projectInput = z.object({
	...projectFields,
	description: projectFields.description.default(""),
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
