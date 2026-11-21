import { Fragment, type ReactNode } from "react";

// http(s):// links and bare www. addresses.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
// Punctuation that usually ends the sentence, not the link: "see example.com/x."
const TRAILING = /[.,;:!?)\]}'"»]+$/;

/**
 * Plain text with every web address turned into a link that opens in a new tab.
 * Only http(s) is ever produced, so `javascript:` and friends can't sneak in.
 */
export function Linkify({ text }: { text: string }) {
	const parts: ReactNode[] = [];
	let last = 0;
	for (const match of text.matchAll(URL_RE)) {
		const start = match.index ?? 0;
		let raw = match[0];
		const tail = raw.match(TRAILING)?.[0] ?? "";
		if (tail) raw = raw.slice(0, -tail.length);
		if (!raw) continue;

		const href = raw.startsWith("www.") ? `https://${raw}` : raw;
		if (start > last) parts.push(text.slice(last, start));
		parts.push(
			<a key={start} className="aq-inline-link" href={href} target="_blank" rel="noopener noreferrer nofollow">
				{raw}
			</a>,
		);
		last = start + raw.length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return <Fragment>{parts}</Fragment>;
}
