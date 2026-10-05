import { z } from "zod";

const csv = z
	.string()
	.transform((value) =>
		value
			.split(",")
			.map((item) => item.trim().toLowerCase())
			.filter(Boolean),
	)
	.pipe(z.array(z.email()).min(1));

const bool = z
	.enum(["true", "false"])
	.default("true")
	.transform((value) => value === "true");

const schema = z.object({
	NODE_ENV: z.string().default("development"),
	PORT: z.coerce.number().int().positive().default(8787),

	/** Public URL of this backend, e.g. https://api.example.com (no trailing slash). */
	API_URL: z.url(),
	/** Public URL of the Astro site, e.g. https://example.com (no trailing slash). */
	FRONTEND_URL: z.url(),

	/** Only these Google accounts may sign in. Comma-separated. */
	OWNER_EMAILS: csv,

	JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
	GOOGLE_CLIENT_ID: z.string().min(1),
	GOOGLE_CLIENT_SECRET: z.string().min(1),

	/** e.g. ".example.com" when the API lives on a subdomain. Leave empty locally. */
	COOKIE_DOMAIN: z.string().optional(),
	COOKIE_SECURE: bool,

	/** Neon connection string: postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require */
	DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "DATABASE_URL must be a postgres:// connection string"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
	console.error("Invalid environment variables:");
	console.error(z.prettifyError(parsed.error));
	// Name the offending variables (never their values) so the Cloudflare
	// deploy error says what to fix.
	const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].join(", ");
	throw new Error(`Invalid environment variables: ${names}`);
}

const stripSlash = (url: string) => url.replace(/\/+$/, "");

export const env = {
	...parsed.data,
	API_URL: stripSlash(parsed.data.API_URL),
	FRONTEND_URL: stripSlash(parsed.data.FRONTEND_URL),
	COOKIE_DOMAIN: parsed.data.COOKIE_DOMAIN || undefined,
};
