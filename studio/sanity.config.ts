import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemaTypes";
import { structure } from "./structure";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET || "production";

if (!projectId) {
  throw new Error(
    "Missing SANITY_STUDIO_PROJECT_ID — copy .env.example to .env and fill in your Sanity project ID.",
  );
}

export default defineConfig({
  name: "default",
  title: "Pavlo Tishynin — Portfolio",

  projectId,
  dataset,

  plugins: [structureTool({ structure }), visionTool()],

  schema: {
    types: schemaTypes,
    // Only one Hero / About / Site Settings document should ever exist.
    templates: (templates) =>
      templates.filter(
        ({ schemaType }) =>
          !["hero", "about", "siteSettings"].includes(schemaType),
      ),
  },

  document: {
    // Hide "New document" / duplicate actions for singletons.
    actions: (input, context) =>
      ["hero", "about", "siteSettings"].includes(context.schemaType)
        ? input.filter(
            ({ action }) => action && !["duplicate", "unpublish"].includes(action),
          )
        : input,
  },
});
