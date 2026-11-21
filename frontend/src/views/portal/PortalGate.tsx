import { useState, type FormEvent } from "react";

interface Props {
	apiUrl: string;
	projectId: string;
	/** Shown when someone is signed in with an email that isn't on this project. */
	wrongEmail?: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The project link's front door: type the email Pavlo invited, and the project opens. */
export default function PortalGate({ apiUrl, projectId, wrongEmail = null }: Props) {
	const base = apiUrl.replace(/\/+$/, "");
	const [email, setEmail] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(
		wrongEmail ? `${wrongEmail} doesn’t have access to this project. Try the email Pavlo invited.` : null,
	);

	async function submit(event: FormEvent) {
		event.preventDefault();
		const value = email.trim().toLowerCase();
		if (!EMAIL.test(value)) {
			setError("That doesn’t look like an email address.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const res = await fetch(`${base}/api/portal/auth/enter`, {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ projectId, email: value }),
			});
			if (res.ok) {
				window.location.reload();
				return;
			}
			const data = (await res.json().catch(() => ({}))) as { error?: string };
			setError(
				data.error === "too_many_attempts"
					? "Too many tries. Wait a minute and try again."
					: "This email isn’t on the project. Use the address Pavlo invited, or ask him to add it.",
			);
		} catch {
			setError("Can’t reach the server. Check your connection and try again.");
		}
		setBusy(false);
	}

	return (
		<section className="aq-login" aria-labelledby="gate-title">
			<h1 className="aq-login__title" id="gate-title">
				<span className="aq-italic">welcome to the</span>
				<span className="aq-display">Aquarium</span>
			</h1>
			<p className="aq-login__sub">Enter your email to open the project. No password, no sign-up.</p>

			<form className="aq-email-form" onSubmit={submit} noValidate>
				<label className="aq-field" style={{ flex: "1 1 260px" }}>
					<span className="aq-mono aq-mono--sm">Your email</span>
					<input
						className="aq-input"
						type="email"
						autoComplete="email"
						inputMode="email"
						placeholder="you@company.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						autoFocus
					/>
				</label>
				<button type="submit" className="aq-btn aq-btn--solid aq-google" disabled={busy || !email.trim()}>
					{busy ? "Opening…" : "Open project"} <span aria-hidden="true">→</span>
				</button>
			</form>

			{error && (
				<p className="aq-login__alert" role="alert" style={{ margin: "20px 0 0", maxWidth: "46ch" }}>
					{error}
				</p>
			)}

			<p className="aq-login__aside">
				<span className="star" aria-hidden="true">
					*
				</span>
				<span className="aq-italic">the one Pavlo added to this project</span>
			</p>
		</section>
	);
}
