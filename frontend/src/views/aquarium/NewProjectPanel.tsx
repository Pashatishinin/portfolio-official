import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { detectService, normalizeUrl } from "../../shared/aquarium/services";
import type { Group, Project, ProjectStatus } from "../../shared/aquarium/types";
import type { AquariumApi, NewLink } from "./api";
import { Favicon, IconClose, STATUS_META, StatusDot, formatDate } from "./ui";

interface DraftLink {
	key: number;
	label: string;
	url: string;
	/** Once the user types a label we stop overwriting it with the detected name. */
	labelTouched: boolean;
}

const NEW_GROUP = "__new";
const STATUSES: ProjectStatus[] = ["idea", "active", "paused", "done"];

let nextKey = 1;
const emptyLink = (): DraftLink => ({ key: nextKey++, label: "", url: "", labelTouched: false });

interface Props {
	api: AquariumApi;
	groups: Group[];
	defaultGroupId: string | null;
	onCreated: (project: Project, newGroup: Group | null) => void;
	onClose: () => void;
}

export default function NewProjectPanel({ api, groups, defaultGroupId, onCreated, onClose }: Props) {
	const id = useId();
	const titleRef = useRef<HTMLInputElement>(null);

	const [title, setTitle] = useState("");
	const [note, setNote] = useState("");
	const [groupId, setGroupId] = useState<string>(defaultGroupId ?? (groups.length ? "" : NEW_GROUP));
	const [newGroupName, setNewGroupName] = useState("");
	const [status, setStatus] = useState<ProjectStatus>("active");
	const [links, setLinks] = useState<DraftLink[]>(() => [emptyLink(), emptyLink(), emptyLink()]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		titleRef.current?.focus();
	}, []);

	const updateLink = (key: number, patch: Partial<DraftLink>) =>
		setLinks((list) =>
			list.map((l) => {
				if (l.key !== key) return l;
				const next = { ...l, ...patch };
				if (patch.url !== undefined && !next.labelTouched) {
					next.label = detectService(patch.url)?.name ?? "";
				}
				return next;
			}),
		);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setError(null);

		const cleanTitle = title.trim();
		if (!cleanTitle) {
			setError("Give the project a title.");
			titleRef.current?.focus();
			return;
		}

		const payloadLinks: NewLink[] = [];
		for (const l of links) {
			if (!l.url.trim()) continue;
			const url = normalizeUrl(l.url);
			const service = url ? detectService(url) : null;
			if (!url || !service) {
				setError(`“${l.url}” doesn’t look like a web address.`);
				return;
			}
			payloadLinks.push({ url, label: l.label.trim() || service.name, kind: service.kind });
		}

		if (groupId === NEW_GROUP && !newGroupName.trim()) {
			setError("Name the new group, or pick an existing one.");
			return;
		}

		setSaving(true);
		try {
			let group: Group | null = null;
			let targetGroupId: string | null = groupId || null;
			if (groupId === NEW_GROUP) {
				group = await api.createGroup(newGroupName.trim());
				targetGroupId = group.id;
			}
			const project = await api.createProject({
				title: cleanTitle,
				description: note.trim(),
				status,
				groupId: targetGroupId,
				links: payloadLinks,
			});
			onCreated(project, group);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn’t save the project.");
			setSaving(false);
		}
	}

	return (
		<form className="aq-panel" aria-labelledby={`${id}-title`} onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onClose()}>
			<div className="aq-panel__head">
				<h2 className="aq-panel__title" id={`${id}-title`}>
					<span className="aq-italic">a new</span> <span className="aq-display">Project</span>
				</h2>
				<span className="aq-mono aq-mono--sm aq-muted">Created automatically · {formatDate(new Date())}</span>
			</div>

			<div className="aq-panel__cols">
				<div className="aq-panel__col">
					<label className="aq-field">
						<span className="aq-mono aq-mono--sm">Title</span>
						<input
							ref={titleRef}
							className="aq-input aq-input--title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="e.g. Blive"
							maxLength={160}
							required
						/>
					</label>

					<label className="aq-field">
						<span className="aq-mono aq-mono--sm">Note</span>
						<textarea
							className="aq-input"
							rows={2}
							value={note}
							onChange={(e) => setNote(e.target.value)}
							placeholder="Client, stack, anything worth remembering"
							maxLength={5000}
						/>
					</label>

					<fieldset className="aq-field" style={{ border: 0, padding: 0, margin: 0 }}>
						<legend className="aq-mono aq-mono--sm aq-muted" style={{ padding: 0, marginBottom: 10 }}>
							Group
						</legend>
						<div className="aq-choices" role="radiogroup" aria-label="Group">
							<button type="button" role="radio" aria-checked={groupId === ""} className="aq-choice" onClick={() => setGroupId("")}>
								No group
							</button>
							{groups.map((g) => (
								<button
									key={g.id}
									type="button"
									role="radio"
									aria-checked={groupId === g.id}
									className="aq-choice"
									onClick={() => setGroupId(g.id)}
								>
									{g.name}
								</button>
							))}
							{groupId === NEW_GROUP ? (
								<span className="aq-choice-new">
									<input
										autoFocus={groups.length > 0}
										value={newGroupName}
										onChange={(e) => setNewGroupName(e.target.value)}
										placeholder="New group name"
										aria-label="New group name"
										maxLength={60}
									/>
								</span>
							) : (
								<button type="button" className="aq-choice aq-choice--dashed" onClick={() => setGroupId(NEW_GROUP)}>
									+ New group
								</button>
							)}
						</div>
					</fieldset>

					<fieldset className="aq-field" style={{ border: 0, padding: 0, margin: 0 }}>
						<legend className="aq-mono aq-mono--sm aq-muted" style={{ padding: 0, marginBottom: 10 }}>
							Status
						</legend>
						<div className="aq-choices" role="radiogroup" aria-label="Status">
							{STATUSES.map((s) => (
								<button
									key={s}
									type="button"
									role="radio"
									aria-checked={status === s}
									className="aq-choice"
									onClick={() => setStatus(s)}
								>
									<StatusDot status={s} />
									{STATUS_META[s].label}
								</button>
							))}
						</div>
					</fieldset>
				</div>

				<div className="aq-panel__col" style={{ gap: 4, flexBasis: 420 }}>
					<span className="aq-mono aq-mono--sm aq-muted" style={{ marginBottom: 6 }}>
						Resources — paste a URL, the icon and name are detected
					</span>
					{links.map((l, i) => {
						const service = detectService(l.url);
						return (
							<div className="aq-draft-row" key={l.key}>
								<Favicon host={service?.host ?? null} letter={service?.name === "Website" ? undefined : service?.name} size="lg" />
								<input
									className="aq-input aq-draft-row__label"
									value={l.label}
									onChange={(e) => updateLink(l.key, { label: e.target.value, labelTouched: e.target.value !== "" })}
									placeholder="Label"
									aria-label={`Link ${i + 1} label`}
									maxLength={120}
								/>
								<input
									className="aq-input aq-input--mono aq-draft-row__url"
									value={l.url}
									onChange={(e) => updateLink(l.key, { url: e.target.value })}
									placeholder="github.com/…"
									aria-label={`Link ${i + 1} URL`}
									inputMode="url"
									autoComplete="off"
									spellCheck={false}
								/>
								<button
									type="button"
									className="aq-icon-btn"
									aria-label={`Remove link ${i + 1}`}
									onClick={() => setLinks((list) => (list.length > 1 ? list.filter((x) => x.key !== l.key) : [emptyLink()]))}
								>
									<IconClose />
								</button>
							</div>
						);
					})}
					<button
						type="button"
						className="aq-link-btn aq-mono"
						style={{ alignSelf: "flex-start" }}
						onClick={() => setLinks((list) => [...list, emptyLink()])}
					>
						+ Add another link
					</button>
				</div>
			</div>

			{error && (
				<p className="aq-error" role="alert">
					{error}
				</p>
			)}

			<div className="aq-panel__foot">
				<button type="button" className="aq-btn aq-btn--quiet aq-mono" onClick={onClose} disabled={saving}>
					Cancel
				</button>
				<button type="submit" className="aq-btn aq-btn--solid aq-mono" disabled={saving}>
					{saving ? "Saving…" : "Save project →"}
				</button>
			</div>
		</form>
	);
}
