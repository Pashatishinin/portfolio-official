import { LinkIcon } from "@sanity/icons/Link";
import { defineField, defineType } from "sanity";

export const socialLink = defineType({
  name: "socialLink",
  title: "Social link",
  type: "document",
  icon: LinkIcon,
  fields: [
    defineField({
      name: "platform",
      title: "Platform",
      type: "string",
      options: {
        list: [
          { title: "LinkedIn", value: "linkedin" },
          { title: "Behance", value: "behance" },
          { title: "Dribbble", value: "dribbble" },
          { title: "Awwwards", value: "awwwards" },
          { title: "Instagram", value: "instagram" },
          { title: "GitHub", value: "github" },
          { title: "Other", value: "other" },
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "label",
      title: "Label",
      description: "Text shown for the link, e.g. \"LinkedIn\".",
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
      name: "displayValue",
      title: "Display value",
      description: "Optional short value shown in the Contact section, e.g. a username.",
      type: "string",
    }),
    defineField({
      name: "order",
      title: "Order",
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
    select: { title: "label", subtitle: "url" },
  },
});
