import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "server",
	adapter: cloudflare(), //
	vite: {
		plugins: [tailwindcss()],
	},

	build: {
		inlineStylesheets: "always",
	},

	integrations: [react()],
});
