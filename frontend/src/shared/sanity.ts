import { createClient } from "@sanity/client";

export const sanityClient = createClient({
	projectId: "7caj8d3r",
	dataset: "production",
	apiVersion: "2024-01-01",
	useCdn: true,
});
