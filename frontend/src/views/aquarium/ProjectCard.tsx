import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { detectService, displayUrl, normalizeUrl } from "../../shared/aquarium/services";
import type { Group, Project, ProjectStatus } from "../../shared/aquarium/types";
import type { AquariumApi } from "./api";
import {
	Favicon,
	IconArrow,
	IconClose,
	IconEdit,
	IconTrash,
	STATUS_META,
	STATUS_ORDER,
	StatusDot,
	formatDate,
} from "./ui";

interface Props {
	project: Project;
	groups: Group[];
	api: AquariumApi;
	onChange: (project: Project) => void;
	onDelete: (id: string) => void;
	onError: (message: string) => void;
}

export default function ProjectCard({ project, groups, api, onChange, onDelete, onError }: Props) {
	const id = useId();
	const [mode, setMode] = useState<"view" | "edit">("view");
	const [adding, setAdding] = useState(false);
	const [busy, setBusy] = useState(false);
	const editButtonRef = useRef<HTMLButtonElement>(null);
	const linkButtonRef = useRef<HTMLButtonElement>(null);
	const prev = useRef({ mode, adding });

	// Return focus to the control that opened an inline form once it closes.
	useEffect(() => {
		if (prev.current.mode === "edit" && mode === "view") editButtonRef.current?.focus();
		if (prev.current.adding && !adding) linkButtonRef.current?.focus();
		prev.current = { mode, adding };
	}, [mode, adding]);

	const fail = (err: unknown, fallback: string) => onError(err instanceof Error ? err.message : fallback);

	async function removeLink(linkId: string, label: string) {
		if (!window.confirm(`Remove “${label}” from ${project.title}?`)) return;
		try {
			await api.deleteLink(linkId);
			onChange({ ...project, links: project.links.filter((l) => l.id !== linkId) });
		} catch (err) {
			fail(err, "Couldn’t remove the link.");
		}
	}

	async function removeProject() {
		const n = project.links.length;
		const what = n ? ` and its ${n} link${n === 1 ? "" : "s"}` : "";
		if (!window.confirm(`Delete “${project.title}”${what}? This can’t be undone.`)) return;
		setBusy(true);
		try {
			await api.deleteProject(project.id);
			onDelete(project.id);
		} catch (err) {
			setBusy(false);
			fail(err, "Couldn’t delete the project.");
		}
	}

	if (mode === "edit") {
		return (
			<EditCard
				project={project}
				groups={groups}
				api={api}
				onCancel={() => setMode("view")}
				onSaved={(p) => {
					onChange(p);
					setMode("view");
				}}
				onError={onError}
			/>
		);
	}

	return (
		<article className="aq-card" aria-labelledby={`${id}-t`} aria-busy={busy}>
			<div className="aq-card__meta aq-mono aq-mono--sm">
				<span className="aq-card__status">
					<StatusDot status={project.status} />
					{STATUS_META[project.status].label}
				</span>
				<span>
					Created <time dateTime={project.createdAt}>{formatDate(project.createdAt)}</time>
				</span>
			</div>

			<h3 className="aq-card__title aq-display" id={`${id}-t`}>
				{project.title}
			</h3>
			{project.description && <p className="aq-card__note">{project.description}</p>}

			{project.links.length > 0 && (
				<ul className="aq-card__links" aria-label={`${project.title} resources`}>
					{project.links.map((link) => {
						const service = detectService(link.url);
						return (
							<li key={link.id}>
								<a className="aq-res" href={link.url} target="_blank" rel="noopener noreferrer">
									<Favicon host={service?.host ?? null} letter={service?.name === "Website" ? undefined : service?.name} />
									<span className="aq-res__label">{link.label}</span>
									<span className="aq-res__domain">{displayUrl(link.url)}</span>
									<IconArrow />
									<span className="aq-visually-hidden">(opens in a new tab)</span>
								</a>
								<button
									type="button"
									className="aq-icon-btn aq-icon-btn--danger aq-res-remove"
									aria-label={`Remove ${link.label}`}
									onClick={() => removeLink(link.id, link.label)}
								>
									<IconClose size={12} />
								</button>
							</li>
						);
					})}
				</ul>
			)}

			{adding && (
				<AddLinkForm
					api={api}
					project={project}
					onAdded={(link) => {
						onChange({ ...project, links: [...project.links, link] });
						setAdding(false);
					}}
					onCancel={() => setAdding(false)}
				/>
			)}

			<div className="aq-card__foot">
				{adding ? (
					<span />
				) : (
					<button ref={linkButtonRef} type="button" className="aq-link-btn aq-mono aq-mono--sm" onClick={() => setAdding(true)}>
						+ Link
					</button>
				)}
				<div className="aq-card__tools">
					<button
						ref={editButtonRef}
						type="button"
						className="aq-icon-btn"
						aria-label={`Edit ${project.title}`}
						onClick={() => setMode("edit")}
					>
						<IconEdit />
					</button>
					<button
						type="button"
						className="aq-icon-btn aq-icon-btn--danger"
						aria-label={`Delete ${project.title}`}
						onClick={removeProject}
						disabled={busy}
					>
						<IconTrash />
					</button>
				</div>
			</div>
		</article>
	);
}

