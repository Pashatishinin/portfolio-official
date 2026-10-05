/// <reference types="astro/client" />

interface ImportMetaEnv {
	/** Hono backend, e.g. http://localhost:8787 or https://api.pavlotishynin.com */
	readonly PUBLIC_API_URL?: string;
	/** Server-only: the Worker itself, e.g. https://aquarium-api.tishyninpavlo.workers.dev */
	readonly AQUARIUM_API_ORIGIN?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare namespace App {
	interface Locals {
		aquarium?: {
			user: import("./shared/aquarium/types").AquariumUser | null;
			/** Visitor's cookies, forwarded on server-side API calls. */
			cookie: string;
			unavailable?: boolean;
		};
	}
}
