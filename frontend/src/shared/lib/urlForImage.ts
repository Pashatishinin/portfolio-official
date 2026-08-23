import type { SanityImageSource } from "@sanity/image-url";
import { createImageUrlBuilder } from "@sanity/image-url";
import { sanityClient } from "../sanity";

const builder = createImageUrlBuilder(sanityClient);

export function urlForImage(source: SanityImageSource) {
	return builder.image(source);
}
