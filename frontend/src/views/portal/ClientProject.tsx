import { useId, useMemo, useState, type FormEvent } from "react";
import { detectService, displayUrl, normalizeUrl } from "../../shared/aquarium/services";
import { formatWhen, timeAgo } from "../../shared/aquarium/time";
import type { Assignee, PortalNote, PortalProject, PortalTask } from "../../shared/aquarium/types";
import { createPortalApi } from "../aquarium/api";
import { Avatar, IconComment, errorText } from "../aquarium/icons";
import { Linkify } from "../aquarium/Linkify";
import { CommentForm, FilterTabs } from "../aquarium/ProjectPage";
import { Favicon, IconClose, STATUS_META, StatusDot } from "../aquarium/ui";

interface Props {
	apiUrl: string;
	initial: PortalProject;
}

/**
 * The client's view of one project. Everything in `initial` was already
 * filtered by the server to the shared slice — there is nothing private here
 * to hide.
 */
export default function ClientProject({ apiUrl, initial }: Props) {
	const api = useMemo(() => createPortalApi(apiUrl), [apiUrl]);
	const [project, setProject] = useState(initial);
	const [error, setError] = useState<string | null>(null);
	const { canWrite } = project.viewer;
	const fail = (err: unknown, fallback: string) => setError(errorText(err, fallback));

	const fromOwner = project.links.filter((l) => !l.fromClient);

	return (
		<>
			<section className="aq-page-hero">
				<h1 className="aq-hero__title">
					<span className="aq-italic">your project with Pavlo</span>
					<span className="aq-display">{project.title}</span>
				</h1>
				<dl className="aq-stats">
					<div>
						<dt className="aq-mono aq-mono--sm">Status</dt>
						<dd style={{ fontSize: 28, display: "flex", alignItems: "center", gap: 10 }}>
							<StatusDot status={project.status} />
							{STATUS_META[project.status].label}
						</dd>
					</div>
					<div>
						<dt className="aq-mono aq-mono--sm">Updated</dt>
						<dd style={{ fontSize: 28 }} suppressHydrationWarning>
							{timeAgo(project.updatedAt)}
						</dd>
					</div>
				</dl>
			</section>

			{project.clientSummary && <p className="aq-summary"><Linkify text={project.clientSummary} /></p>}

			{!canWrite && (
				<p className="aq-mono aq-muted" style={{ marginTop: 24 }}>
					{project.viewer.role === "owner" ? "Preview — read-only" : "You have view-only access"}
				</p>
			)}

			{error && (
				<div className="aq-error" role="alert">
					<span>{error}</span>
					<button type="button" className="aq-icon-btn" aria-label="Dismiss" onClick={() => setError(null)}>
						<IconClose />
					</button>
				</div>
			)}

			{/* ── links ── */}
			<section aria-labelledby="c-links" style={{ marginTop: 72 }}>
				<div className="aq-sec__head">
					<h2 id="c-links" className="aq-sec__title aq-display">
						Links
					</h2>
					<span className="aq-sec__count aq-italic">from Pavlo</span>
				</div>
				{fromOwner.length === 0 ? (
					<p className="aq-empty-line" style={{ paddingLeft: 0 }}>
						No links yet.
					</p>
				) : (
					<ul className="aq-lcards aq-list">
						{fromOwner.map((link) => {
							const service = detectService(link.url);
							return (
								<li key={link.id} style={{ display: "flex" }}>
									<a className="aq-lcard" style={{ flex: 1 }} href={link.url} target="_blank" rel="noopener noreferrer">
										<span className="aq-lcard__top aq-mono aq-mono--sm">
											<Favicon host={service?.host ?? null} letter={link.label} size="lg" />
											<span>{service?.name ?? "Link"} ↗</span>
										</span>
										<span>
											<span className="aq-lcard__label aq-display" style={{ display: "block" }}>
												{link.label}
											</span>
											<span className="aq-lcard__url" style={{ display: "block" }}>
												{displayUrl(link.url)}
											</span>
											<span className="aq-visually-hidden">(opens in a new tab)</span>
										</span>
									</a>
								</li>
							);
						})}
					</ul>
				)}

				<ClientLinks project={project} canWrite={canWrite} api={api} setProject={setProject} fail={fail} />
			</section>

			{/* ── tasks / notes / contact ── */}
			<div className="aq-cols">
				<div className="aq-cols__main">
					<ClientTasks project={project} canWrite={canWrite} api={api} setProject={setProject} fail={fail} />
					<ClientNotes project={project} canWrite={canWrite} api={api} setProject={setProject} fail={fail} />
				</div>
				<aside className="aq-cols__aside" aria-label="Project contacts">
					<section className="aq-side aq-side--strong" aria-labelledby="contact-h">
						<h2 id="contact-h" className="aq-side__title">
							<span className="aq-italic">your</span>
							<span className="aq-display">Contact</span>
						</h2>
						<div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
							<Avatar label="P" />
							<div>
								<div style={{ fontWeight: 500 }}>Pavlo Tishynin</div>
								<div className="aq-member__meta">Design &amp; development</div>
							</div>
						</div>
						<p className="aq-side__text">Write a note or comment on a task — Pavlo sees it in the project.</p>
					</section>
					<section className="aq-side" aria-labelledby="members-h">
						<h2 id="members-h" className="aq-side__label aq-mono">
							On this project
						</h2>
						<ul className="aq-plain-list">
							{project.members.map((email) => (
								<li key={email}>
									{email}
									{email === project.viewer.email && <span className="aq-muted"> · you</span>}
								</li>
							))}
						</ul>
					</section>
				</aside>
			</div>
		</>
	);
}

