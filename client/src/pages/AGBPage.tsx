import { Link } from "wouter";
import Footer from "@/components/Footer";
import rowboosterBildmarke from "@konzept/Logo/RowBooster_Bildmarke.png";

export default function AGBPage() {
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
              Allgemeine Geschäftsbedingungen
            </h1>
            <div className="h-1 w-20 bg-gradient-to-r from-[#c8fa64] to-[#17c3ce] rounded-full" />
          </div>

          {/* Content Sections */}
          <div className="space-y-10">
            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                § 1 Geltungsbereich
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <p>(1) Diese Allgemeinen Geschäftsbedingungen (nachfolgend „AGB") gelten für alle Verträge, die zwischen der RowBooster GmbH (nachfolgend „Anbieter") und dem Kunden (nachfolgend „Kunde") über die Website rowbooster.de geschlossen werden.</p>
                <p>(2) Abweichende Bedingungen des Kunden werden nicht anerkannt, es sei denn, der Anbieter stimmt ihrer Geltung ausdrücklich schriftlich zu.</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                § 2 Vertragsgegenstand
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <p>(1) Gegenstand des Vertrages ist die Bereitstellung der RowBooster Software-as-a-Service (SaaS) Plattform zur automatisierten Datenverarbeitung und -strukturierung.</p>
                <p>(2) Der genaue Leistungsumfang ergibt sich aus der jeweiligen Leistungsbeschreibung zum Zeitpunkt der Bestellung.</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                § 3 Vertragsschluss
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <p>(1) Die Darstellung der Produkte auf der Website stellt kein rechtlich bindendes Angebot, sondern eine Aufforderung zur Bestellung dar.</p>
                <p>(2) Durch Anklicken des Buttons „Kostenpflichtig bestellen" gibt der Kunde ein verbindliches Angebot zum Abschluss eines Vertrages ab.</p>
                <p>(3) Der Vertrag kommt zustande, wenn der Anbieter das Angebot durch eine Auftragsbestätigung per E-Mail annimmt.</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                § 4 Preise und Zahlungsbedingungen
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <p>(1) Es gelten die zum Zeitpunkt der Bestellung angegebenen Preise. Alle Preise verstehen sich zzgl. der gesetzlichen Mehrwertsteuer.</p>
                <p>(2) Die Zahlung erfolgt per Kreditkarte, SEPA-Lastschrift oder auf Rechnung, je nach gewählter Zahlungsart.</p>
                <p>(3) Bei Zahlungsverzug ist der Anbieter berechtigt, Verzugszinsen in gesetzlicher Höhe zu berechnen.</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                § 5 Vertragslaufzeit und Kündigung
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <p>(1) Der Vertrag wird auf unbestimmte Zeit geschlossen, sofern nicht ausdrücklich eine feste Laufzeit vereinbart wurde.</p>
                <p>(2) Der Vertrag kann von beiden Parteien mit einer Frist von einem Monat zum Ende des jeweiligen Abrechnungszeitraums gekündigt werden.</p>
                <p>(3) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                § 6 Haftung
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <p>(1) Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit.</p>
                <p>(2) Bei leichter Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, vertragstypischen Schaden.</p>
                <p>(3) Die vorstehenden Haftungsbeschränkungen gelten nicht für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                § 7 Schlussbestimmungen
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <p>(1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.</p>
                <p>(2) Gerichtsstand für alle Streitigkeiten aus diesem Vertrag ist, soweit gesetzlich zulässig, der Sitz des Anbieters.</p>
                <p>(3) Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>
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
