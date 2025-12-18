import { Link } from "wouter";
import rowboosterBildmarke from "@konzept/Logo/RowBooster_Bildmarke.png";

export default function Footer() {
  return (
    <footer className="relative bg-gradient-to-b from-[#0E1621] to-[#0a1219] border-t border-white/[0.06] overflow-hidden">
      {/* Top gradient accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(200,250,100,0.3)] to-transparent" />
      
      {/* Ambient glow */}
      <div className="absolute bottom-[-50%] left-[-20%] w-[60%] h-full bg-[radial-gradient(ellipse,rgba(200,250,100,0.03)_0%,transparent_60%)] pointer-events-none" />
      
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-20 py-12 sm:py-16 lg:py-20">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-10 lg:gap-16">
          {/* Footer Links */}
          <div className="flex flex-wrap gap-12 sm:gap-16 lg:gap-24">
            {/* Produkt Column */}
            <div className="flex flex-col gap-4">
              <h4 className="font-semibold text-white text-sm tracking-wide mb-2">Produkt</h4>
              <a href="/#features" className="group relative text-sm text-[#B0BAC5] hover:text-white transition-colors duration-300">
                Features
                <span className="absolute bottom-[-2px] left-0 w-0 h-px bg-[#c8fa64] group-hover:w-full transition-all duration-300" />
              </a>
              <a href="/#preise" className="group relative text-sm text-[#B0BAC5] hover:text-white transition-colors duration-300">
                Preise
                <span className="absolute bottom-[-2px] left-0 w-0 h-px bg-[#c8fa64] group-hover:w-full transition-all duration-300" />
              </a>
              <a href="/#kontakt" className="group relative text-sm text-[#B0BAC5] hover:text-white transition-colors duration-300">
                Demo
                <span className="absolute bottom-[-2px] left-0 w-0 h-px bg-[#c8fa64] group-hover:w-full transition-all duration-300" />
              </a>
            </div>

            {/* Unternehmen Column */}
            <div className="flex flex-col gap-4">
              <h4 className="font-semibold text-white text-sm tracking-wide mb-2">Unternehmen</h4>
              <Link href="/ueber-uns" className="group relative text-sm text-[#B0BAC5] hover:text-white transition-colors duration-300">
                Über uns
                <span className="absolute bottom-[-2px] left-0 w-0 h-px bg-[#c8fa64] group-hover:w-full transition-all duration-300" />
              </Link>
              <a href="/#kontakt" className="group relative text-sm text-[#B0BAC5] hover:text-white transition-colors duration-300">
                Kontakt
                <span className="absolute bottom-[-2px] left-0 w-0 h-px bg-[#c8fa64] group-hover:w-full transition-all duration-300" />
              </a>
            </div>

            {/* Rechtliches Column */}
            <div className="flex flex-col gap-4">
              <h4 className="font-semibold text-white text-sm tracking-wide mb-2">Rechtliches</h4>
              <Link href="/impressum" className="group relative text-sm text-[#B0BAC5] hover:text-white transition-colors duration-300">
                Impressum
                <span className="absolute bottom-[-2px] left-0 w-0 h-px bg-[#c8fa64] group-hover:w-full transition-all duration-300" />
              </Link>
              <Link href="/datenschutz" className="group relative text-sm text-[#B0BAC5] hover:text-white transition-colors duration-300">
                Datenschutz
                <span className="absolute bottom-[-2px] left-0 w-0 h-px bg-[#c8fa64] group-hover:w-full transition-all duration-300" />
              </Link>
              <Link href="/agb" className="group relative text-sm text-[#B0BAC5] hover:text-white transition-colors duration-300">
                AGB
                <span className="absolute bottom-[-2px] left-0 w-0 h-px bg-[#c8fa64] group-hover:w-full transition-all duration-300" />
              </Link>
            </div>
          </div>

          {/* Footer Logo */}
          <div className="flex items-center gap-3 lg:order-last">
            <img src={rowboosterBildmarke} alt="RowBooster" className="h-10 w-auto" />
            <span className="text-xl font-semibold text-white">
              Row<span className="text-[#c8fa64]">Booster</span>
            </span>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-12 pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row justify-between items-center gap-5">
          <p className="text-[13px] text-[#6B7280]">© 2025 RowBooster. Alle Rechte vorbehalten.</p>
          
          {/* Social Links */}
          <div className="flex gap-4">
            <a 
              href="#linkedin" 
              aria-label="LinkedIn"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] text-[#B0BAC5] hover:bg-[rgba(200,250,100,0.15)] hover:border-[rgba(200,250,100,0.3)] hover:text-[#c8fa64] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(200,250,100,0.15)] transition-all duration-300"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
            <a 
              href="#twitter" 
              aria-label="Twitter"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] text-[#B0BAC5] hover:bg-[rgba(200,250,100,0.15)] hover:border-[rgba(200,250,100,0.3)] hover:text-[#c8fa64] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(200,250,100,0.15)] transition-all duration-300"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