function AddLinkForm({
	api,
	project,
	onAdded,
	onCancel,
}: {
	api: AquariumApi;
	project: Project;
	onAdded: (link: Project["links"][number]) => void;
	onCancel: () => void;
}) {
	const [url, setUrl] = useState("");
	const [label, setLabel] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const service = detectService(url);

	async function submit(event: FormEvent) {
		event.preventDefault();
		const normalized = normalizeUrl(url);
		if (!normalized || !service) {
			setError("That doesn’t look like a web address.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const link = await api.addLink(project.id, {
				url: normalized,
				label: label.trim() || service.name,
				kind: service.kind,
			});
			onAdded(link);
		} catch (err) {
			setSaving(false);
			setError(err instanceof Error ? err.message : "Couldn’t add the link.");
		}
	}

	return (
		<form className="aq-add-link" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
			<div className="aq-add-link__row">
				<Favicon host={service?.host ?? null} letter={service?.name} />
				<input
					className="aq-input aq-input--mono"
					style={{ flex: 1, minWidth: 0 }}
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="Paste a URL"
					aria-label={`New link URL for ${project.title}`}
					inputMode="url"
					autoComplete="off"
					spellCheck={false}
					autoFocus
				/>
			</div>
			<div className="aq-add-link__row">
				<input
					className="aq-input"
					style={{ flex: 1, minWidth: 0, fontWeight: 500 }}
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					placeholder={service?.name ?? "Label"}
					aria-label="Label (optional)"
					maxLength={120}
				/>
				<button type="button" className="aq-link-btn aq-mono aq-mono--sm" onClick={onCancel}>
					Cancel
				</button>
				<button type="submit" className="aq-link-btn aq-mono aq-mono--sm" disabled={saving || !url.trim()}>
					{saving ? "Adding…" : "Add →"}
				</button>
			</div>
			{error && (
				<p className="aq-mono aq-mono--sm" role="alert" style={{ margin: "4px 0 0", color: "#7f2219" }}>
					{error}
				</p>
			)}
		</form>
	);
}

interface EditLink {
	key: string;
	/** Existing link id, or null for a row added in this edit. */
	id: string | null;
	label: string;
	url: string;
	labelTouched: boolean;
}

