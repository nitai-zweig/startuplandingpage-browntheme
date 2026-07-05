/**
 * Full-page scroll experience for RPGym.
 *
 * Pairs with the `.panel` / `scroll-snap` CSS in css/styles.css: each major
 * section is sized to one viewport and the browser's native scroll-snap
 * handles the "jump to next section" feel. This script only handles the
 * fade-and-rise reveal on the content inside each section (elements marked
 * with `data-animate`) as they scroll into view.
 *
 * Kept dependency-free (no animation library) so the site stays a plain
 * static page with zero build step.
 */

function initScrollReveal() {
  const targets = document.querySelectorAll("[data-animate]");
  if (!targets.length) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    // Skip the animation entirely — just show everything immediately.
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
    },
    {
      threshold: 0.3,
      rootMargin: "0px 0px -10% 0px",
    },
  );

  targets.forEach((el) => observer.observe(el));
}

document.addEventListener("DOMContentLoaded", initScrollReveal);
