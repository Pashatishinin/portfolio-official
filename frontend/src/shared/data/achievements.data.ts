export interface Achievement {
	award: string;
	result: string;
	year?: string;
	img: string;
}

export const achievements: Achievement[] = [
	{
		award: "CSS Awards",
		result: "Star x 1",
		year: "2026",
		img: "/blive-cover.jpg",
	},
	{ award: "Orpetron", result: "OWDA x 1", img: "/blive-cover.jpg" },
	{
		award: "Awwwards",
		result: "Nominee x 1",
		year: "2025",
		img: "/benjamin-cover.jpg",
	},
	{ award: "CSS Awards", result: "Star x 1", img: "/benjamin-cover.jpg" },
	{ award: "Orpetron", result: "OWDA x 1", img: "/benjamin-cover.jpg" },
];
