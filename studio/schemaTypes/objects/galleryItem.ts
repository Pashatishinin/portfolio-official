import { PlayIcon } from "@sanity/icons/Play";
import { defineField, defineType } from "sanity";

export const galleryItem = defineType({
  name: "galleryItem",
  title: "Gallery Item",
  type: "object",
  icon: PlayIcon,
  fields: [
    defineField({
      name: "video",
      title: "Video",
      description: "Optional — leave empty to show just the poster image.",
      type: "file",
      options: { accept: "video/mp4" },
    }),
    defineField({
      name: "poster",
      title: "Poster image",
      type: "image",
      description: "Shown while the video loads / as a fallback.",
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { media: "poster" },
    prepare: ({ media }) => ({ title: "Gallery item", media }),
  },
});
