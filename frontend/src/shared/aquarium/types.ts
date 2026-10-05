export const PROJECT_STATUSES = ["idea", "active", "paused", "done", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

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
export type LinkKind = (typeof LINK_KINDS)[number];

export interface AquariumUser {
	email: string;
	name?: string;
	avatarUrl?: string;
}

export interface Group {
	id: string;
	name: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectLink {
	id: string;
	projectId: string;
	label: string;
	url: string;
	kind: LinkKind;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface Project {
	id: string;
	groupId: string | null;
	title: string;
	description: string;
	status: ProjectStatus;
	tags: string[];
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	links: ProjectLink[];
}
