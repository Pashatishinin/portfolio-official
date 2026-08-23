import type { SanityImageSource } from "@sanity/image-url";

export interface GalleryItemData {
	video: { url: string } | null;
	poster: SanityImageSource | null;
}

// Сырой ответ из GROQ — image/video ещё не превращены в URL.
export interface ProjectData {
	title: string;
	slug: string;
	year: string;
	role: string[] | null;
	tools: string[] | null;
	info: string | null;
	coverImage: SanityImageSource | null;
	heroImage: SanityImageSource | null;
	gallery: GalleryItemData[] | null;
	liveLink: string | null;
	githubLink: string | null;
	nextProjectSlug: string | null;
}

export interface ProjectVideoItem {
	src: string | null;
	poster: string;
}

// То, что реально уходит в компоненты страницы проекта.
export interface ProjectContent {
	slug: string;
	headerTitle: string;
	heroText: string;
	mainImg: string | null;
	coverImageUrl: string | null;
	videos: ProjectVideoItem[];
	info?: string;
	role: string[];
	tools: string[];
	year: string;
	nextProjectLink: string | null;
	liveLink?: string;
	githubLink?: string;
}
