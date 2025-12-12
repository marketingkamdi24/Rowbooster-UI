import { useEffect, useMemo, useRef } from "react";

import konceptLandingHtml from "@konzept/index.html?raw";
import logoWordmark from "@konzept/Logo/RowBooster_WortBildmarke.png";
import logoMark from "@konzept/Logo/RowBooster_Bildmarke.png";

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const html = useMemo(() => {
    // IMPORTANT:
    // - We render the concept HTML as-is (from konzept/index.html)
    // - We rewrite the CTA destinations to match the app routes
    // - We fix asset paths so Vite can serve them
    // - We remove Google Fonts for Nunito (we already ship Nunito locally via client/src/index.css)

    let patched = konceptLandingHtml;

    // Remove Google Fonts (Nunito) includes from concept HTML
    patched = patched.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/g, "");
    patched = patched.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*>\s*/g, "");
    patched = patched.replace(/\s*<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Nunito[^"]*" rel="stylesheet">\s*/g, "");

    patched = patched.replace(/\s*<link rel="stylesheet" href="https:\/\/use\.typekit\.net\/qji7pll\.css">\s*/g, "");

    patched = patched.replace(
      /--font-heading:\s*'bc-civitas',\s*Georgia,\s*serif;/g,
      "--font-heading: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    );

    // Fix logo paths (concept uses Logos/, repo uses konzept/Logo/)
    patched = patched.replaceAll("src=\"Logos/RowBooster_WortBildmarke.png\"", `src=\"${logoWordmark}\"`);
    patched = patched.replaceAll("src=\"Logos/RowBooster_Bildmarke.png\"", `src=\"${logoMark}\"`);

    // NAV: Login -> /login
    patched = patched.replaceAll("href=\"#login\"", 'href="/login"');

    // All demo/testing CTAs -> /register
    patched = patched.replaceAll("href=\"#demo\"", 'href="/register"');

    // Prices stays as anchor (href="#preise" already exists)

    // Remove inline script tag (it won't execute via dangerouslySetInnerHTML)
    patched = patched.replace(/\s*<script>[\s\S]*?<\/script>\s*/g, "");

    return patched;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const navbar = container.querySelector<HTMLElement>(".navbar");
    const burgerMenu = container.querySelector<HTMLButtonElement>(".burger-menu");
    const mobileMenu = container.querySelector<HTMLElement>(".mobile-menu");

    const onScroll = () => {
      if (!navbar) return;
      if (window.scrollY > 50) navbar.classList.add("scrolled");
      else navbar.classList.remove("scrolled");
    };

    const closeMobileMenu = () => {
      if (!burgerMenu || !mobileMenu) return;
      burgerMenu.classList.remove("active");
      mobileMenu.classList.remove("active");
      burgerMenu.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };

    const onBurgerClick = () => {
      if (!burgerMenu || !mobileMenu) return;
      burgerMenu.classList.toggle("active");
      mobileMenu.classList.toggle("active");
      const isOpen = mobileMenu.classList.contains("active");
      burgerMenu.setAttribute("aria-expanded", String(isOpen));
      document.body.style.overflow = isOpen ? "hidden" : "";
    };

    const onContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest<HTMLAnchorElement>("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href") || "";

      // Smooth scroll for internal anchors only
      if (href.startsWith("#")) {
        e.preventDefault();
        const el = container.querySelector<HTMLElement>(href);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        closeMobileMenu();
        return;
      }

      // Navigating away via mobile menu: close it
      if (href === "/login" || href === "/register") {
        closeMobileMenu();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    burgerMenu?.addEventListener("click", onBurgerClick);
    container.addEventListener("click", onContainerClick);

    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      burgerMenu?.removeEventListener("click", onBurgerClick);
      container.removeEventListener("click", onContainerClick);
      document.body.style.overflow = "";
    };
  }, []);

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />;
}