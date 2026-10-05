import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Group, Project, ProjectStatus } from "../../shared/aquarium/types";
import { createApi, type AquariumApi } from "./api";
import NewProjectPanel from "./NewProjectPanel";
import ProjectCard from "./ProjectCard";
import { IconClose, IconSearch, STATUS_META, pad2 } from "./ui";

interface Props {
	apiUrl: string;
	initialGroups: Group[];
	initialProjects: Project[];
	loadError?: string | null;
}

type Filter = "all" | ProjectStatus;
const PRIMARY_FILTERS: ProjectStatus[] = ["active", "paused", "done"];
const UNGROUPED = "__ungrouped";

export default function Dashboard({ apiUrl, initialGroups, initialProjects, loadError = null }: Props) {
	const api = useMemo(() => createApi(apiUrl), [apiUrl]);

	const [groups, setGroups] = useState(initialGroups);
	const [projects, setProjects] = useState(initialProjects);
	const [filter, setFilter] = useState<Filter>("all");
	const [query, setQuery] = useState("");
	const [panel, setPanel] = useState<{ open: boolean; groupId: string | null; key: number }>({
		open: false,
		groupId: null,
		key: 0,
	});
	const [error, setError] = useState<string | null>(loadError);
	const toolbarRef = useRef<HTMLDivElement>(null);
	const newButtonRef = useRef<HTMLButtonElement>(null);

	const openPanel = (groupId: string | null = null) => {
		setPanel((p) => ({ open: true, groupId, key: p.key + 1 }));
		toolbarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};
	const closePanel = () => {
		setPanel((p) => ({ ...p, open: false }));
		// Hand focus back to the button that opened the form.
		requestAnimationFrame(() => newButtonRef.current?.focus());
	};

	// ── derived ─────────────────────────────────────────────
	const counts = useMemo(() => {
		const c: Record<string, number> = { all: projects.length };
		for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1;
		return c;
	}, [projects]);

	const filters: Filter[] = [
		"all",
		...PRIMARY_FILTERS,
		...(["idea", "archived"] as ProjectStatus[]).filter((s) => (counts[s] ?? 0) > 0),
	];
	if (filter !== "all" && !filters.includes(filter)) filters.push(filter);

	const q = query.trim().toLowerCase();
	const filtering = filter !== "all" || q !== "";

	const matches = (p: Project) => {
		if (filter !== "all" && p.status !== filter) return false;
		if (!q) return true;
		const hay = [p.title, p.description, ...p.tags, ...p.links.flatMap((l) => [l.label, l.url])]
			.join(" ")
			.toLowerCase();
		return hay.includes(q);
	};

	const sections = useMemo(() => {
		const known = new Set(groups.map((g) => g.id));
		const byGroup = new Map<string, Project[]>();
		for (const p of projects) {
			const key = p.groupId && known.has(p.groupId) ? p.groupId : UNGROUPED;
			const list = byGroup.get(key) ?? [];
			list.push(p);
			byGroup.set(key, list);
		}
		const list: { group: Group | null; all: Project[] }[] = groups.map((g) => ({ group: g, all: byGroup.get(g.id) ?? [] }));
		const ungrouped = byGroup.get(UNGROUPED) ?? [];
		if (ungrouped.length) list.push({ group: null, all: ungrouped });
		return list;
	}, [groups, projects]);

	const visibleSections = sections
		.map((s) => ({ ...s, items: s.all.filter(matches) }))
		.filter((s) => !filtering || s.items.length > 0);

	// ── mutations ───────────────────────────────────────────
	const reportError = (message: string) => setError(message);

	const replaceProject = (project: Project) => setProjects((list) => list.map((p) => (p.id === project.id ? project : p)));

	async function renameGroup(group: Group, name: string) {
		try {
			const updated = await api.renameGroup(group.id, name);
			setGroups((list) => list.map((g) => (g.id === updated.id ? updated : g)));
			return true;
		} catch (err) {
			reportError(err instanceof Error ? err.message : "Couldn’t rename the group.");
			return false;
		}
	}

	async function deleteGroup(group: Group, count: number) {
		const extra = count ? ` Its ${count} project${count === 1 ? "" : "s"} will stay, ungrouped.` : "";
		if (!window.confirm(`Delete the group “${group.name}”?${extra}`)) return;
		try {
			await api.deleteGroup(group.id);
			setGroups((list) => list.filter((g) => g.id !== group.id));
			setProjects((list) => list.map((p) => (p.groupId === group.id ? { ...p, groupId: null } : p)));
		} catch (err) {
			reportError(err instanceof Error ? err.message : "Couldn’t delete the group.");
		}
	}

	const nothingYet = projects.length === 0 && groups.length === 0;

	return (
		<>
			<section className="aq-hero" aria-labelledby="aq-title">
				<h1 className="aq-hero__title" id="aq-title">
					<span className="aq-italic">my private</span>
					<span className="aq-display">Aquarium</span>
				</h1>
				<dl className="aq-stats">
					<div>
						<dt className="aq-mono aq-mono--sm">Projects</dt>
						<dd>{pad2(projects.length)}</dd>
					</div>
					<div>
						<dt className="aq-mono aq-mono--sm">In progress</dt>
						<dd>{pad2(counts.active ?? 0)}</dd>
					</div>
				</dl>
			</section>

			<div className="aq-toolbar" ref={toolbarRef} style={{ scrollMarginTop: 24 }}>
				<div className="aq-filters aq-mono" role="group" aria-label="Filter by status">
					{filters.map((f) => (
						<button key={f} type="button" className="aq-filter aq-mono" aria-pressed={filter === f} onClick={() => setFilter(f)}>
							{f === "all" ? "All" : STATUS_META[f].label}
							<sup>{counts[f] ?? 0}</sup>
						</button>
					))}
				</div>
				<label className="aq-search">
					<IconSearch />
					<span className="aq-visually-hidden">Search projects</span>
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search projects, links, domains…"
					/>
				</label>
				<button
					ref={newButtonRef}
					type="button"
					className={`aq-btn aq-mono${panel.open ? " aq-btn--solid" : ""}`}
					aria-expanded={panel.open}
					onClick={() => (panel.open ? closePanel() : openPanel())}
				>
					<span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
						{panel.open ? "×" : "+"}
					</span>
					{panel.open ? "Close" : "New project"}
				</button>
			</div>

			{error && (
				<div className="aq-error" role="alert">
					<span>{error}</span>
					<button type="button" className="aq-icon-btn" aria-label="Dismiss" onClick={() => setError(null)}>
						<IconClose />
					</button>
				</div>
			)}

			{panel.open && (
				<NewProjectPanel
					key={panel.key}
					api={api}
					groups={groups}
					defaultGroupId={panel.groupId}
					onClose={closePanel}
					onCreated={(project, newGroup) => {
						if (newGroup) setGroups((list) => [...list, newGroup]);
						setProjects((list) => [project, ...list]);
						setFilter("all");
						setQuery("");
						closePanel();
					}}
				/>
			)}

			{nothingYet && !panel.open && (
				<div className="aq-empty" style={{ marginTop: 56 }}>
					<span className="aq-empty__title aq-italic">The tank is empty.</span>
					<p className="aq-empty__text">
						Add your first project with its repo, hosting, CMS and store links — and a group to keep it in, like
						SaaS or Client sites.
					</p>
					<button type="button" className="aq-btn aq-mono" onClick={() => openPanel()}>
						+ Add project
					</button>
				</div>
			)}

			{visibleSections.map((section, index) => (
				<GroupSection
					key={section.group?.id ?? UNGROUPED}
					index={index}
					group={section.group}
					total={section.all.length}
					items={section.items}
					filtering={filtering}
					groups={groups}
					api={api}
					onAdd={() => openPanel(section.group?.id ?? null)}
					onRename={(name) => (section.group ? renameGroup(section.group, name) : Promise.resolve(false))}
					onDelete={() => section.group && deleteGroup(section.group, section.all.length)}
					onChangeProject={replaceProject}
					onDeleteProject={(id) => setProjects((list) => list.filter((p) => p.id !== id))}
					onError={reportError}
				/>
			))}

			{filtering && visibleSections.length === 0 && !nothingYet && (
				<p className="aq-noresults aq-italic">Nothing swims by that name{q ? ` — “${query.trim()}”` : ""}.</p>
			)}
		</>
	);
}

