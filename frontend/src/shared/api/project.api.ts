import { sanityClient } from "../sanity";
import { mapProjectWithUrls } from "./project.mapper";
import type { ProjectContent, ProjectData } from "./project.types";

export const getProjects = async (): Promise<ProjectContent[]> => {
	const data = await sanityClient.fetch<ProjectData[]>(
		`*[_type == "project" && isVisible != false] | order(order asc) {
      title,
      "slug": slug.current,
      year,
      role,
      tools,
      info,
      coverImage,
      heroImage,
      gallery[] {
        "video": video.asset->{ url },
        poster
      },
      liveLink,
      githubLink,
      "nextProjectSlug": nextProject->slug.current
    }`,
	);

	return data.map(mapProjectWithUrls);
};
