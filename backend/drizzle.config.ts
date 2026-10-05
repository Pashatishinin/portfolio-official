import { defineConfig } from "drizzle-kit";

try {
	process.loadEnvFile();
} catch {
	// No .env file — rely on the real environment (e.g. CI / Vercel).
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
// `generate` only diffs the schema and needs no connection.
if (!url && !process.argv.includes("generate")) {
	throw new Error(
		"DATABASE_URL is empty in backend/.env — run `neon link` (or `neon env pull`) in the backend folder first.",
	);
}

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		// Migrations prefer the direct (non-pooled) connection when provided.
		url: url ?? "",
	},
});
