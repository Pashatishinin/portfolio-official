import { UserIcon } from "@sanity/icons/User";
import { defineField, defineType } from "sanity";

export const hero = defineType({
  name: "hero",
  title: "Hero",
  type: "document",
  icon: UserIcon,
  fields: [
    defineField({
      name: "firstName",
      title: "First name",
      description: "Left edge, top line.",
      type: "string",
      initialValue: "Pavlo",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "lastName",
      title: "Last name",
      description: "Left edge, bottom line.",
      type: "string",
      initialValue: "Tishynin",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "taglineLine1",
      title: "Tagline line 1",
      description: "Right edge, top line.",
      type: "string",
      initialValue: "Creative",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "taglineLine2",
      title: "Tagline line 2",
      description: "Right edge, bottom line.",
      type: "string",
      initialValue: "Technologist",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "previewTextLeft",
      title: "Preview text (left)",
      description: "Preview section, left-aligned block.",
      type: "text",
      rows: 3,
      initialValue:
        "Independent developer based in Germany, bridging the gap between high-end UI/UX and robust backend logic through pixel-perfect frontend implementation.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "previewTextRight",
      title: "Preview text (right)",
      description: "Preview section, right-aligned block.",
      type: "text",
      rows: 3,
      initialValue:
        "I transform complex ideas into aesthetically pleasing and user-friendly digital solutions.",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      firstName: "firstName",
      lastName: "lastName",
      taglineLine1: "taglineLine1",
      taglineLine2: "taglineLine2",
    },
    prepare: ({ firstName, lastName, taglineLine1, taglineLine2 }) => ({
      title: `${firstName} ${lastName}`,
      subtitle: `${taglineLine1} ${taglineLine2}`,
    }),
  },
});
