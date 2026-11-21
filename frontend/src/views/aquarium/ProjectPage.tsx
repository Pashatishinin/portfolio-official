import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { detectService, displayUrl, normalizeUrl } from "../../shared/aquarium/services";
import { formatWhen, timeAgo } from "../../shared/aquarium/time";
import type {
	Assignee,
	MemberRole,
	Note,
	ProjectDetail,
	ProjectLink,
	ProjectMember,
	Task,
	Visibility,
} from "../../shared/aquarium/types";
import { createApi, type AquariumApi } from "./api";
import { Avatar, IconComment, IconEye, IconLeft, IconLock, IconPerson, IconRight, errorText } from "./icons";
import { Linkify } from "./Linkify";
import { Favicon, IconClose, IconTrash, STATUS_META, StatusDot } from "./ui";

interface Props {
	apiUrl: string;
	initial: ProjectDetail;
	/** Public address of the site, for the copyable portal link. */
	siteUrl: string;
}

type Setter = (fn: (d: ProjectDetail) => ProjectDetail) => void;

export default function ProjectPage({ apiUrl, initial, siteUrl }: Props) {
	const api = useMemo(() => createApi(apiUrl), [apiUrl]);
	const [detail, setDetail] = useState(initial);
	const [error, setError] = useState<string | null>(null);
	const update: Setter = (fn) => setDetail((d) => fn(d));
	const fail = (err: unknown, fallback: string) => setError(errorText(err, fallback));

	const lastSeen = detail.members
		.map((m) => m.lastSeenAt)
		.filter((v): v is string => Boolean(v))
		.sort()
		.at(-1);

	return (
		<>
			<nav className="aq-crumbs aq-mono" aria-label="Breadcrumb">
				<a href="/aquarium">← All projects</a>
				<span aria-hidden="true">/</span>
				<span aria-current="page">{detail.title}</span>
			</nav>

			<section className="aq-page-hero">
				<h1 className="aq-hero__title">
					<span className="aq-italic">project</span>
					<span className="aq-display">{detail.title}</span>
				</h1>
				<div className="aq-page-hero__side">
					<div className="aq-meta-row aq-mono">
						<span className="aq-card__status">
							<StatusDot status={detail.status} />
							{STATUS_META[detail.status].label}
						</span>
						{detail.tags.map((tag) => (
							<span key={tag}>{tag}</span>
						))}
						<span suppressHydrationWarning>Updated {timeAgo(detail.updatedAt)}</span>
					</div>
					<div className="aq-actions">
						<a className="aq-btn aq-btn--solid aq-mono aq-mono--sm" href={`/portal/p/${detail.id}`}>
							<IconEye size={16} />
							View as client
						</a>
					</div>
				</div>
			</section>

			{error && (
				<div className="aq-error" role="alert">
					<span>{error}</span>
					<button type="button" className="aq-icon-btn" aria-label="Dismiss" onClick={() => setError(null)}>
						<IconClose />
					</button>
				</div>
			)}

			<Descriptions detail={detail} api={api} update={update} fail={fail} />

			<div className="aq-cols">
				<div className="aq-cols__main">
					<LinksSection detail={detail} api={api} update={update} fail={fail} />
					<TasksSection detail={detail} api={api} update={update} fail={fail} />
					<NotesSection detail={detail} api={api} update={update} fail={fail} />
				</div>

				<aside className="aq-cols__aside" aria-label="Client access">
					<AccessCard detail={detail} api={api} update={update} fail={fail} />

					<section className="aq-side" aria-labelledby="portal-link-h">
						<h2 id="portal-link-h" className="aq-side__label aq-mono">
							Portal link
						</h2>
						<CopyRow value={`${siteUrl}/portal/p/${detail.id}`} />
						<p className="aq-side__text">
							Send this link to the client. They open it, type the email you invited, and the project opens — no
							password or sign-up.
						</p>
					</section>

					<section className="aq-side" aria-labelledby="activity-h">
						<h2 id="activity-h" className="aq-side__label aq-mono">
							Client activity
						</h2>
						<dl className="aq-stats" style={{ marginTop: 12 }}>
							<div>
								<dt className="aq-mono aq-mono--sm">Last visit</dt>
								<dd style={{ fontSize: 24 }} suppressHydrationWarning>
									{lastSeen ? timeAgo(lastSeen) : "—"}
								</dd>
							</div>
							<div>
								<dt className="aq-mono aq-mono--sm">Open tasks</dt>
								<dd style={{ fontSize: 24 }}>{detail.tasks.filter((t) => !t.done).length}</dd>
							</div>
						</dl>
					</section>
				</aside>
			</div>
		</>
	);
}

