import { about } from "./documents/about";
import { achievement } from "./documents/achievement";
import { hero } from "./documents/hero";
import { milestone } from "./documents/milestone";
import { project } from "./documents/project";
import { siteSettings } from "./documents/siteSettings";
import { socialLink } from "./documents/socialLink";
import { galleryItem } from "./objects/galleryItem";

export const schemaTypes = [
  // documents
  hero,
  about,
  project,
  achievement,
  milestone,
  socialLink,
  siteSettings,
  // objects
  galleryItem,
];
