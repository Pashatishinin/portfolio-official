import { CogIcon } from "@sanity/icons/Cog";
import { defineField, defineType } from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  icon: CogIcon,
  fields: [
    defineField({
      name: "email",
      title: "Contact email",
      type: "string",
      validation: (rule) => rule.required().email(),
    }),
    defineField({
      name: "footerCta",
      title: "Footer call-to-action",
      description: "e.g. \"Don't be shy\".",
      type: "string",
      initialValue: "Don't be shy",
    }),
    defineField({
      name: "socialLinks",
      title: "Social links",
      description: "Shown in the Footer and the Contact section, in this order.",
      type: "array",
      of: [{ type: "reference", to: [{ type: "socialLink" }] }],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Site Settings" }),
  },
});