type Api = ReturnType<typeof createPortalApi>;
interface PartProps {
	project: PortalProject;
	canWrite: boolean;
	api: Api;
	setProject: (fn: (p: PortalProject) => PortalProject) => void;
	fail: (err: unknown, fallback: string) => void;
}

// ── links the client shares ─────────────────────────────────

function ClientLinks({ project, canWrite, api, setProject, fail }: PartProps) {
	const mine = project.links.filter((l) => l.fromClient);
	const [label, setLabel] = useState("");
	const [url, setUrl] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	if (!canWrite && mine.length === 0) return null;

	async function add(event: FormEvent) {
		event.preventDefault();
		const normalized = normalizeUrl(url);
		if (!normalized) {
			setFormError("That doesn’t look like a web address.");
			return;
		}
		setSaving(true);
		setFormError(null);
		try {
			const link = await api.addLink(project.id, label.trim() || detectService(normalized)?.name || "Link", normalized);
			setProject((p) => ({ ...p, links: [...p.links, link] }));
			setLabel("");
			setUrl("");
		} catch (err) {
			setFormError(errorText(err, "Couldn’t add the link."));
		} finally {
			setSaving(false);
		}
	}

	async function remove(id: string, name: string) {
		if (!window.confirm(`Remove “${name}”?`)) return;
		try {
			await api.deleteLink(id);
			setProject((p) => ({ ...p, links: p.links.filter((l) => l.id !== id) }));
		} catch (err) {
			fail(err, "Couldn’t remove the link.");
		}
	}

	return (
		<div className="aq-box aq-box--shared aq-yours">
			<div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "6px 16px" }}>
				<h3 className="aq-side__title" style={{ margin: 0 }}>
					<span className="aq-italic">your</span>
					<span className="aq-display">Links</span>
				</h3>
				<span className="aq-yours__intro">Share files, texts or accesses with Pavlo — he sees them right away.</span>
			</div>

			{mine.length > 0 && (
				<ul className="aq-list" style={{ marginTop: 16, borderTop: "1px solid var(--hair)" }}>
					{mine.map((link) => {
						const service = detectService(link.url);
						return (
							<li key={link.id} className="aq-row" style={{ paddingLeft: 0 }}>
								<Favicon host={service?.host ?? null} letter={link.label} size="lg" />
								<a className="aq-row__link" href={link.url} target="_blank" rel="noopener noreferrer">
									<span className="aq-row__label">{link.label}</span>
									<span className="aq-row__url">{displayUrl(link.url)}</span>
								</a>
								<span className="aq-mono aq-mono--sm aq-muted" suppressHydrationWarning>
									{link.mine ? timeAgo(link.createdAt) : link.addedBy}
								</span>
								{link.mine && canWrite && (
									<button type="button" className="aq-icon-btn aq-icon-btn--danger" aria-label={`Remove ${link.label}`} onClick={() => remove(link.id, link.label)}>
										<IconClose />
									</button>
								)}
							</li>
						);
					})}
				</ul>
			)}

			{canWrite && (
				<form className="aq-addbar" onSubmit={add}>
					<label className="aq-field aq-narrow" style={{ flexBasis: 220 }}>
						<span className="aq-mono aq-mono--sm">Name</span>
						<input className="aq-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Photos for the team page" maxLength={120} />
					</label>
					<label className="aq-field aq-grow">
						<span className="aq-mono aq-mono--sm">Link</span>
						<input
							className="aq-input aq-input--mono"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="drive.google.com/…"
							inputMode="url"
							autoComplete="off"
							spellCheck={false}
						/>
					</label>
					<button type="submit" className="aq-btn aq-btn--solid aq-mono aq-mono--sm" disabled={saving || !url.trim()}>
						{saving ? "Adding…" : "+ Add link"}
					</button>
					{formError && (
						<p className="aq-form-error" role="alert">
							{formError}
						</p>
					)}
				</form>
			)}
		</div>
	);
}

