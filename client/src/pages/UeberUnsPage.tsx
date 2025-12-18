import { Link } from "wouter";
import Footer from "@/components/Footer";
import rowboosterBildmarke from "@konzept/Logo/RowBooster_Bildmarke.png";

export default function UeberUnsPage() {
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

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 sm:px-20 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(ellipse,rgba(200,250,100,0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(23,195,206,0.05)_0%,transparent_60%)] pointer-events-none" />
        
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="max-w-[700px]">
            <span className="inline-block px-4 py-2 rounded-full bg-[#17c3ce]/10 text-[#17c3ce] text-sm font-semibold tracking-wide mb-6">
              ÜBER UNS
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white mb-8 leading-tight" style={{ fontFamily: 'bc-civitas, serif' }}>
              Wir machen <span className="text-[#c8fa64]">Daten</span> zu Ihrem Wettbewerbsvorteil.
            </h1>
            <p className="text-lg sm:text-xl text-[#B0BAC5] leading-relaxed">
              RowBooster wurde gegründet, um Unternehmen von der manuellen Datenarbeit zu befreien. Mit KI-gestützter Automatisierung transformieren wir chaotische Produktdaten in strukturierte, verkaufsfertige Informationen.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-6 sm:px-20 bg-[#ecf5fa] relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(23,195,206,0.03)_0%,transparent_50%)]" />
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-[#17c3ce] font-semibold text-sm tracking-wide">UNSERE MISSION</span>
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#0c2443] mt-4 mb-6" style={{ fontFamily: 'bc-civitas, serif' }}>
                Datenqualität für alle zugänglich machen
              </h2>
              <p className="text-[#5a6a7a] leading-relaxed mb-6">
                Wir glauben, dass jedes Unternehmen – unabhängig von seiner Größe – Zugang zu erstklassiger Datenverarbeitung haben sollte. Unsere KI-Plattform demokratisiert die Datenautomatisierung und macht sie für alle erschwinglich und einfach nutzbar.
              </p>
              <p className="text-[#5a6a7a] leading-relaxed">
                Mit RowBooster können Teams sich auf das konzentrieren, was wirklich zählt: Wachstum, Innovation und Kundenzufriedenheit – während unsere KI die Datenarbeit übernimmt.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-[#17c3ce]/10">
                <div className="text-4xl font-bold text-[#c8fa64] mb-2" style={{ fontFamily: 'bc-civitas, serif' }}>90%</div>
                <p className="text-[#5a6a7a] text-sm">Zeitersparnis bei der Datenverarbeitung</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-[#17c3ce]/10">
                <div className="text-4xl font-bold text-[#17c3ce] mb-2" style={{ fontFamily: 'bc-civitas, serif' }}>142M+</div>
                <p className="text-[#5a6a7a] text-sm">Datensätze verarbeitet</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-[#17c3ce]/10">
                <div className="text-4xl font-bold text-[#0c2443] mb-2" style={{ fontFamily: 'bc-civitas, serif' }}>99.9%</div>
                <p className="text-[#5a6a7a] text-sm">Verfügbarkeit garantiert</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-[#17c3ce]/10">
                <div className="text-4xl font-bold text-[#c8fa64] mb-2" style={{ fontFamily: 'bc-civitas, serif' }}>24/7</div>
                <p className="text-[#5a6a7a] text-sm">Support für Enterprise</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 px-6 sm:px-20">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#c8fa64] font-semibold text-sm tracking-wide">UNSERE WERTE</span>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white mt-4" style={{ fontFamily: 'bc-civitas, serif' }}>
              Was uns antreibt
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm hover:border-[#c8fa64]/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#c8fa64]/10 flex items-center justify-center mb-6">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Innovation</h3>
              <p className="text-[#B0BAC5] leading-relaxed">
                Wir entwickeln kontinuierlich neue KI-Modelle und Algorithmen, um die Grenzen der automatisierten Datenverarbeitung zu verschieben.
              </p>
            </div>
            
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm hover:border-[#17c3ce]/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#17c3ce]/10 flex items-center justify-center mb-6">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Partnerschaft</h3>
              <p className="text-[#B0BAC5] leading-relaxed">
                Wir sehen uns als Partner unserer Kunden. Ihr Erfolg ist unser Erfolg – deshalb gehen wir immer die Extrameile.
              </p>
            </div>
            
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm hover:border-[#c8fa64]/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#c8fa64]/10 flex items-center justify-center mb-6">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Vertrauen</h3>
              <p className="text-[#B0BAC5] leading-relaxed">
                Datensicherheit und Transparenz stehen bei uns an erster Stelle. Ihre Daten sind bei uns in sicheren Händen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-6 sm:px-20 bg-[#0a1219]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#17c3ce] font-semibold text-sm tracking-wide">UNSER TEAM</span>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white mt-4" style={{ fontFamily: 'bc-civitas, serif' }}>
              Die Menschen hinter RowBooster
            </h2>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { name: "Max Mustermann", role: "CEO & Gründer", emoji: "👨‍💼" },
              { name: "Anna Schmidt", role: "CTO", emoji: "👩‍💻" },
              { name: "Tom Weber", role: "Head of AI", emoji: "🧠" },
              { name: "Lisa Müller", role: "Head of Sales", emoji: "📈" },
            ].map((member, i) => (
              <div key={i} className="text-center group">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#c8fa64]/20 to-[#17c3ce]/20 flex items-center justify-center text-4xl border-2 border-white/10 group-hover:border-[#c8fa64]/30 transition-colors">
                  {member.emoji}
                </div>
                <h3 className="text-lg font-semibold text-white">{member.name}</h3>
                <p className="text-[#B0BAC5] text-sm">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 sm:px-20">
        <div className="max-w-[800px] mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mb-6" style={{ fontFamily: 'bc-civitas, serif' }}>
            Bereit, Ihre Daten zu transformieren?
          </h2>
          <p className="text-[#B0BAC5] text-lg mb-8">
            Starten Sie noch heute mit RowBooster und erleben Sie, wie KI Ihre Datenarbeit revolutioniert.
          </p>
          <Link href="/" className="inline-flex items-center gap-3 px-8 py-4 bg-[#c8fa64] text-[#0c2443] font-semibold rounded-full hover:bg-[#d4ff7a] transition-colors">
            Jetzt starten
            <span>›</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
