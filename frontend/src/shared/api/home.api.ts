import { sanityClient } from "../sanity";
import { mapAboutWithUrl, mapAchievementWithUrl } from "./home.mapper";
import type {
	AboutContent,
	AboutData,
	AchievementData,
	AchievementWithUrl,
	FooterContact,
	HeroContent,
	MilestoneRow,
} from "./home.types";

export const getAboutContent = async (): Promise<AboutContent> => {
	const data = await sanityClient.fetch<AboutData>(
		`*[_type == "about"][0] {
      bioText,
      extraText1,
      extraText2,
      extraText3,
      image
    }`,
	);

	return mapAboutWithUrl(data);
};

export const getFooterContact = () =>
	sanityClient.fetch<FooterContact>(
		`*[_type == "siteSettings"][0] {
      email,
      footerCta,
      "socialLinks": socialLinks[]-> { label, url }
    }`,
	);

export const getHeroContent = () =>
	sanityClient.fetch<HeroContent>(
		`*[_type == "hero"][0] {
      firstName,
      lastName,
      taglineLine1,
      taglineLine2,
      previewTextLeft,
      previewTextRight
    }`,
	);

export const getMilestones = () =>
	sanityClient.fetch<MilestoneRow[]>(
		`*[_type == "milestone"] | order(order asc) {
      name,
      role,
      description,
      "link": url
    }`,
	);

export const getAchievements = async (): Promise<AchievementWithUrl[]> => {
	const data = await sanityClient.fetch<AchievementData[]>(
		`*[_type == "achievement"] | order(year desc, order asc) {
      award,
      result,
      year,
      image
    }`,
	);

	return data.map(mapAchievementWithUrl);
};