// ── tasks ───────────────────────────────────────────────────

function ClientTasks({ project, canWrite, api, setProject, fail }: PartProps) {
	const [filter, setFilter] = useState<"all" | "open" | "done">("all");
	const [title, setTitle] = useState("");
	const [assignee, setAssignee] = useState<Assignee>("owner");
	const [saving, setSaving] = useState(false);
	const [open, setOpen] = useState<Record<string, boolean>>({});

	const total = project.tasks.length;
	const done = project.tasks.filter((t) => t.done).length;
	const visible = project.tasks.filter((t) => filter === "all" || (filter === "done" ? t.done : !t.done));
	const replace = (task: PortalTask) => setProject((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === task.id ? task : t)) }));

	async function add(event: FormEvent) {
		event.preventDefault();
		if (!title.trim()) return;
		setSaving(true);
		try {
			const task = await api.addTask(project.id, title.trim(), assignee);
			setProject((p) => ({ ...p, tasks: [...p.tasks, task] }));
			setTitle("");
		} catch (err) {
			fail(err, "Couldn’t add the task.");
		} finally {
			setSaving(false);
		}
	}

	async function toggle(task: PortalTask) {
		replace({ ...task, done: !task.done });
		try {
			replace(await api.setTaskDone(task.id, !task.done));
		} catch (err) {
			replace(task);
			fail(err, "Couldn’t update the task.");
		}
	}

	if (total === 0 && !canWrite) return null;

	return (
		<section aria-labelledby="c-tasks">
			<div className="aq-sec__head">
				<h2 id="c-tasks" className="aq-sec__title aq-display">
					Tasks
				</h2>
				<span className="aq-sec__count aq-italic">
					{done} of {total} done
				</span>
				<span className="aq-sec__spacer" />
				<FilterTabs
					value={filter}
					onChange={setFilter}
					options={[
						["all", `All ${total}`],
						["open", `Open ${total - done}`],
						["done", `Done ${done}`],
					]}
				/>
			</div>
			<div className="aq-progress" aria-hidden="true">
				<div className="aq-progress__bar" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
			</div>

			{canWrite && (
				<form className="aq-addbar aq-addbar--boxed" onSubmit={add}>
					<label className="aq-field aq-grow">
						<span className="aq-mono aq-mono--sm">Something to do?</span>
						<input className="aq-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Change the photo on the contact page" maxLength={300} />
					</label>
					<label className="aq-field aq-narrow">
						<span className="aq-mono aq-mono--sm">Who does it</span>
						<select className="aq-input" value={assignee} onChange={(e) => setAssignee(e.target.value as Assignee)}>
							<option value="owner">Pavlo</option>
							<option value="client">Me</option>
						</select>
					</label>
					<button type="submit" className="aq-btn aq-btn--solid aq-mono aq-mono--sm" disabled={saving || !title.trim()}>
						{saving ? "Adding…" : "+ Add task"}
					</button>
				</form>
			)}

			{visible.length === 0 ? (
				<p className="aq-empty-line" style={{ paddingLeft: 4 }}>
					{total === 0 ? "No tasks yet." : "Nothing here."}
				</p>
			) : (
				<ul className="aq-tasks">
					{visible.map((task) => (
						<ClientTask
							key={task.id}
							task={task}
							canWrite={canWrite}
							viewerEmail={project.viewer.email}
							open={!!open[task.id]}
							onOpen={() => setOpen((o) => ({ ...o, [task.id]: !o[task.id] }))}
							onToggle={() => toggle(task)}
							onComment={async (body) => {
								try {
									const comment = await api.addComment(task.id, body);
									setProject((p) => ({
										...p,
										tasks: p.tasks.map((t) => (t.id === task.id ? { ...t, comments: [...t.comments, comment] } : t)),
									}));
									return true;
								} catch (err) {
									fail(err, "Couldn’t post the comment.");
									return false;
								}
							}}
						/>
					))}
				</ul>
			)}
		</section>
	);
}