interface SectionProps {
	detail: ProjectDetail;
	api: AquariumApi;
	update: Setter;
	fail: (err: unknown, fallback: string) => void;
}

// ── descriptions ────────────────────────────────────────────

function Descriptions({ detail, api, update, fail }: SectionProps) {
	return (
		<div className="aq-desc-grid">
			<EditableText
				title="Internal description · only you"
				icon={<IconLock />}
				shared={false}
				value={detail.description}
				placeholder="Private notes about this project…"
				onSave={async (description) => {
					try {
						const p = await api.updateProject(detail.id, { description });
						update((d) => ({ ...d, description: p.description, updatedAt: p.updatedAt }));
						return true;
					} catch (err) {
						fail(err, "Couldn’t save the description.");
						return false;
					}
				}}
			/>
			<EditableText
				title="Client summary · client sees this"
				icon={<IconEye />}
				shared
				value={detail.clientSummary}
				placeholder="What the client reads at the top of their page…"
				onSave={async (clientSummary) => {
					try {
						const p = await api.updateProject(detail.id, { clientSummary });
						update((d) => ({ ...d, clientSummary: p.clientSummary, updatedAt: p.updatedAt }));
						return true;
					} catch (err) {
						fail(err, "Couldn’t save the summary.");
						return false;
					}
				}}
			/>
		</div>
	);
}

function EditableText(props: {
	title: string;
	icon: ReactNode;
	shared: boolean;
	value: string;
	placeholder: string;
	onSave: (value: string) => Promise<boolean>;
}) {
	const id = useId();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(props.value);
	const [saving, setSaving] = useState(false);

	async function save(event: FormEvent) {
		event.preventDefault();
		setSaving(true);
		const ok = await props.onSave(draft.trim());
		setSaving(false);
		if (ok) setEditing(false);
	}

	return (
		<section className={`aq-box aq-desc${props.shared ? " aq-box--shared" : ""}`} aria-labelledby={`${id}-h`}>
			<div className="aq-box__head aq-mono">
				{props.icon}
				<h2 id={`${id}-h`} className="aq-mono" style={{ margin: 0, fontWeight: 400 }}>
					{props.title}
				</h2>
				{!editing && (
					<button
						type="button"
						className="aq-link-btn aq-mono aq-mono--sm aq-desc__edit"
						style={{ minHeight: 32 }}
						onClick={() => {
							setDraft(props.value);
							setEditing(true);
						}}
					>
						Edit
					</button>
				)}
			</div>
			{editing ? (
				<form onSubmit={save} onKeyDown={(e) => e.key === "Escape" && setEditing(false)}>
					<textarea
						className="aq-input"
						rows={4}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						placeholder={props.placeholder}
						aria-label={props.title}
						maxLength={5000}
						autoFocus
					/>
					<div className="aq-actions" style={{ marginTop: 12, justifyContent: "flex-end" }}>
						<button type="button" className="aq-link-btn aq-mono aq-mono--sm" onClick={() => setEditing(false)}>
							Cancel
						</button>
						<button type="submit" className="aq-btn aq-btn--solid aq-btn--sm" disabled={saving}>
							{saving ? "Saving…" : "Save"}
						</button>
					</div>
				</form>
			) : (
				<p className={`aq-desc__text${props.value ? "" : " aq-desc__text--empty"}`}>{props.value ? <Linkify text={props.value} /> : props.placeholder}</p>
			)}
		</section>
	);
}