function EditCard({
	project,
	groups,
	api,
	onCancel,
	onSaved,
	onError,
}: {
	project: Project;
	groups: Group[];
	api: AquariumApi;
	onCancel: () => void;
	onSaved: (project: Project) => void;
	onError: (message: string) => void;
}) {
	const id = useId();
	const [title, setTitle] = useState(project.title);
	const [note, setNote] = useState(project.description);
	const [status, setStatus] = useState<ProjectStatus>(project.status);
	const [groupId, setGroupId] = useState(project.groupId ?? "");
	const [links, setLinks] = useState<EditLink[]>(() =>
		project.links.map((l) => ({ key: l.id, id: l.id, label: l.label, url: l.url, labelTouched: true })),
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const keySeq = useRef(0);

	const addRow = () =>
		setLinks((list) => [...list, { key: `new-${keySeq.current++}`, id: null, label: "", url: "", labelTouched: false }]);

	const updateRow = (key: string, patch: Partial<EditLink>) =>
		setLinks((list) =>
			list.map((l) => {
				if (l.key !== key) return l;
				const next = { ...l, ...patch };
				if (patch.url !== undefined && !next.labelTouched) next.label = detectService(patch.url)?.name ?? "";
				return next;
			}),
		);

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (!title.trim()) return;
		setError(null);

		// Validate every non-empty row before touching the API.
		const rows: { row: EditLink; url: string; label: string; kind: Project["links"][number]["kind"] }[] = [];
		for (const row of links) {
			if (!row.url.trim()) continue;
			const url = normalizeUrl(row.url);
			const service = url ? detectService(url) : null;
			if (!url || !service) {
				setError(`“${row.url}” doesn’t look like a web address.`);
				return;
			}
			rows.push({ row, url, label: row.label.trim() || service.name, kind: service.kind });
		}

		setSaving(true);
		try {
			const updated = await api.updateProject(project.id, {
				title: title.trim(),
				description: note.trim(),
				status,
				groupId: groupId || null,
			});

			const keptIds = new Set(rows.map((r) => r.row.id).filter(Boolean));
			const removed = project.links.filter((l) => !keptIds.has(l.id));
			await Promise.all(removed.map((l) => api.deleteLink(l.id)));

			const finalLinks: Project["links"] = [];
			for (const { row, url, label, kind } of rows) {
				if (row.id) {
					const original = project.links.find((l) => l.id === row.id)!;
					finalLinks.push(
						original.url === url && original.label === label
							? original
							: await api.updateLink(row.id, { url, label, kind }),
					);
				} else {
					finalLinks.push(await api.addLink(project.id, { url, label, kind }));
				}
			}

			onSaved({ ...updated, links: finalLinks });
		} catch (err) {
			setSaving(false);
			onError(err instanceof Error ? err.message : "Couldn’t save changes.");
		}
	}

	return (
		<form
			className="aq-card aq-card--editing"
			aria-labelledby={`${id}-h`}
			onSubmit={submit}
			onKeyDown={(e) => e.key === "Escape" && onCancel()}
		>
			<span className="aq-mono aq-mono--sm aq-muted" id={`${id}-h`}>
				Editing · created {formatDate(project.createdAt)}
			</span>
			<div className="aq-card__edit">
				<label className="aq-field">
					<span className="aq-mono aq-mono--sm">Title</span>
					<input
						className="aq-input aq-input--title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						maxLength={160}
						required
						autoFocus
					/>
				</label>
				<label className="aq-field">
					<span className="aq-mono aq-mono--sm">Note</span>
					<textarea className="aq-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000} />
				</label>
				<div className="aq-card__edit-row">
					<label className="aq-field">
						<span className="aq-mono aq-mono--sm">Status</span>
						<select className="aq-input" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
							{STATUS_ORDER.map((s) => (
								<option key={s} value={s}>
									{STATUS_META[s].label}
								</option>
							))}
						</select>
					</label>
					<label className="aq-field">
						<span className="aq-mono aq-mono--sm">Group</span>
						<select className="aq-input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
							<option value="">No group</option>
							{groups.map((g) => (
								<option key={g.id} value={g.id}>
									{g.name}
								</option>
							))}
						</select>
					</label>
				</div>

				<div className="aq-field" style={{ gap: 0 }}>
					<span className="aq-mono aq-mono--sm" style={{ marginBottom: 4 }}>
						Links
					</span>
					{links.map((row, i) => {
						const service = detectService(row.url);
						return (
							<div className="aq-draft-row aq-edit-link" key={row.key}>
								<Favicon host={service?.host ?? null} letter={service?.name === "Website" ? undefined : service?.name} />
								<div className="aq-edit-link__fields">
									<input
										className="aq-input"
										style={{ fontWeight: 500 }}
										value={row.label}
										onChange={(e) => updateRow(row.key, { label: e.target.value, labelTouched: e.target.value !== "" })}
										placeholder={service?.name ?? "Label"}
										aria-label={`Link ${i + 1} label`}
										maxLength={120}
									/>
									<input
										className="aq-input aq-input--mono"
										value={row.url}
										onChange={(e) => updateRow(row.key, { url: e.target.value })}
										placeholder="Paste a URL"
										aria-label={`Link ${i + 1} URL`}
										inputMode="url"
										autoComplete="off"
										spellCheck={false}
										autoFocus={row.id === null && row.url === "" && i === links.length - 1}
									/>
								</div>
								<button
									type="button"
									className="aq-icon-btn aq-icon-btn--danger"
									aria-label={`Remove link ${row.label || i + 1}`}
									onClick={() => setLinks((list) => list.filter((x) => x.key !== row.key))}
								>
									<IconClose />
								</button>
							</div>
						);
					})}
					<button type="button" className="aq-link-btn aq-mono aq-mono--sm" style={{ alignSelf: "flex-start" }} onClick={addRow}>
						+ Add link
					</button>
				</div>
			</div>

			{error && (
				<p className="aq-mono aq-mono--sm" role="alert" style={{ margin: "12px 0 0", color: "#7f2219" }}>
					{error}
				</p>
			)}

			<div className="aq-card__foot" style={{ paddingTop: 20 }}>
				<button type="button" className="aq-link-btn aq-mono aq-mono--sm" onClick={onCancel} disabled={saving}>
					Cancel
				</button>
				<button type="submit" className="aq-btn aq-btn--solid aq-mono aq-mono--sm" disabled={saving || !title.trim()}>
					{saving ? "Saving…" : "Save"}
				</button>
			</div>
		</form>
	);
}
