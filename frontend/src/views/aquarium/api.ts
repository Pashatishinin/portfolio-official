// Browser-side client for the Hono backend. Cookies travel with every call
// (credentials: "include"); an expired access token is refreshed once and the
// call retried, and a dead session sends the visitor to the login page.
import type { Group, LinkKind, Project, ProjectLink, ProjectStatus } from "../../shared/aquarium/types";

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
}

export interface NewProject {
	title: string;
	description: string;
	status: ProjectStatus;
	groupId: string | null;
	links: NewLink[];
}

export type ProjectPatch = Partial<Pick<Project, "title" | "description" | "status" | "groupId" | "tags">>;

const LOGIN = "/aquarium/login";

export function createApi(baseUrl: string) {
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
			window.location.href = LOGIN;
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
	};
}

export type AquariumApi = ReturnType<typeof createApi>;