// ── links ───────────────────────────────────────────────────

function LinksSection({ detail, api, update, fail }: SectionProps) {
	const mine = detail.links.filter((l) => l.addedBy === null);
	const internal = mine.filter((l) => l.visibility === "internal");
	const shared = mine.filter((l) => l.visibility === "client");
	const fromClient = detail.links.filter((l) => l.addedBy !== null);

	const replace = (link: ProjectLink) =>
		update((d) => ({ ...d, links: d.links.map((l) => (l.id === link.id ? link : l)) }));

	async function move(link: ProjectLink) {
		const next: Visibility = link.visibility === "client" ? "internal" : "client";
		replace({ ...link, visibility: next });
		try {
			replace(await api.setLinkVisibility(link.id, next));
		} catch (err) {
			replace(link);
			fail(err, "Couldn’t move the link.");
		}
	}

	async function remove(link: ProjectLink) {
		if (!window.confirm(`Remove “${link.label}”?`)) return;
		try {
			await api.deleteLink(link.id);
			update((d) => ({ ...d, links: d.links.filter((l) => l.id !== link.id) }));
		} catch (err) {
			fail(err, "Couldn’t remove the link.");
		}
	}

	return (
		<section aria-labelledby="links-h">
			<div className="aq-sec__head">
				<h2 id="links-h" className="aq-sec__title aq-display">
					Links
				</h2>
				<span className="aq-sec__count aq-italic">{detail.links.length}</span>
				<span className="aq-sec__spacer" />
				<span className="aq-mono aq-muted">Arrows move a link between columns</span>
			</div>

			<div className="aq-vis-grid">
				<LinkColumn
					title="Internal · only you"
					icon={<IconLock />}
					shared={false}
					links={internal}
					empty="Nothing private here."
					onMove={move}
					onRemove={remove}
				/>
				<LinkColumn
					title="Shared with client"
					icon={<IconEye />}
					shared
					links={shared}
					empty="The client sees no links yet."
					onMove={move}
					onRemove={remove}
				/>
			</div>

			<AddLinkBar
				onAdd={async (input) => {
					const link = await api.addLink(detail.id, input);
					update((d) => ({ ...d, links: [...d.links, link] }));
				}}
			/>

			{fromClient.length > 0 && (
				<>
					<h3 className="aq-sub aq-mono">
						<IconPerson />
						From the client · {fromClient.length}
						<span className="aq-muted" style={{ marginLeft: "auto" }}>
							Added in the portal
						</span>
					</h3>
					<ul className="aq-mini-grid aq-list">
						{fromClient.map((link) => {
							const service = detectService(link.url);
							return (
								<li key={link.id} className="aq-mini">
									<Favicon host={service?.host ?? null} letter={link.label} />
									<a className="aq-row__link" href={link.url} target="_blank" rel="noopener noreferrer">
										<span className="aq-row__label">{link.label}</span>
										<span className="aq-row__url" suppressHydrationWarning>
											{link.addedBy} · {timeAgo(link.createdAt)}
										</span>
									</a>
									<button
										type="button"
										className="aq-icon-btn aq-icon-btn--danger"
										aria-label={`Remove ${link.label}`}
										onClick={() => remove(link)}
									>
										<IconClose size={12} />
									</button>
								</li>
							);
						})}
					</ul>
				</>
			)}
		</section>
	);
}

