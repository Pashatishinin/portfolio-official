import { CogIcon } from "@sanity/icons/Cog";
import { UserIcon } from "@sanity/icons/User";
import type { StructureResolver } from "sanity/structure";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("Hero")
        .icon(UserIcon)
        .id("hero")
        .child(S.document().schemaType("hero").documentId("hero")),
      S.listItem()
        .title("About")
        .icon(UserIcon)
        .id("about")
        .child(S.document().schemaType("about").documentId("about")),
      S.listItem()
        .title("Site Settings")
        .icon(CogIcon)
        .id("siteSettings")
        .child(
          S.document().schemaType("siteSettings").documentId("siteSettings"),
        ),
      S.divider(),
      S.documentTypeListItem("project").title("Projects"),
      S.documentTypeListItem("achievement").title("Achievements"),
      S.documentTypeListItem("milestone").title("Milestones"),
      S.documentTypeListItem("socialLink").title("Social Links"),
    ]);
