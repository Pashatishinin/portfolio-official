import type { SanityImageSource } from "@sanity/image-url";
import { urlForImage } from "../lib/urlForImage";
import type {
	AboutContent,
	AboutData,
	AchievementData,
	AchievementWithUrl,
} from "./home.types";

const getImageUrl = (
	img: SanityImageSource | null | undefined,
	width = 1440,
	quality = 85,
) =>
	img
		? urlForImage(img).width(width).quality(quality).format("webp").url()
		: null;

export const mapAchievementWithUrl = ({
	image,
	...rest
}: AchievementData): AchievementWithUrl => ({
	...rest,
	img: getImageUrl(image, 800),
});

export const mapAboutWithUrl = ({
	image,
	...rest
}: AboutData): AboutContent => ({
	...rest,
	imageUrl: getImageUrl(image, 1200),
});
