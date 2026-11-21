// Browser-side client for the Hono backend. Cookies travel with every call
// (credentials: "include"); an expired access token is refreshed once and the
// call retried, and a dead session sends the visitor to the login page.
import type {
	Assignee,
	Group,
	LinkKind,
	MemberRole,
	Note,
	PortalComment,
	PortalLink,
	PortalNote,
	PortalTask,
	Project,
	ProjectDetail,
	ProjectLink,
	ProjectMember,
	ProjectStatus,
	Task,
	TaskComment,
	Visibility,
} from "../../shared/aquarium/types";

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

export interface NewLink {
	label: string;
	url: string;
	kind: LinkKind;
	visibility?: Visibility;
}

export interface NewProject {
	title: string;
	description: string;
	status: ProjectStatus;
	groupId: string | null;
	links: NewLink[];
}

export type ProjectPatch = Partial<
	Pick<Project, "title" | "description" | "clientSummary" | "status" | "groupId" | "tags">
>;

export type TaskPatch = Partial<{ title: string; assignee: Assignee; visibility: Visibility; done: boolean }>;

/** Shared fetch wrapper: cookies, one silent refresh on 401, readable errors. */
function createRequester(baseUrl: string, loginPath: string) {
	const base = baseUrl.replace(/\/+$/, "");
	let refreshing: Promise<boolean> | null = null;

	const refresh = () => {
		refreshing ??= fetch(`${base}/api/auth/refresh`, { method: "POST", credentials: "include" })
			.then((res) => res.ok)
			.catch(() => false)
			.finally(() => {
				refreshing = null;
			});
		return refreshing;
	};

	async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const send = () =>
			fetch(`${base}${path}`, {
				method,
				credentials: "include",
				headers: body === undefined ? undefined : { "content-type": "application/json" },
				body: body === undefined ? undefined : JSON.stringify(body),
			});

		let res: Response;
		try {
			res = await send();
			if (res.status === 401 && (await refresh())) res = await send();
		} catch {
			throw new ApiError("Can’t reach the backend. Is it running?", 0);
		}

		if (res.status === 401) {
			window.location.href = loginPath;
			throw new ApiError("Session expired", 401);
		}
		if (!res.ok) {
			let message = `Request failed (${res.status})`;
			try {
				const data = (await res.json()) as { error?: string; issues?: { path: string; message: string }[] };
				if (data.issues?.length) {
					message = data.issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join(" · ");
				} else if (data.error) {
					message = data.error;
				}
			} catch {
				// non-JSON error body
			}
			throw new ApiError(message, res.status);
		}
		if (res.status === 204) return undefined as T;
		return (await res.json()) as T;
	}

	return request;
}

export function createApi(baseUrl: string) {
	const request = createRequester(baseUrl, "/aquarium/login");

	return {
		createProject: (input: NewProject) => request<Project>("POST", "/api/projects", input),
		updateProject: (id: string, patch: ProjectPatch) => request<Project>("PATCH", `/api/projects/${id}`, patch),
		deleteProject: (id: string) => request<void>("DELETE", `/api/projects/${id}`),

		addLink: (projectId: string, link: NewLink) =>
			request<ProjectLink>("POST", `/api/projects/${projectId}/links`, link),
		updateLink: (id: string, patch: Partial<NewLink>) => request<ProjectLink>("PATCH", `/api/links/${id}`, patch),
		deleteLink: (id: string) => request<void>("DELETE", `/api/links/${id}`),

		createGroup: (name: string) => request<Group>("POST", "/api/groups", { name }),
		renameGroup: (id: string, name: string) => request<Group>("PATCH", `/api/groups/${id}`, { name }),
		deleteGroup: (id: string) => request<void>("DELETE", `/api/groups/${id}`),

		// ── project page ──
		getDetail: (id: string) => request<ProjectDetail>("GET", `/api/projects/${id}/detail`),

		addMember: (projectId: string, email: string, role: MemberRole) =>
			request<ProjectMember>("POST", `/api/projects/${projectId}/members`, { email, role }),
		updateMember: (id: string, role: MemberRole) => request<ProjectMember>("PATCH", `/api/members/${id}`, { role }),
		removeMember: (id: string) => request<void>("DELETE", `/api/members/${id}`),

		addTask: (projectId: string, input: { title: string; assignee: Assignee; visibility: Visibility }) =>
			request<Task>("POST", `/api/projects/${projectId}/tasks`, input),
		updateTask: (id: string, patch: TaskPatch) => request<Task>("PATCH", `/api/tasks/${id}`, patch),
		deleteTask: (id: string) => request<void>("DELETE", `/api/tasks/${id}`),
		addComment: (taskId: string, body: string) => request<TaskComment>("POST", `/api/tasks/${taskId}/comments`, { body }),
		deleteComment: (id: string) => request<void>("DELETE", `/api/comments/${id}`),

		addNote: (projectId: string, body: string, visibility: Visibility) =>
			request<Note>("POST", `/api/projects/${projectId}/notes`, { body, visibility }),
		updateNote: (id: string, patch: { body?: string; visibility?: Visibility }) =>
			request<Note>("PATCH", `/api/notes/${id}`, patch),
		deleteNote: (id: string) => request<void>("DELETE", `/api/notes/${id}`),

		setLinkVisibility: (id: string, visibility: Visibility) =>
			request<ProjectLink>("PATCH", `/api/links/${id}`, { visibility }),
	};
}

export type AquariumApi = ReturnType<typeof createApi>;

/** The client portal's API. Only ever returns the shared slice of a project. */
export function createPortalApi(baseUrl: string) {
	const request = createRequester(baseUrl, "/portal/login");

	return {
		addLink: (projectId: string, label: string, url: string) =>
			request<PortalLink>("POST", `/api/portal/projects/${projectId}/links`, { label, url }),
		deleteLink: (id: string) => request<void>("DELETE", `/api/portal/links/${id}`),

		addTask: (projectId: string, title: string, assignee: Assignee) =>
			request<PortalTask>("POST", `/api/portal/projects/${projectId}/tasks`, { title, assignee }),
		setTaskDone: (id: string, done: boolean) => request<PortalTask>("PATCH", `/api/portal/tasks/${id}`, { done }),
		addComment: (taskId: string, body: string) =>
			request<PortalComment>("POST", `/api/portal/tasks/${taskId}/comments`, { body }),

		addNote: (projectId: string, body: string) => request<PortalNote>("POST", `/api/portal/projects/${projectId}/notes`, { body }),
		updateNote: (id: string, body: string) => request<PortalNote>("PATCH", `/api/portal/notes/${id}`, { body }),
		deleteNote: (id: string) => request<void>("DELETE", `/api/portal/notes/${id}`),
	};
}

export type PortalApi = ReturnType<typeof createPortalApi>;
