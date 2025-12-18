import { Link } from "wouter";
import Footer from "@/components/Footer";
import rowboosterBildmarke from "@konzept/Logo/RowBooster_Bildmarke.png";

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0E1621] to-[#1a2332]">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 sm:px-20 py-5 bg-[#0E1621]/95 backdrop-blur-xl border-b border-white/5">
        <Link href="/" className="flex items-center gap-3">
          <img src={rowboosterBildmarke} alt="RowBooster" className="h-8 w-auto" />
          <span className="text-xl font-semibold text-white">
            Row<span className="text-[#c8fa64]">Booster</span>
          </span>
        </Link>
        <Link href="/" className="text-[#B0BAC5] hover:text-white transition-colors text-sm">
          ← Zurück zur Startseite
        </Link>
      </nav>

      {/* Content */}
      <main className="pt-32 pb-20 px-6 sm:px-20">
        <div className="max-w-[800px] mx-auto">
          {/* Header */}
          <div className="mb-12">
            <span className="inline-block px-4 py-2 rounded-full bg-[#c8fa64]/10 text-[#c8fa64] text-sm font-semibold tracking-wide mb-6">
              RECHTLICHES
            </span>
            <h1 className="text-4xl sm:text-5xl font-semibold text-white mb-6" style={{ fontFamily: 'bc-civitas, serif' }}>
              Impressum
            </h1>
            <div className="h-1 w-20 bg-gradient-to-r from-[#c8fa64] to-[#17c3ce] rounded-full" />
          </div>

          {/* Content Sections */}
          <div className="space-y-10">
            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                Angaben gemäß § 5 TMG
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-2">
                <p><strong className="text-white">RowBooster GmbH</strong></p>
                <p>Musterstraße 123</p>
                <p>12345 Musterstadt</p>
                <p>Deutschland</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                Kontakt
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-2">
                <p>Telefon: +49 (0) 123 456789</p>
                <p>E-Mail: <a href="mailto:info@rowbooster.de" className="text-[#17c3ce] hover:underline">info@rowbooster.de</a></p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                Vertreten durch
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed">
                <p>Max Mustermann (Geschäftsführer)</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                Registereintrag
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-2">
                <p>Eintragung im Handelsregister</p>
                <p>Registergericht: Amtsgericht Musterstadt</p>
                <p>Registernummer: HRB 12345</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                Umsatzsteuer-ID
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed">
                <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:</p>
                <p className="mt-2"><strong className="text-white">DE 123456789</strong></p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-2">
                <p><strong className="text-white">Max Mustermann</strong></p>
                <p>Musterstraße 123</p>
                <p>12345 Musterstadt</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                Streitschlichtung
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed">
                <p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: 
                  <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-[#17c3ce] hover:underline ml-1">
                    https://ec.europa.eu/consumers/odr
                  </a>
                </p>
                <p className="mt-4">Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
