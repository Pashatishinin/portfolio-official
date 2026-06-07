import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let spotlightTrigger: ScrollTrigger | null = null;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;

export function initMyWorks() {
  spotlightTrigger?.kill();
  spotlightTrigger = null;

  const section = document.querySelector<HTMLElement>(".spotlight");
  const projectIndex = document.querySelector<HTMLElement>(".project-index h1");
  const projectNames = document.querySelectorAll<HTMLElement>(".project-name");
  const projectImgs = document.querySelectorAll<HTMLElement>(".project-images > div");
  const imagesContainer = document.querySelector<HTMLElement>(".project-images");
  const currentIndexSpan = projectIndex?.querySelector(".current-index");

  if (!section || !projectIndex || !imagesContainer) return;

  const isMobile = window.innerWidth < 640;
  const paddingTop = parseFloat(getComputedStyle(section).paddingTop);
  const paddingBottom = parseFloat(getComputedStyle(section).paddingBottom);
  const moveDistanceIndex =
    section.offsetHeight - paddingTop - paddingBottom - projectIndex.offsetHeight;
  const moveDistanceImages = window.innerHeight - imagesContainer.offsetHeight;
  const imgActivationThreshold = window.innerHeight / 2;

  spotlightTrigger = ScrollTrigger.create({
    trigger: ".spotlight",
    start: "top top",
    end: `+=${window.innerHeight * 5}px`,
    pin: true,
    pinSpacing: true,
    scrub: true,
    onUpdate(self) {
      const progress = self.progress;

      if (!isMobile) gsap.set(projectIndex, { y: progress * moveDistanceIndex });
      gsap.set(imagesContainer, { y: progress * moveDistanceImages });

      let closestIdx = 0;
      let closestDist = Infinity;
      projectImgs.forEach((img, i) => {
        const { top, bottom } = img.getBoundingClientRect();
        const dist = Math.abs((top + bottom) / 2 - imgActivationThreshold);
        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
      });

      projectImgs.forEach((img, i) => {
        const isActive = i === closestIdx;
        gsap.set(img, { opacity: isActive ? 1 : 0.2 });
        img.dataset.active = isActive ? "true" : "";
        if (projectNames[i]) {
          gsap.to(projectNames[i], { opacity: isActive ? 1 : 0.1, duration: 0.15, overwrite: "auto" });
        }
      });

      if (currentIndexSpan) {
        currentIndexSpan.textContent = String(closestIdx + 1).padStart(2, "0");
      }
    },
  });
}

function handleResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    initMyWorks();
    ScrollTrigger.refresh();
  }, 200);
}

export function setupMyWorks() {
  initMyWorks();
  window.addEventListener("resize", handleResize);

  document.addEventListener("astro:after-swap", () => {
    initMyWorks();
    window.addEventListener("resize", handleResize);
  });

  document.addEventListener("astro:before-preparation", () => {
    spotlightTrigger?.kill();
    spotlightTrigger = null;
    window.removeEventListener("resize", handleResize);
    if (resizeTimer) clearTimeout(resizeTimer);
  });
}
