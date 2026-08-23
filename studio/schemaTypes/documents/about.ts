import { UserIcon } from "@sanity/icons/User";
import { defineField, defineType } from "sanity";

export const about = defineType({
  name: "about",
  title: "About",
  type: "document",
  icon: UserIcon,
  fields: [
    defineField({
      name: "bioText",
      title: "Bio text",
      description: "Paragraph shown in the About section.",
      type: "text",
      rows: 4,
      initialValue:
        "As a creative web designer, I don't just sketch layouts but build real products—like my own WebApp and a collection of fresh design cases—turning complex ideas into sleek, standout interfaces where every single pixel delivers results.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "extraText1",
      title: "Extra paragraph 1",
      description: "Optional additional paragraph shown after the bio text.",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "extraText2",
      title: "Extra paragraph 2",
      description: "Optional additional paragraph shown after the bio text.",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "extraText3",
      title: "Extra paragraph 3",
      description: "Optional additional paragraph shown after the bio text.",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "image",
      title: "Image",
      description: "Wave-distorted image shown while scrolling the About section.",
      type: "image",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { bioText: "bioText", media: "image" },
    prepare: ({ bioText, media }) => ({
      title: bioText,
      media,
    }),
  },
});
