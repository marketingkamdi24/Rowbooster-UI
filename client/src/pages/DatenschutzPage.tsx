import { Link } from "wouter";
import Footer from "@/components/Footer";
import rowboosterBildmarke from "@konzept/Logo/RowBooster_Bildmarke.png";

export default function DatenschutzPage() {
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
              Datenschutzerklärung
            </h1>
            <div className="h-1 w-20 bg-gradient-to-r from-[#c8fa64] to-[#17c3ce] rounded-full" />
          </div>

          {/* Content Sections */}
          <div className="space-y-10">
            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                1. Datenschutz auf einen Blick
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <h3 className="text-white font-medium">Allgemeine Hinweise</h3>
                <p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                2. Datenerfassung auf dieser Website
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <h3 className="text-white font-medium">Wer ist verantwortlich für die Datenerfassung?</h3>
                <p>Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.</p>
                
                <h3 className="text-white font-medium mt-6">Wie erfassen wir Ihre Daten?</h3>
                <p>Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich z.B. um Daten handeln, die Sie in ein Kontaktformular eingeben.</p>
                <p>Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere IT-Systeme erfasst. Das sind vor allem technische Daten (z.B. Internetbrowser, Betriebssystem oder Uhrzeit des Seitenaufrufs).</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                3. Hosting
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <p>Wir hosten die Inhalte unserer Website bei folgendem Anbieter:</p>
                <h3 className="text-white font-medium">Externes Hosting</h3>
                <p>Diese Website wird extern gehostet. Die personenbezogenen Daten, die auf dieser Website erfasst werden, werden auf den Servern des Hosters gespeichert. Hierbei kann es sich v.a. um IP-Adressen, Kontaktanfragen, Meta- und Kommunikationsdaten, Vertragsdaten, Kontaktdaten, Namen, Websitezugriffe und sonstige Daten, die über eine Website generiert werden, handeln.</p>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                4. Allgemeine Hinweise und Pflichtinformationen
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <h3 className="text-white font-medium">Datenschutz</h3>
                <p>Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.</p>
                
                <h3 className="text-white font-medium mt-6">Hinweis zur verantwortlichen Stelle</h3>
                <p>Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:</p>
                <div className="mt-2 pl-4 border-l-2 border-[#c8fa64]/30">
                  <p>RowBooster GmbH</p>
                  <p>Musterstraße 123</p>
                  <p>12345 Musterstadt</p>
                  <p className="mt-2">E-Mail: <a href="mailto:datenschutz@rowbooster.de" className="text-[#17c3ce] hover:underline">datenschutz@rowbooster.de</a></p>
                </div>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                5. Ihre Rechte
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <p>Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen.</p>
                <ul className="list-disc list-inside space-y-2 mt-4">
                  <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
                  <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
                  <li>Recht auf Löschung (Art. 17 DSGVO)</li>
                  <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
                  <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
                  <li>Widerspruchsrecht (Art. 21 DSGVO)</li>
                </ul>
              </div>
            </section>

            <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="text-[#c8fa64]">›</span>
                6. Cookies
              </h2>
              <div className="text-[#B0BAC5] leading-relaxed space-y-4">
                <p>Unsere Internetseiten verwenden so genannte „Cookies". Cookies sind kleine Datenpakete und richten auf Ihrem Endgerät keinen Schaden an. Sie werden entweder vorübergehend für die Dauer einer Sitzung (Session-Cookies) oder dauerhaft (permanente Cookies) auf Ihrem Endgerät gespeichert.</p>
                <p>Sie können Ihren Browser so einstellen, dass Sie über das Setzen von Cookies informiert werden und Cookies nur im Einzelfall erlauben, die Annahme von Cookies für bestimmte Fälle oder generell ausschließen sowie das automatische Löschen der Cookies beim Schließen des Browsers aktivieren.</p>
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