function GroupSection({
	index,
	group,
	total,
	items,
	filtering,
	groups,
	api,
	onAdd,
	onRename,
	onDelete,
	onChangeProject,
	onDeleteProject,
	onError,
}: {
	index: number;
	group: Group | null;
	total: number;
	items: Project[];
	filtering: boolean;
	groups: Group[];
	api: AquariumApi;
	onAdd: () => void;
	onRename: (name: string) => Promise<boolean>;
	onDelete: () => void;
	onChangeProject: (project: Project) => void;
	onDeleteProject: (id: string) => void;
	onError: (message: string) => void;
}) {
	const name = group?.name ?? "Ungrouped";
	const headingId = `aq-group-${group?.id ?? "none"}`;
	const [renaming, setRenaming] = useState(false);
	const [draft, setDraft] = useState(name);
	const renameButtonRef = useRef<HTMLButtonElement>(null);
	const wasRenaming = useRef(false);

	useEffect(() => {
		if (wasRenaming.current && !renaming) renameButtonRef.current?.focus();
		wasRenaming.current = renaming;
	}, [renaming]);

	async function submitRename(event: FormEvent) {
		event.preventDefault();
		const next = draft.trim();
		if (!next || next === name) return setRenaming(false);
		if (await onRename(next)) setRenaming(false);
	}

	return (
		<section className="aq-group" aria-labelledby={headingId}>
			<div className="aq-group__head">
				<span className="aq-mono aq-muted">{pad2(index + 1)}</span>
				{renaming ? (
					<form className="aq-group__rename" onSubmit={submitRename} onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}>
						<input
							className="aq-input"
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							aria-label="Group name"
							maxLength={60}
							autoFocus
						/>
						<button type="submit" className="aq-link-btn aq-mono">
							Save
						</button>
						<button type="button" className="aq-link-btn aq-mono" onClick={() => setRenaming(false)}>
							Cancel
						</button>
					</form>
				) : (
					<>
						<h2 className="aq-group__name aq-display" id={headingId}>
							{name}
						</h2>
						<span className="aq-group__count aq-italic">
							{total === 0 ? "empty" : `${total} project${total === 1 ? "" : "s"}`}
						</span>
					</>
				)}
				<span className="aq-group__spacer" />
				{!renaming && (
					<div className="aq-group__actions aq-mono">
						<button type="button" className="aq-link-btn aq-mono" onClick={onAdd}>
							+ Add to {name}
						</button>
						{group && (
							<>
								<button
									ref={renameButtonRef}
									type="button"
									className="aq-link-btn aq-mono"
									onClick={() => {
										setDraft(name);
										setRenaming(true);
									}}
								>
									Rename
								</button>
								<button type="button" className="aq-link-btn aq-link-btn--danger aq-mono" onClick={onDelete}>
									Delete
								</button>
							</>
						)}
					</div>
				)}
			</div>

			{total === 0 && !filtering ? (
				<div className="aq-empty">
					<span className="aq-empty__title aq-italic">Nothing swimming here yet.</span>
					<button type="button" className="aq-btn aq-mono" onClick={onAdd}>
						+ Add project
					</button>
				</div>
			) : (
				<div className="aq-grid">
					{items.map((project) => (
						<ProjectCard
							key={project.id}
							project={project}
							groups={groups}
							api={api}
							onChange={onChangeProject}
							onDelete={onDeleteProject}
							onError={onError}
						/>
					))}
				</div>
			)}
		</section>
	);
}
