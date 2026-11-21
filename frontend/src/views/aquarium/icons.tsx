// Stroke icons used by the project page and the client portal.
const base = {
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.6,
	viewBox: "0 0 24 24",
	"aria-hidden": true,
} as const;

export const IconLock = ({ size = 14 }: { size?: number }) => (
	<svg width={size} height={size} {...base}>
		<rect x="5" y="11" width="14" height="9" />
		<path d="M8 11V8a4 4 0 0 1 8 0v3" />
	</svg>
);

export const IconEye = ({ size = 14 }: { size?: number }) => (
	<svg width={size} height={size} {...base}>
		<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
		<circle cx="12" cy="12" r="3" />
	</svg>
);

export const IconPerson = ({ size = 14 }: { size?: number }) => (
	<svg width={size} height={size} {...base}>
		<circle cx="12" cy="8" r="4" />
		<path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
	</svg>
);

export const IconComment = ({ size = 16 }: { size?: number }) => (
	<svg width={size} height={size} {...base}>
		<path d="M4 5h16v11H9l-5 4z" />
	</svg>
);

export const IconRight = ({ size = 18 }: { size?: number }) => (
	<svg width={size} height={size} {...base}>
		<path d="M5 12h14M13 6l6 6-6 6" />
	</svg>
);

export const IconLeft = ({ size = 18 }: { size?: number }) => (
	<svg width={size} height={size} {...base}>
		<path d="M19 12H5M11 6l-6 6 6 6" />
	</svg>
);

/** Filled square for the owner, outlined for a client. */
export function Avatar({ label, client = false, small = false }: { label: string; client?: boolean; small?: boolean }) {
	const cls = `aq-ava${client ? " aq-ava--client" : ""}${small ? " aq-ava--sm" : ""}`;
	return (
		<span className={cls} aria-hidden="true">
			{label.trim().charAt(0) || "?"}
		</span>
	);
}

export const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
