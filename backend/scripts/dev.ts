// Local dev server. In production Vercel uses src/index.ts instead.
import { serve } from "@hono/node-server";
import { app } from "../src/app";
import { env } from "../src/env";

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
	console.log(`aquarium api → http://localhost:${info.port}/api/health`);
});
