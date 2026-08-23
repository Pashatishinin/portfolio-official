import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

function initNameRollHover() {
	const triggersEls = document.querySelectorAll(
		"#milestones .name-roll-trigger",
	);

	triggersEls.forEach((trigger) => {
		if (trigger.getAttribute("data-animated")) return;

		const texts = trigger.querySelectorAll(".name-roll-text");
		if (texts.length < 2) return;

		const [firstText, secondText] = texts;
		const split1 = new SplitText(firstText, { type: "chars" });
		const split2 = new SplitText(secondText, { type: "chars" });

		gsap.set(secondText, { opacity: 1 });
		gsap.set(split2.chars, { yPercent: 100 });

		const tl = gsap.timeline({ paused: true });

		tl.to(split1.chars, {
			yPercent: -100,
			stagger: 0.02,
			duration: 0.4,
			ease: "power2.inOut",
		}).to(
			split2.chars,
			{ yPercent: 0, stagger: 0.02, duration: 0.4, ease: "power2.inOut" },
			"<",
		);

		trigger.addEventListener("mouseenter", () => tl.play());
		trigger.addEventListener("mouseleave", () => tl.reverse());

		trigger.setAttribute("data-animated", "true");
	});
}

let triggers: ScrollTrigger[] = [];

function initMilestonesAnimation() {
	triggers.forEach((trigger) => {
		trigger.kill();
	});
	triggers = [];

	const section = document.querySelector("#milestones");
	const rows = document.querySelectorAll("#milestones .milestone-row");
	if (!section || rows.length === 0) return;

	const maxGap = window.innerWidth < 1000 ? 15 : 20;

	triggers.push(
		ScrollTrigger.create({
			trigger: section,
			start: "top bottom",
			end: "bottom top",
			onToggle: (self) => section.classList.toggle("is-active", self.isActive),
		}),
	);

	const crystal = document.querySelector<HTMLElement>("body > three-crystal");
	if (crystal) {
		const scaleTween = gsap.to((crystal as any).target, {
			scale: 0,
			ease: "none",
			scrollTrigger: {
				trigger: section,
				start: "top bottom",
				end: "bottom top",
				scrub: true,
			},
		});
		if (scaleTween.scrollTrigger) triggers.push(scaleTween.scrollTrigger);
	}

	rows.forEach((row) => {
		const cells = row.querySelectorAll<HTMLElement>(".milestone-cell");
		const [label, value] = cells;
		if (!label || !value) return;

		const setOffset = (offsetRem: number) => {
			label.style.transform = `translateX(-${offsetRem}rem)`;
			value.style.transform = `translateX(${offsetRem}rem)`;
		};

		triggers.push(
			ScrollTrigger.create({
				trigger: row,
				start: "40% center+=100",
				end: "80% center",
				scrub: true,
				onUpdate: (self) => setOffset((maxGap / 2) * self.progress),
			}),
		);

		triggers.push(
			ScrollTrigger.create({
				trigger: row,
				start: "center center-=50",
				end: "center center-=150",
				scrub: true,
				onUpdate: (self) => setOffset((maxGap / 2) * (1 - self.progress)),
			}),
		);
	});

	initNameRollHover();
}

export function setupMilestonesAnimation() {
	document.addEventListener("astro:page-load", initMilestonesAnimation);
	document.addEventListener("astro:before-preparation", () => {
		triggers.forEach((trigger) => {
			trigger.kill();
		});
		triggers = [];
	});
}