function LinkColumn(props: {
	title: string;
	icon: ReactNode;
	shared: boolean;
	links: ProjectLink[];
	empty: string;
	onMove: (link: ProjectLink) => void;
	onRemove: (link: ProjectLink) => void;
}) {
	const { shared } = props;
	return (
		<div className={`aq-box aq-vis${shared ? " aq-box--shared" : ""}`}>
			<div className="aq-box__head aq-mono">
				{props.icon}
				<span>{props.title}</span>
				<span className="aq-vis__count">{props.links.length}</span>
			</div>
			{props.links.length === 0 ? (
				<p className="aq-empty-line">{props.empty}</p>
			) : (
				<ul className="aq-list">
					{props.links.map((link) => {
						const service = detectService(link.url);
						const moveButton = (
							<button
								type="button"
								className="aq-icon-btn"
								aria-label={shared ? `Make “${link.label}” internal` : `Share “${link.label}” with the client`}
								title={shared ? "Make internal" : "Share with client"}
								onClick={() => props.onMove(link)}
							>
								{shared ? <IconLeft /> : <IconRight />}
							</button>
						);
						return (
							<li key={link.id} className="aq-row">
								{shared && moveButton}
								<Favicon host={service?.host ?? null} letter={service?.name === "Website" ? undefined : service?.name} size="lg" />
								<a className="aq-row__link" href={link.url} target="_blank" rel="noopener noreferrer">
									<span className="aq-row__label">{link.label}</span>
									<span className="aq-row__url">{displayUrl(link.url)}</span>
								</a>
								<button
									type="button"
									className="aq-icon-btn aq-icon-btn--danger"
									aria-label={`Remove ${link.label}`}
									onClick={() => props.onRemove(link)}
								>
									<IconTrash />
								</button>
								{!shared && moveButton}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

function AddLinkBar({ onAdd }: { onAdd: (input: { label: string; url: string; kind: ProjectLink["kind"]; visibility: Visibility }) => Promise<void> }) {
	const [url, setUrl] = useState("");
	const [label, setLabel] = useState("");
	const [visibility, setVisibility] = useState<Visibility>("internal");
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
			await onAdd({ url: normalized, label: label.trim() || service.name, kind: service.kind, visibility });
			setUrl("");
			setLabel("");
		} catch (err) {
			setError(errorText(err, "Couldn’t add the link."));
		} finally {
			setSaving(false);
		}
	}

	return (
		<form className="aq-addbar" onSubmit={submit}>
			<label className="aq-field aq-grow">
				<span className="aq-mono aq-mono--sm">Paste a link</span>
				<input
					className="aq-input aq-input--mono"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="figma.com/design/…"
					inputMode="url"
					autoComplete="off"
					spellCheck={false}
				/>
			</label>
			<label className="aq-field aq-narrow">
				<span className="aq-mono aq-mono--sm">Label</span>
				<input className="aq-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={service?.name ?? "Optional"} maxLength={120} />
			</label>
			<label className="aq-field aq-narrow">
				<span className="aq-mono aq-mono--sm">Who sees it</span>
				<select className="aq-input" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
					<option value="internal">Only me</option>
					<option value="client">Client too</option>
				</select>
			</label>
			<button type="submit" className="aq-btn aq-mono aq-mono--sm" disabled={saving || !url.trim()}>
				{saving ? "Adding…" : "+ Add link"}
			</button>
			{error && (
				<p className="aq-form-error" role="alert">
					{error}
				</p>
			)}
		</form>
	);
}

// ── tasks ───────────────────────────────────────────────────

type TaskFilter = "all" | "open" | "done";

function TasksSection({ detail, api, update, fail }: SectionProps) {
	const [filter, setFilter] = useState<TaskFilter>("all");
	const [title, setTitle] = useState("");
	const [assignee, setAssignee] = useState<Assignee>("owner");
	const [visibility, setVisibility] = useState<Visibility>("client");
	const [saving, setSaving] = useState(false);
	const [open, setOpen] = useState<Record<string, boolean>>({});

	const done = detail.tasks.filter((t) => t.done).length;
	const total = detail.tasks.length;
	const visible = detail.tasks.filter((t) => filter === "all" || (filter === "done" ? t.done : !t.done));
	const clientLabel = detail.members[0]?.email ?? "Client";

	const replace = (task: Task) => update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? task : t)) }));

	async function add(event: FormEvent) {
		event.preventDefault();
		if (!title.trim()) return;
		setSaving(true);
		try {
			const task = await api.addTask(detail.id, { title: title.trim(), assignee, visibility });
			update((d) => ({ ...d, tasks: [...d.tasks, task] }));
			setTitle("");
		} catch (err) {
			fail(err, "Couldn’t add the task.");
		} finally {
			setSaving(false);
		}
	}

	async function toggle(task: Task) {
		replace({ ...task, done: !task.done });
		try {
			replace(await api.updateTask(task.id, { done: !task.done }));
		} catch (err) {
			replace(task);
			fail(err, "Couldn’t update the task.");
		}
	}

	async function remove(task: Task) {
		if (!window.confirm(`Delete the task “${task.title}” and its comments?`)) return;
		try {
			await api.deleteTask(task.id);
			update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== task.id) }));
		} catch (err) {
			fail(err, "Couldn’t delete the task.");
		}
	}

	return (
		<section aria-labelledby="tasks-h">
			<div className="aq-sec__head">
				<h2 id="tasks-h" className="aq-sec__title aq-display">
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

			<form className="aq-addbar aq-addbar--boxed" onSubmit={add}>
				<label className="aq-field aq-grow">
					<span className="aq-mono aq-mono--sm">New task</span>
					<input className="aq-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" maxLength={300} />
				</label>
				<label className="aq-field aq-narrow">
					<span className="aq-mono aq-mono--sm">Who does it</span>
					<select className="aq-input" value={assignee} onChange={(e) => setAssignee(e.target.value as Assignee)}>
						<option value="owner">Me</option>
						<option value="client">Client</option>
					</select>
				</label>
				<VisibilityToggle value={visibility} onChange={setVisibility} />
				<button type="submit" className="aq-btn aq-btn--solid aq-mono aq-mono--sm" disabled={saving || !title.trim()}>
					{saving ? "Adding…" : "+ Add task"}
				</button>
			</form>

			{visible.length === 0 ? (
				<p className="aq-empty-line" style={{ paddingLeft: 4 }}>
					{total === 0 ? "No tasks yet." : "Nothing here."}
				</p>
			) : (
				<ul className="aq-tasks">
					{visible.map((task) => (
						<OwnerTask
							key={task.id}
							task={task}
							clientLabel={clientLabel}
							clientEmails={detail.members.map((m) => m.email)}
							open={!!open[task.id]}
							onOpen={() => setOpen((o) => ({ ...o, [task.id]: !o[task.id] }))}
							onToggle={() => toggle(task)}
							onRemove={() => remove(task)}
							onComment={async (body) => {
								try {
									const comment = await api.addComment(task.id, body);
									update((d) => ({
										...d,
										tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, comments: [...t.comments, comment] } : t)),
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

function OwnerTask(props: {
	task: Task;
	clientLabel: string;
	clientEmails: string[];
	open: boolean;
	onOpen: () => void;
	onToggle: () => void;
	onRemove: () => void;
	onComment: (body: string) => Promise<boolean>;
}) {
	const { task } = props;
	const id = useId();
	// doneBy is an email: a client's, or the owner's own (shown as "You").
	const doneBy = task.doneBy ? (props.clientEmails.includes(task.doneBy) ? task.doneBy : "You") : null;
	return (
		<li className={`aq-task${task.done ? " aq-task--done" : ""}`}>
			<div className="aq-task__row">
				<input
					type="checkbox"
					className="aq-check"
					checked={task.done}
					onChange={props.onToggle}
					aria-labelledby={`${id}-t`}
				/>
				<div className="aq-task__body">
					<div className="aq-task__title" id={`${id}-t`}>
						{task.title}
					</div>
					<div className="aq-task__meta aq-mono aq-mono--sm">
						<span>{task.assignee === "client" ? `For ${props.clientLabel}` : "For you"}</span>
						{task.done && task.doneAt && (
							<span suppressHydrationWarning>
								✓ {doneBy ?? "Done"} · {timeAgo(task.doneAt)}
							</span>
						)}
						{task.visibility === "internal" && (
							<span className="aq-badge">
								<IconLock size={11} />
								Only you
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
				<button type="button" className="aq-icon-btn aq-icon-btn--danger" aria-label={`Delete task “${task.title}”`} onClick={props.onRemove}>
					<IconTrash />
				</button>
			</div>
			{props.open && (
				<div className="aq-thread" id={`${id}-c`}>
					{task.comments.length === 0 && <p className="aq-empty-line" style={{ padding: "10px 0" }}>No comments yet.</p>}
					{task.comments.map((c) => (
						<div key={c.id} className="aq-comment">
							<Avatar label={c.authorRole === "owner" ? "P" : c.authorEmail} client={c.authorRole === "client"} small />
							<div style={{ flex: 1, minWidth: 0 }}>
								<div className="aq-comment__head">
									<span className="aq-comment__author">{c.authorRole === "owner" ? "You" : c.authorEmail}</span>
									<span className="aq-mono aq-mono--sm aq-muted" suppressHydrationWarning>
										{formatWhen(c.createdAt)}
									</span>
								</div>
								<p className="aq-comment__body"><Linkify text={c.body} /></p>
							</div>
						</div>
					))}
					<CommentForm label={`Comment on ${task.title}`} onSubmit={props.onComment} />
				</div>
			)}
		</li>
	);
}

export function CommentForm({ label, onSubmit }: { label: string; onSubmit: (body: string) => Promise<boolean> }) {
	const [body, setBody] = useState("");
	const [saving, setSaving] = useState(false);
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (!body.trim()) return;
		setSaving(true);
		if (await onSubmit(body.trim())) setBody("");
		setSaving(false);
	}
	return (
		<form className="aq-thread__form" onSubmit={submit}>
			<input className="aq-input" style={{ flex: 1, minWidth: 0 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment…" aria-label={label} maxLength={5000} />
			<button type="submit" className="aq-btn aq-btn--sm" disabled={saving || !body.trim()}>
				{saving ? "…" : "Comment"}
			</button>
		</form>
	);
}

export function FilterTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
	return (
		<div className="aq-tabs aq-mono" role="group" aria-label="Filter">
			{options.map(([key, label]) => (
				<button key={key} type="button" className="aq-filter" aria-pressed={value === key} onClick={() => onChange(key)}>
					{label}
				</button>
			))}
		</div>
	);
}

function VisibilityToggle({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
	return (
		<div className="aq-choices" role="radiogroup" aria-label="Who sees this">
			<button type="button" role="radio" className="aq-choice" aria-checked={value === "client"} onClick={() => onChange("client")}>
				<IconEye />
				With client
			</button>
			<button type="button" role="radio" className="aq-choice" aria-checked={value === "internal"} onClick={() => onChange("internal")}>
				<IconLock />
				Only me
			</button>
		</div>
	);
}

// ── notes ───────────────────────────────────────────────────

type NoteFilter = "all" | Visibility;

function NotesSection({ detail, api, update, fail }: SectionProps) {
	const [filter, setFilter] = useState<NoteFilter>("all");
	const [body, setBody] = useState("");
	const [visibility, setVisibility] = useState<Visibility>("client");
	const [saving, setSaving] = useState(false);

	const count = (v: Visibility) => detail.notes.filter((n) => n.visibility === v).length;
	const visible = detail.notes.filter((n) => filter === "all" || n.visibility === filter);
	const hasClients = detail.members.length > 0;

	async function post(event: FormEvent) {
		event.preventDefault();
		if (!body.trim()) return;
		setSaving(true);
		try {
			const note = await api.addNote(detail.id, body.trim(), visibility);
			update((d) => ({ ...d, notes: [note, ...d.notes] }));
			setBody("");
		} catch (err) {
			fail(err, "Couldn’t post the note.");
		} finally {
			setSaving(false);
		}
	}

	async function remove(note: Note) {
		if (!window.confirm("Delete this note?")) return;
		try {
			await api.deleteNote(note.id);
			update((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== note.id) }));
		} catch (err) {
			fail(err, "Couldn’t delete the note.");
		}
	}

	return (
		<section aria-labelledby="notes-h">
			<div className="aq-sec__head">
				<h2 id="notes-h" className="aq-sec__title aq-display">
					Notes
				</h2>
				<span className="aq-sec__count aq-italic">{detail.notes.length}</span>
				<span className="aq-sec__spacer" />
				<FilterTabs
					value={filter}
					onChange={setFilter}
					options={[
						["all", `All ${detail.notes.length}`],
						["client", `With client ${count("client")}`],
						["internal", `Only me ${count("internal")}`],
					]}
				/>
			</div>

			<form className="aq-composer" onSubmit={post}>
				<label className="aq-field">
					<span className="aq-mono aq-mono--sm">New note</span>
					<textarea
						className="aq-input"
						rows={2}
						value={body}
						onChange={(e) => setBody(e.target.value)}
						placeholder="An update, a question or a private reminder…"
						maxLength={5000}
					/>
				</label>
				<div className="aq-composer__foot">
					<VisibilityToggle value={visibility} onChange={setVisibility} />
					<span className="aq-composer__hint">
						{visibility === "internal"
							? "Private — never sent to the client"
							: hasClients
								? "Everyone invited to this project will see it"
								: "Shared — visible once you invite a client"}
					</span>
					<button type="submit" className="aq-btn aq-btn--solid aq-mono aq-mono--sm" disabled={saving || !body.trim()}>
						{saving ? "Posting…" : "Post note"}
					</button>
				</div>
			</form>

			<ul className="aq-notes">
				{visible.map((note) => (
					<li key={note.id} className={`aq-note${note.visibility === "internal" ? " aq-note--private" : ""}`}>
						<Avatar label={note.authorRole === "owner" ? "P" : note.authorEmail} client={note.authorRole === "client"} />
						<div className="aq-note__main">
							<div className="aq-note__head">
								<span className="aq-note__author">{note.authorRole === "owner" ? "You" : note.authorEmail}</span>
								<span className="aq-mono aq-mono--sm aq-muted" suppressHydrationWarning>
									{formatWhen(note.createdAt)}
								</span>
								{note.visibility === "internal" && (
									<span className="aq-badge aq-mono aq-mono--sm">
										<IconLock size={11} />
										Only you
									</span>
								)}
								<span className="aq-note__tools">
									<button type="button" className="aq-link-btn aq-link-btn--danger aq-mono aq-mono--sm" onClick={() => remove(note)}>
										Delete
									</button>
								</span>
							</div>
							<p className="aq-note__body"><Linkify text={note.body} /></p>
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}

// ── access ──────────────────────────────────────────────────

function AccessCard({ detail, api, update, fail }: SectionProps) {
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<MemberRole>("commenter");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function invite(event: FormEvent) {
		event.preventDefault();
		const value = email.trim().toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
			setError("That doesn’t look like an email address.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const member = await api.addMember(detail.id, value, role);
			update((d) => ({
				...d,
				members: d.members.some((m) => m.id === member.id)
					? d.members.map((m) => (m.id === member.id ? member : m))
					: [...d.members, member],
			}));
			setEmail("");
		} catch (err) {
			setError(errorText(err, "Couldn’t invite."));
		} finally {
			setSaving(false);
		}
	}

	async function remove(member: ProjectMember) {
		if (!window.confirm(`Remove ${member.email}? They lose access to this project right away.`)) return;
		try {
			await api.removeMember(member.id);
			update((d) => ({ ...d, members: d.members.filter((m) => m.id !== member.id) }));
		} catch (err) {
			fail(err, "Couldn’t remove access.");
		}
	}

	async function changeRole(member: ProjectMember, next: MemberRole) {
		try {
			const updated = await api.updateMember(member.id, next);
			update((d) => ({ ...d, members: d.members.map((m) => (m.id === updated.id ? updated : m)) }));
		} catch (err) {
			fail(err, "Couldn’t change access.");
		}
	}

	return (
		<section className="aq-side aq-side--strong" aria-labelledby="access-h">
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
				<h2 id="access-h" className="aq-side__title">
					<span className="aq-italic">client</span>
					<span className="aq-display">Access</span>
				</h2>
				<span className="aq-mono aq-muted">
					{detail.members.length} {detail.members.length === 1 ? "person" : "people"}
				</span>
			</div>

			{detail.members.length > 0 ? (
				<ul className="aq-members">
					{detail.members.map((m) => (
						<li key={m.id} className="aq-member">
							<Avatar label={m.email} client />
							<div className="aq-member__main">
								<div className="aq-member__email">{m.email}</div>
								<div className="aq-member__meta" suppressHydrationWarning>
									<select
										className="aq-input"
										style={{ width: "auto", padding: "2px 20px 2px 0", fontSize: 12, borderBottom: 0 }}
										value={m.role}
										onChange={(e) => changeRole(m, e.target.value as MemberRole)}
										aria-label={`Access for ${m.email}`}
									>
										<option value="commenter">Can comment</option>
										<option value="viewer">Only view</option>
									</select>
									{" · "}
									{m.lastSeenAt ? `visited ${timeAgo(m.lastSeenAt)}` : "not signed in yet"}
								</div>
							</div>
							<button type="button" className="aq-icon-btn aq-icon-btn--danger" aria-label={`Remove ${m.email}`} onClick={() => remove(m)}>
								<IconClose />
							</button>
						</li>
					))}
				</ul>
			) : (
				<p className="aq-side__text" style={{ fontSize: 13 }}>
					Nobody but you can see this project yet.
				</p>
			)}

			<form className="aq-invite" onSubmit={invite}>
				<label className="aq-field">
					<span className="aq-mono aq-mono--sm">Invite by email</span>
					<input
						className="aq-input"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="client@company.com"
						autoComplete="off"
					/>
				</label>
				<div className="aq-invite__row">
					<label className="aq-field" style={{ flex: 1 }}>
						<span className="aq-mono aq-mono--sm">Can</span>
						<select className="aq-input" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
							<option value="commenter">Comment, add tasks &amp; links</option>
							<option value="viewer">Only view</option>
						</select>
					</label>
					<button type="submit" className="aq-btn aq-btn--solid aq-mono aq-mono--sm" disabled={saving || !email.trim()}>
						{saving ? "…" : "Invite"}
					</button>
				</div>
				{error && (
					<p className="aq-form-error" role="alert">
						{error}
					</p>
				)}
				<p className="aq-side__text" style={{ margin: 0 }}>
					Then send them the project link below. They get in by typing this email, and see only the summary, shared
					links, shared tasks and shared notes.
				</p>
			</form>
		</section>
	);
}

function CopyRow({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="aq-copy">
			<span className="aq-copy__url">{value.replace(/^https?:\/\//, "")}</span>
			<button
				type="button"
				className="aq-btn aq-btn--sm"
				onClick={async () => {
					try {
						await navigator.clipboard.writeText(value);
						setCopied(true);
						setTimeout(() => setCopied(false), 1800);
					} catch {
						window.prompt("Copy the link:", value);
					}
				}}
			>
				{copied ? "Copied" : "Copy"}
			</button>
		</div>
	);
}
