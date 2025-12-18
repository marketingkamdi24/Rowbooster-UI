import React, { useEffect, useMemo, useRef } from "react";
import HeroAnimation from "@/components/HeroAnimation";

import konceptLandingHtml from "@konzept/index.html?raw";
import logoWordmark from "@konzept/Logo/RowBooster_WortBildmarke.png";
import logoMark from "@konzept/Logo/RowBooster_Bildmarke.png";
import screenshotDatenboost from "@konzept/Screenshots/Datenboost.png";
import screenshotHersteller from "@konzept/Screenshots/Hersteller.png";
import screenshotToken from "@konzept/Screenshots/Token.png";

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

    // Fix screenshot paths
    patched = patched.replaceAll("src=\"Screenshots/Datenboost.png\"", `src=\"${screenshotDatenboost}\"`);
    patched = patched.replaceAll("src=\"Screenshots/Hersteller.png\"", `src=\"${screenshotHersteller}\"`);
    patched = patched.replaceAll("src=\"Screenshots/Token.png\"", `src=\"${screenshotToken}\"`);

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

    // ========================================
    // SMOOTH SCROLL - Lenis-like implementation
    // ========================================
    let currentScroll = window.scrollY;
    let targetScroll = window.scrollY;
    let isScrolling = false;
    let rafId: number | null = null;
    const ease = 0.08; // Lower = smoother, higher = snappier

    const smoothScroll = () => {
      currentScroll += (targetScroll - currentScroll) * ease;
      
      // Stop when close enough
      if (Math.abs(targetScroll - currentScroll) < 0.5) {
        currentScroll = targetScroll;
        isScrolling = false;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        return;
      }
      
      window.scrollTo(0, currentScroll);
      rafId = requestAnimationFrame(smoothScroll);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Calculate new target with momentum
      const delta = e.deltaY;
      const multiplier = e.deltaMode === 1 ? 40 : 1; // Handle line vs pixel scrolling
      targetScroll = Math.max(0, Math.min(
        document.documentElement.scrollHeight - window.innerHeight,
        targetScroll + delta * multiplier
      ));
      
      if (!isScrolling) {
        isScrolling = true;
        rafId = requestAnimationFrame(smoothScroll);
      }
    };

    // Only apply smooth scroll on desktop (not touch devices)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (!isTouchDevice) {
      window.addEventListener('wheel', handleWheel, { passive: false });
    }

    const navbar = container.querySelector<HTMLElement>(".navbar");
    const burgerMenu = container.querySelector<HTMLButtonElement>(".burger-menu");
    const mobileMenu = container.querySelector<HTMLElement>(".mobile-menu");

    // ========================================
    // HERO ENTRANCE ANIMATION - Clean, Staggered
    // ========================================
    const heroHeadline = container.querySelector<HTMLElement>(".hero-headline");
    const heroDescription = container.querySelector<HTMLElement>(".hero-description");
    const heroCta = container.querySelector<HTMLElement>(".hero-cta");

    // Hide all elements completely at start
    if (heroHeadline) {
      heroHeadline.style.opacity = "0";
      heroHeadline.style.transform = "translateY(30px)";
    }
    if (heroDescription) {
      heroDescription.style.opacity = "0";
      heroDescription.style.transform = "translateY(25px)";
    }
    if (heroCta) {
      heroCta.style.opacity = "0";
      heroCta.style.transform = "translateY(20px)";
    }

    // Hero Screenshots - get all cards
    const heroScreenshotCards = container.querySelectorAll<HTMLElement>(".hero-screenshot-card");
    
    // Hide screenshots initially
    heroScreenshotCards.forEach((card, i) => {
      card.style.opacity = "0";
      card.style.transform = `translateX(100px) translateY(${40 + i * 20}px) scale(0.9)`;
    });

    // Staggered animation: Headline first, then text shortly after, then button last
    setTimeout(() => {
      if (heroHeadline) {
        heroHeadline.style.transition = "opacity 1s ease-out, transform 1s ease-out";
        heroHeadline.style.opacity = "1";
        heroHeadline.style.transform = "translateY(0)";
      }
    }, 300);

    setTimeout(() => {
      if (heroDescription) {
        heroDescription.style.transition = "opacity 1s ease-out, transform 1s ease-out";
        heroDescription.style.opacity = "1";
        heroDescription.style.transform = "translateY(0)";
      }
    }, 500);

    setTimeout(() => {
      if (heroCta) {
        heroCta.style.transition = "opacity 0.8s ease-out, transform 0.8s ease-out";
        heroCta.style.opacity = "1";
        heroCta.style.transform = "translateY(0)";
      }
    }, 900);

    // Animate Hero Screenshots with stagger
    heroScreenshotCards.forEach((card, i) => {
      setTimeout(() => {
        card.style.transition = "opacity 1s cubic-bezier(0.23, 1, 0.32, 1), transform 1s cubic-bezier(0.23, 1, 0.32, 1)";
        card.style.opacity = "1";
        card.style.transform = "translateX(0) translateY(0) scale(1)";
      }, 600 + i * 200);
    });

    // ========================================
    // SCROLL ANIMATIONS
    // ========================================
    const featureHeadline = container.querySelector<HTMLElement>(".feature-headline");
    const featureDescription = container.querySelector<HTMLElement>(".feature-description");
    const datenchaosContent = container.querySelector<HTMLElement>(".datenchaos-content");
    const solutionContent = container.querySelector<HTMLElement>(".solution-content");
    const screenshotCards = container.querySelectorAll<HTMLElement>(".screenshot-card-eff");
    const counterNumber = container.querySelector<HTMLElement>(".counter-number");
    const testimonialsHeadline = container.querySelector<HTMLElement>(".testimonials-headline");
    const testimonialCards = container.querySelectorAll<HTMLElement>(".testimonial-card");
    const testimonialsCta = container.querySelector<HTMLElement>(".testimonials-cta");
    const kontaktHeadline = container.querySelector<HTMLElement>(".kontakt-headline");
    
    let featureHeadlineDone = false;
    let featureDescriptionDone = false;
    let datenchaosDone = false;
    let solutionDone = false;
    let screenshotsDone = false;
    let counterDone = false;
    let testimonialsHeadlineDone = false;
    let testimonialCardsDone = false;
    let testimonialsCtaDone = false;
    let kontaktHeadlineDone = false;

    // Setup: slide from left
    const setupFromLeft = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.opacity = "0";
      el.style.transform = "translateX(-50px)";
      el.style.transition = "opacity 0.9s ease-out, transform 0.9s ease-out";
    };

    // Setup: fade up with blur
    const setupFadeUp = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.opacity = "0";
      el.style.filter = "blur(10px)";
      el.style.transform = "translateY(30px)";
      el.style.transition = "opacity 0.9s ease-out, filter 0.9s ease-out, transform 0.9s ease-out";
    };

    const animateFromLeft = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.opacity = "1";
      el.style.transform = "translateX(0)";
    };

    const animateFadeUp = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.opacity = "1";
      el.style.filter = "blur(0px)";
      el.style.transform = "translateY(0)";
    };

    // Feature section: slide from left
    setupFromLeft(featureHeadline);
    setupFromLeft(featureDescription);
    
    // Other sections: fade up with blur
    setupFadeUp(datenchaosContent);
    setupFadeUp(solutionContent);

    // Screenshots: hide initially, will animate from right
    screenshotCards.forEach((card, i) => {
      card.style.opacity = "0";
      card.style.transform = `translateX(80px) translateY(${i * 60}px)`;
      card.style.transition = `opacity 0.8s ease-out ${i * 0.15}s, transform 0.8s ease-out ${i * 0.15}s`;
    });

    // Testimonials: setup
    setupFromLeft(testimonialsHeadline);
    testimonialCards.forEach((card, i) => {
      card.style.opacity = "0";
      card.style.transform = `translateY(40px) rotateY(${i === 0 ? '3deg' : '-3deg'})`;
      card.style.transition = `opacity 0.9s ease-out, transform 0.9s ease-out`;
    });
    if (testimonialsCta) {
      testimonialsCta.style.opacity = "0";
      testimonialsCta.style.transform = "translateY(30px)";
      testimonialsCta.style.transition = "opacity 0.8s ease-out, transform 0.8s ease-out";
    }

    // Kontakt: setup
    setupFromLeft(kontaktHeadline);

    const checkAnimation = () => {
      const trigger = window.innerHeight * 0.85;
      
      // Feature headline
      if (!featureHeadlineDone && featureHeadline) {
        const rect = featureHeadline.getBoundingClientRect();
        if (rect.top < trigger) {
          animateFromLeft(featureHeadline);
          featureHeadlineDone = true;
          
          // Animate description shortly after
          setTimeout(() => {
            animateFromLeft(featureDescription);
            featureDescriptionDone = true;
          }, 200);
        }
      }
      
      if (!datenchaosDone && datenchaosContent) {
        const rect = datenchaosContent.getBoundingClientRect();
        if (rect.top < trigger) {
          animateFadeUp(datenchaosContent);
          datenchaosDone = true;
        }
      }
      
      if (!solutionDone && solutionContent) {
        const rect = solutionContent.getBoundingClientRect();
        if (rect.top < trigger) {
          animateFadeUp(solutionContent);
          solutionDone = true;
        }
      }

      // Screenshots animation
      if (!screenshotsDone && screenshotCards.length > 0) {
        const firstCard = screenshotCards[0];
        const rect = firstCard.getBoundingClientRect();
        if (rect.top < trigger) {
          screenshotCards.forEach((card, i) => {
            card.style.opacity = "1";
            card.style.transform = `translateX(0) translateY(0)`;
          });
          screenshotsDone = true;
        }
      }

      // Counter animation - starts at base value and slowly increments
      if (!counterDone && counterNumber) {
        const rect = counterNumber.getBoundingClientRect();
        if (rect.top < trigger) {
          const baseValue = parseInt(counterNumber.getAttribute("data-target") || "0", 10);
          let currentValue = baseValue;
          
          // Show initial value immediately
          counterNumber.textContent = currentValue.toLocaleString("de-DE");
          
          // Increment by ~100 per second (every 10ms add ~1)
          const incrementInterval = setInterval(() => {
            currentValue += Math.floor(Math.random() * 3) + 1; // Random 1-3 per tick
            counterNumber.textContent = currentValue.toLocaleString("de-DE");
          }, 10);
          
          counterDone = true;
        }
      }

      // Testimonials headline animation
      if (!testimonialsHeadlineDone && testimonialsHeadline) {
        const rect = testimonialsHeadline.getBoundingClientRect();
        if (rect.top < trigger) {
          animateFromLeft(testimonialsHeadline);
          testimonialsHeadlineDone = true;
        }
      }

      // Testimonial cards animation
      if (!testimonialCardsDone && testimonialCards.length > 0) {
        const firstCard = testimonialCards[0];
        const rect = firstCard.getBoundingClientRect();
        if (rect.top < trigger) {
          testimonialCards.forEach((card, i) => {
            setTimeout(() => {
              card.style.opacity = "1";
              card.style.transform = `translateY(0) rotateY(${i === 0 ? '3deg' : '-3deg'})`;
            }, i * 200);
          });
          testimonialCardsDone = true;
          
          // Animate CTA button after cards
          setTimeout(() => {
            if (testimonialsCta) {
              testimonialsCta.style.opacity = "1";
              testimonialsCta.style.transform = "translateY(0)";
              testimonialsCtaDone = true;
            }
          }, testimonialCards.length * 200 + 300);
        }
      }

      // Kontakt headline animation
      if (!kontaktHeadlineDone && kontaktHeadline) {
        const rect = kontaktHeadline.getBoundingClientRect();
        if (rect.top < trigger) {
          animateFromLeft(kontaktHeadline);
          kontaktHeadlineDone = true;
        }
      }
    };

    // ========================================
    // UNTERNEHMEN LIEBEN SECTION ANIMATIONS
    // ========================================
    const untAnimateElements = container.querySelectorAll<HTMLElement>('.unt-animate-in');
    const untMainCounter = container.querySelector<HTMLElement>('#unt-main-counter');
    let untCounterAnimated = false;

    // Intersection Observer for unt-animate-in elements
    const untObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('unt-visible');
          
          // Start counter animation when counter section is visible
          if (entry.target.classList.contains('unt-counter-section') && !untCounterAnimated) {
            untCounterAnimated = true;
            startUntCounterAnimation();
          }
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -50px 0px' });

    untAnimateElements.forEach(el => {
      untObserver.observe(el);
    });

    // Counter Animation with easing
    function startUntCounterAnimation() {
      if (!untMainCounter) return;

      const target = parseInt(untMainCounter.dataset.target || '142855309');
      const duration = 3000;
      const startTime = performance.now();

      function easeOutExpo(t: number): number {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      }

      function formatNumber(num: number): string {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      }

      function updateCounter(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutExpo(progress);
        const currentValue = Math.floor(easedProgress * target);
        
        untMainCounter!.textContent = formatNumber(currentValue);

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        } else {
          // Add subtle increment after animation completes
          const incrementInterval = setInterval(() => {
            const current = parseInt(untMainCounter!.textContent!.replace(/\./g, ''));
            untMainCounter!.textContent = formatNumber(current + Math.floor(Math.random() * 50) + 10);
          }, 3000);
        }
      }

      requestAnimationFrame(updateCounter);
    }

    // ========================================
    // TESTIMONIALS SLIDER
    // ========================================
    const testimonialsSlider = container.querySelector<HTMLElement>('#testimonials-slider');
    const testimonialsDots = container.querySelectorAll<HTMLButtonElement>('.testimonials-dot');
    const prevBtn = container.querySelector<HTMLButtonElement>('.testimonials-nav-prev');
    const nextBtn = container.querySelector<HTMLButtonElement>('.testimonials-nav-next');
    
    if (testimonialsSlider) {
      let currentSlide = 0;
      const totalSlides = testimonialsSlider.querySelectorAll('.testimonial-card').length;
      let isDragging = false;
      let startX = 0;
      let scrollLeft = 0;

      const updateDots = (index: number) => {
        testimonialsDots.forEach((dot, i) => {
          dot.classList.toggle('active', i === index);
        });
      };

      const scrollToSlide = (index: number) => {
        if (!testimonialsSlider) return;
        const cardWidth = testimonialsSlider.offsetWidth;
        testimonialsSlider.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
        currentSlide = index;
        updateDots(index);
      };

      // Navigation buttons
      prevBtn?.addEventListener('click', () => {
        const newIndex = currentSlide > 0 ? currentSlide - 1 : totalSlides - 1;
        scrollToSlide(newIndex);
      });

      nextBtn?.addEventListener('click', () => {
        const newIndex = currentSlide < totalSlides - 1 ? currentSlide + 1 : 0;
        scrollToSlide(newIndex);
      });

      // Pagination dots
      testimonialsDots.forEach((dot) => {
        dot.addEventListener('click', () => {
          const index = parseInt(dot.dataset.index || '0');
          scrollToSlide(index);
        });
      });

      // Update dots on scroll
      testimonialsSlider.addEventListener('scroll', () => {
        if (isDragging) return;
        const cardWidth = testimonialsSlider.offsetWidth;
        const newIndex = Math.round(testimonialsSlider.scrollLeft / cardWidth);
        if (newIndex !== currentSlide && newIndex >= 0 && newIndex < totalSlides) {
          currentSlide = newIndex;
          updateDots(newIndex);
        }
      });

      // Mouse drag support
      testimonialsSlider.addEventListener('mousedown', (e) => {
        isDragging = true;
        testimonialsSlider.classList.add('is-dragging');
        startX = e.pageX - testimonialsSlider.offsetLeft;
        scrollLeft = testimonialsSlider.scrollLeft;
      });

      testimonialsSlider.addEventListener('mouseleave', () => {
        if (isDragging) {
          isDragging = false;
          testimonialsSlider.classList.remove('is-dragging');
        }
      });

      testimonialsSlider.addEventListener('mouseup', () => {
        isDragging = false;
        testimonialsSlider.classList.remove('is-dragging');
      });

      testimonialsSlider.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - testimonialsSlider.offsetLeft;
        const walk = (x - startX) * 1.5;
        testimonialsSlider.scrollLeft = scrollLeft - walk;
      });

      // Touch support is native via CSS scroll-snap
    }

    const onScroll = () => {
      if (!navbar) return;
      if (window.scrollY > 50) navbar.classList.add("scrolled");
      else navbar.classList.remove("scrolled");
      
      checkAnimation();
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
          // Use our smooth scroll system on desktop
          if (!isTouchDevice) {
            const rect = el.getBoundingClientRect();
            targetScroll = window.scrollY + rect.top - 80; // 80px offset for navbar
            targetScroll = Math.max(0, Math.min(
              document.documentElement.scrollHeight - window.innerHeight,
              targetScroll
            ));
            if (!isScrolling) {
              isScrolling = true;
              rafId = requestAnimationFrame(smoothScroll);
            }
          } else {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
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
      untObserver.disconnect();
      // Cleanup smooth scroll
      if (!isTouchDevice) {
        window.removeEventListener('wheel', handleWheel);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Inject HeroAnimation directly into the effektiv section placeholder
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const placeholder = container.querySelector("#effektiv-animation-placeholder");
      if (!placeholder) return;
      
      // Check if already rendered
      if (placeholder.querySelector("#effektiv-animation-wrapper")) return;
      
      // Create a wrapper div for the animation
      const wrapper = document.createElement("div");
      wrapper.id = "effektiv-animation-wrapper";
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
      placeholder.appendChild(wrapper);
      
      // Render React component into the wrapper
      import('react-dom/client').then(({ createRoot }) => {
        const root = createRoot(wrapper);
        root.render(<HeroAnimation />);
      });
    });
  }, []);

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />;
}