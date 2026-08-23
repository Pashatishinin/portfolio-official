import type { SanityImageSource } from "@sanity/image-url";

export interface HeroContent {
	firstName: string;
	lastName: string;
	taglineLine1: string;
	taglineLine2: string;
	previewTextLeft: string;
	previewTextRight: string;
}

// Сырой ответ из GROQ — image ещё не превращена в URL.
export interface AboutData {
	bioText: string;
	extraText1: string | null;
	extraText2: string | null;
	extraText3: string | null;
	image: SanityImageSource | null;
}

// То, что реально уходит в AboutText.astro / AboutWaveImage.astro.
export interface AboutContent {
	bioText: string;
	extraText1: string | null;
	extraText2: string | null;
	extraText3: string | null;
	imageUrl: string | null;
}

export interface SocialLinkItem {
	label: string;
	url: string;
}

export interface FooterContact {
	email: string;
	footerCta: string;
	socialLinks: SocialLinkItem[];
}

export interface MilestoneRow {
	name: string;
	role: string | null;
	description: string;
	link: string;
}

// Сырой ответ из GROQ — image ещё не превращена в URL.
export interface AchievementData {
	award: string;
	result: string;
	year: string | null;
	image: SanityImageSource | null;
}

// То, что реально уходит в AchievementItem.astro.
export interface AchievementWithUrl {
	award: string;
	result: string;
	year: string | null;
	img: string | null;
}