function ClientTask(props: {
	task: PortalTask;
	canWrite: boolean;
	viewerEmail: string;
	open: boolean;
	onOpen: () => void;
	onToggle: () => void;
	onComment: (body: string) => Promise<boolean>;
}) {
	const { task } = props;
	const id = useId();
	return (
		<li className={`aq-task${task.done ? " aq-task--done" : ""}`}>
			<div className="aq-task__row">
				<input
					type="checkbox"
					className="aq-check"
					checked={task.done}
					onChange={props.onToggle}
					disabled={!props.canWrite}
					aria-labelledby={`${id}-t`}
				/>
				<div className="aq-task__body">
					<div className="aq-task__title" id={`${id}-t`}>
						{task.title}
					</div>
					<div className="aq-task__meta aq-mono aq-mono--sm">
						<span>{task.assignee === "client" ? "For you" : "For Pavlo"}</span>
						{task.done && task.doneAt && (
							<span suppressHydrationWarning>
								✓ {task.doneBy === props.viewerEmail ? "You" : (task.doneBy ?? "Done")} · {timeAgo(task.doneAt)}
							</span>
						)}
					</div>
				</div>
				<button
					type="button"
					className="aq-count-btn aq-mono"
					aria-expanded={props.open}
					aria-controls={`${id}-c`}
					aria-label={`${props.open ? "Hide" : "Show"} comments on “${task.title}” (${task.comments.length})`}
					onClick={props.onOpen}
				>
					<IconComment />
					{task.comments.length}
				</button>
			</div>
			{props.open && (
				<div className="aq-thread" id={`${id}-c`}>
					{task.comments.length === 0 && (
						<p className="aq-empty-line" style={{ padding: "10px 0" }}>
							No comments yet.
						</p>
					)}
					{task.comments.map((c) => (
						<div key={c.id} className="aq-comment">
							<Avatar label={c.author} client={c.authorRole === "client"} small />
							<div style={{ flex: 1, minWidth: 0 }}>
								<div className="aq-comment__head">
									<span className="aq-comment__author">{c.mine ? "You" : c.author}</span>
									<span className="aq-mono aq-mono--sm aq-muted" suppressHydrationWarning>
										{formatWhen(c.createdAt)}
									</span>
								</div>
								<p className="aq-comment__body"><Linkify text={c.body} /></p>
							</div>
						</div>
					))}
					{props.canWrite && <CommentForm label={`Comment on ${task.title}`} onSubmit={props.onComment} />}
				</div>
			)}
		</li>
	);
}

// ── notes ───────────────────────────────────────────────────

