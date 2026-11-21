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

export const VISIBILITIES = ["internal", "client"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export type MemberRole = "commenter" | "viewer";
export type Assignee = "owner" | "client";
export type Role = "owner" | "client";

export interface AquariumUser {
	email: string;
	name?: string;
	avatarUrl?: string;
	role: Role;
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
	visibility: Visibility;
	/** null = added by the owner; otherwise the client's email. */
	addedBy: string | null;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface Project {
	id: string;
	groupId: string | null;
	title: string;
	description: string;
	clientSummary: string;
	status: ProjectStatus;
	tags: string[];
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	links: ProjectLink[];
	/** Light summaries for the dashboard card. */
	members: { id: string; email: string }[];
	tasks: { id: string; done: boolean }[];
}

// ── owner's project page ─────────────────────────────────────

export interface ProjectMember {
	id: string;
	projectId: string;
	email: string;
	role: MemberRole;
	lastSeenAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface TaskComment {
	id: string;
	taskId: string;
	authorEmail: string;
	authorRole: Role;
	body: string;
	createdAt: string;
	updatedAt: string;
}

export interface Task {
	id: string;
	projectId: string;
	title: string;
	assignee: Assignee;
	visibility: Visibility;
	done: boolean;
	doneAt: string | null;
	doneBy: string | null;
	createdBy: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	comments: TaskComment[];
}

export interface Note {
	id: string;
	projectId: string;
	authorEmail: string;
	authorRole: Role;
	body: string;
	visibility: Visibility;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectDetail extends Omit<Project, "members" | "tasks"> {
	members: ProjectMember[];
	tasks: Task[];
	notes: Note[];
}

// ── client portal (shapes from /api/portal — already filtered) ──

export interface PortalLink {
	id: string;
	label: string;
	url: string;
	kind: LinkKind;
	fromClient: boolean;
	addedBy: string | null;
	mine: boolean;
	createdAt: string;
}

export interface PortalComment {
	id: string;
	body: string;
	authorRole: Role;
	author: string;
	mine: boolean;
	createdAt: string;
}

export interface PortalTask {
	id: string;
	title: string;
	assignee: Assignee;
	done: boolean;
	doneAt: string | null;
	doneBy: string | null;
	createdAt: string;
	comments: PortalComment[];
}

export interface PortalNote {
	id: string;
	body: string;
	authorRole: Role;
	author: string;
	mine: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface PortalProject {
	id: string;
	title: string;
	clientSummary: string;
	status: ProjectStatus;
	updatedAt: string;
	viewer: { email: string; role: Role; canWrite: boolean };
	members: string[];
	links: PortalLink[];
	tasks: PortalTask[];
	notes: PortalNote[];
}

export interface PortalProjectSummary {
	id: string;
	title: string;
	clientSummary: string;
	status: ProjectStatus;
	updatedAt: string;
	linkCount: number;
	taskCount: number;
	openTaskCount: number;
}
