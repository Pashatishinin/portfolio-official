// Small date helpers shared by the owner's project page and the client portal.
// A fixed time zone keeps the server render and the browser in agreement.
const TZ = "Europe/Berlin";

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });

const dayKey = (date: Date) => dayKeyFmt.format(date);

/** "Today, 09:12" · "Yesterday, 18:40" · "3 Nov, 14:20" */
export function formatWhen(iso: string | Date): string {
	const date = new Date(iso);
	const now = new Date();
	const yesterday = new Date(now.getTime() - 86_400_000);
	const time = timeFmt.format(date);
	if (dayKey(date) === dayKey(now)) return `Today, ${time}`;
	if (dayKey(date) === dayKey(yesterday)) return `Yesterday, ${time}`;
	return `${dayFmt.format(date)}, ${time}`;
}

/** "just now" · "5 min ago" · "2h ago" · "3 days ago" · "3 Nov" */
export function timeAgo(iso: string | Date): string {
	const diff = Date.now() - new Date(iso).getTime();
	const min = Math.round(diff / 60_000);
	if (min < 1) return "just now";
	if (min < 60) return `${min} min ago`;
	const h = Math.round(min / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.round(h / 24);
	if (d < 14) return `${d} day${d === 1 ? "" : "s"} ago`;
	return dayFmt.format(new Date(iso));
}