function ClientNotes({ project, canWrite, api, setProject, fail }: PartProps) {
	const [body, setBody] = useState("");
	const [saving, setSaving] = useState(false);

	async function post(event: FormEvent) {
		event.preventDefault();
		if (!body.trim()) return;
		setSaving(true);
		try {
			const note = await api.addNote(project.id, body.trim());
			setProject((p) => ({ ...p, notes: [note, ...p.notes] }));
			setBody("");
		} catch (err) {
			fail(err, "Couldn’t send the note.");
		} finally {
			setSaving(false);
		}
	}

	const replace = (note: PortalNote) => setProject((p) => ({ ...p, notes: p.notes.map((n) => (n.id === note.id ? note : n)) }));

	return (
		<section aria-labelledby="c-notes">
			<div className="aq-sec__head">
				<h2 id="c-notes" className="aq-sec__title aq-display">
					Notes
				</h2>
				<span className="aq-sec__count aq-italic">{project.notes.length}</span>
			</div>

			{canWrite && (
				<form className="aq-composer" onSubmit={post}>
					<label className="aq-field">
						<span className="aq-mono aq-mono--sm">Write to Pavlo</span>
						<textarea
							className="aq-input"
							rows={2}
							value={body}
							onChange={(e) => setBody(e.target.value)}
							placeholder="A question, feedback, something to change…"
							maxLength={5000}
						/>
					</label>
					<div className="aq-composer__foot">
						<span className="aq-composer__hint">Pavlo will see it here</span>
						<button type="submit" className="aq-btn aq-btn--solid aq-mono aq-mono--sm" disabled={saving || !body.trim()}>
							{saving ? "Sending…" : "Send note"}
						</button>
					</div>
				</form>
			)}

			{project.notes.length === 0 && !canWrite && <p className="aq-empty-line">No notes yet.</p>}

			<ul className="aq-notes">
				{project.notes.map((note) => (
					<ClientNote
						key={note.id}
						note={note}
						canEdit={canWrite && note.mine}
						onSave={async (text) => {
							try {
								replace(await api.updateNote(note.id, text));
								return true;
							} catch (err) {
								fail(err, "Couldn’t save the note.");
								return false;
							}
						}}
						onDelete={async () => {
							if (!window.confirm("Delete this note?")) return;
							try {
								await api.deleteNote(note.id);
								setProject((p) => ({ ...p, notes: p.notes.filter((n) => n.id !== note.id) }));
							} catch (err) {
								fail(err, "Couldn’t delete the note.");
							}
						}}
					/>
				))}
			</ul>
		</section>
	);
}

function ClientNote(props: {
	note: PortalNote;
	canEdit: boolean;
	onSave: (body: string) => Promise<boolean>;
	onDelete: () => void;
}) {
	const { note } = props;
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(note.body);
	const [saving, setSaving] = useState(false);

	async function save(event: FormEvent) {
		event.preventDefault();
		if (!draft.trim()) return;
		setSaving(true);
		if (await props.onSave(draft.trim())) setEditing(false);
		setSaving(false);
	}

	return (
		<li className="aq-note">
			<Avatar label={note.author} client={note.authorRole === "client"} />
			<div className="aq-note__main">
				<div className="aq-note__head">
					<span className="aq-note__author">{note.mine ? "You" : note.author}</span>
					<span className="aq-mono aq-mono--sm aq-muted" suppressHydrationWarning>
						{formatWhen(note.createdAt)}
						{note.updatedAt !== note.createdAt && " · edited"}
					</span>
					{props.canEdit && !editing && (
						<span className="aq-note__tools">
							<button
								type="button"
								className="aq-link-btn aq-mono aq-mono--sm"
								onClick={() => {
									setDraft(note.body);
									setEditing(true);
								}}
							>
								Edit
							</button>
							<button type="button" className="aq-link-btn aq-link-btn--danger aq-mono aq-mono--sm" onClick={props.onDelete}>
								Delete
							</button>
						</span>
					)}
				</div>
				{editing ? (
					<form onSubmit={save} onKeyDown={(e) => e.key === "Escape" && setEditing(false)} style={{ marginTop: 8 }}>
						<textarea className="aq-input" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit note" maxLength={5000} autoFocus />
						<div className="aq-actions" style={{ marginTop: 10, justifyContent: "flex-end" }}>
							<button type="button" className="aq-link-btn aq-mono aq-mono--sm" onClick={() => setEditing(false)}>
								Cancel
							</button>
							<button type="submit" className="aq-btn aq-btn--solid aq-btn--sm" disabled={saving || !draft.trim()}>
								{saving ? "Saving…" : "Save"}
							</button>
						</div>
					</form>
				) : (
					<p className="aq-note__body"><Linkify text={note.body} /></p>
				)}
			</div>
		</li>
	);
}
