import { StarIcon } from "@sanity/icons/Star";
import { defineField, defineType } from "sanity";

export const achievement = defineType({
  name: "achievement",
  title: "Achievement",
  type: "document",
  icon: StarIcon,
  fields: [
    defineField({
      name: "award",
      title: "Award",
      description: "e.g. Awwwards, CSS Awards, Orpetron.",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "result",
      title: "Result",
      description: "e.g. Nominee x 1, Star x 1, OWDA x 1.",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "year",
      title: "Year",
      type: "string",
      validation: (rule) => rule.regex(/^\d{4}$/, { name: "4-digit year" }),
    }),
    defineField({
      name: "image",
      title: "Image",
      description: "Thumbnail for this achievement.",
      type: "image",
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
    select: { award: "award", result: "result", media: "image" },
    prepare: ({ award, result, media }) => ({
      title: award,
      subtitle: result,
      media,
    }),
  },
});
