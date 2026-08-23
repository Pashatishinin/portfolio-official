import { RocketIcon } from "@sanity/icons/Rocket";
import { defineField, defineType } from "sanity";

export const milestone = defineType({
  name: "milestone",
  title: "Milestone",
  type: "document",
  icon: RocketIcon,
  fields: [
    defineField({
      name: "name",
      title: "Name",
      description: "e.g. Oliver McKenzie.",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "role",
      title: "Role",
      description: "e.g. Clothes Designer.",
      type: "string",
    }),
    defineField({
      name: "description",
      title: "Description",
      description: "Short line describing the project, e.g. \"Portfolio site with custom gallery\".",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "url",
      title: "URL",
      type: "url",
      validation: (rule) =>
        rule.required().uri({ scheme: ["http", "https"] }),
    }),
    defineField({
      name: "order",
      title: "Order",
      description: "Controls display position (lower first).",
      type: "number",
      initialValue: 0,
    }),
  ],
  orderings: [
    {
      title: "Display order",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "name", subtitle: "role" },
  },
});
