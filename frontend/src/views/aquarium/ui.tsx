import { useState } from "react";
import { faviconUrl } from "../../shared/aquarium/services";
import type { ProjectStatus } from "../../shared/aquarium/types";

export const STATUS_META: Record<ProjectStatus, { label: string }> = {
	idea: { label: "Idea" },
	active: { label: "In progress" },
	paused: { label: "Paused" },
	done: { label: "Done" },
	archived: { label: "Archived" },
};

export const STATUS_ORDER: ProjectStatus[] = ["idea", "active", "paused", "done", "archived"];

// Fixed time zone so the server render and the browser agree on the date.
const dateFormat = new Intl.DateTimeFormat("en-GB", {
	day: "2-digit",
	month: "short",
	year: "numeric",
	timeZone: "Europe/Berlin",
});

export const formatDate = (iso: string | Date) => dateFormat.format(new Date(iso)).toUpperCase();

export const pad2 = (n: number) => String(n).padStart(2, "0");

export function StatusDot({ status }: { status: ProjectStatus }) {
	return <span className={`aq-dot aq-dot--${status}`} aria-hidden="true" />;
}

/** Site favicon by domain, falling back to the first letter if it fails to load. */
export function Favicon({ host, letter, size = "sm" }: { host: string | null; letter?: string; size?: "sm" | "lg" }) {
	// Remember which host failed, so typing a new URL gets a fresh attempt.
	const [failedHost, setFailedHost] = useState<string | null>(null);
	const failed = host !== null && failedHost === host;
	const cls = `aq-fav${size === "lg" ? " aq-fav--lg" : ""}`;

	if (!host) {
		return (
			<span className={`${cls} aq-fav--empty`} aria-hidden="true">
				<span className="aq-fav__letter">+</span>
			</span>
		);
	}
	return (
		<span className={cls} aria-hidden="true">
			{failed ? (
				<span className="aq-fav__letter">{(letter || host).charAt(0)}</span>
			) : (
				<img
					src={faviconUrl(host)}
					alt=""
					width={16}
					height={16}
					loading="lazy"
					referrerPolicy="no-referrer"
					onError={() => setFailedHost(host)}
				/>
			)}
		</span>
	);
}

export const IconArrow = () => (
	<svg className="aq-res__arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
		<path d="M7 17L17 7M8 7h9v9" />
	</svg>
);

export const IconClose = ({ size = 14 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
		<path d="M6 6l12 12M18 6L6 18" />
	</svg>
);

export const IconEdit = () => (
	<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
		<path d="M4 20h4L19 9l-4-4L4 16v4z" />
		<path d="M13.5 6.5l4 4" />
	</svg>
);

export const IconTrash = () => (
	<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
		<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
	</svg>
);

export const IconSearch = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
		<circle cx="11" cy="11" r="6.5" />
		<path d="M16 16l4.5 4.5" />
	</svg>
);
