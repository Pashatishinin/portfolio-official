import type { SanityImageSource } from "@sanity/image-url";
import { urlForImage } from "../lib/urlForImage";
import type { ProjectContent, ProjectData } from "./project.types";

const getImageUrl = (
	img: SanityImageSource | null | undefined,
	width = 1920,
	quality = 85,
) =>
	img
		? urlForImage(img).width(width).quality(quality).format("webp").url()
		: null;

export const mapProjectWithUrls = ({
	title,
	slug,
	coverImage,
	heroImage,
	gallery,
	role,
	tools,
	nextProjectSlug,
	...rest
}: ProjectData): ProjectContent => ({
	...rest,
	slug,
	headerTitle: title,
	heroText: title,
	mainImg: getImageUrl(heroImage, 2400),
	coverImageUrl: getImageUrl(coverImage, 800),
	role: role ?? [],
	tools: tools ?? [],
	videos: (gallery ?? []).flatMap((item) => {
		const poster = getImageUrl(item.poster, 800);
		return poster ? [{ src: item.video?.url ?? null, poster }] : [];
	}),
	info: rest.info ?? undefined,
	nextProjectLink: nextProjectSlug ? `/project/${nextProjectSlug}` : null,
	liveLink: rest.liveLink ?? undefined,
	githubLink: rest.githubLink ?? undefined,
});
