# RowBooster Landingpage – Design System & Seiten-Konzept (Implementationsnah)

## 1. Ziel & Scope

Dieses Dokument beschreibt ein konsistentes, implementierbares Konzept für die RowBooster Landingpage.

Es umfasst:
- Farben (Tokens, Semantik, Kontrastregeln)
- Typografie (Fonts, Größen, Zeilenhöhen, Gewichtungen)
- Spacing-System (Abstände, Grid, Container, Breakpoints)
- Komponenten & UI-Patterns (Navbar, Hero, Cards, Pricing, Formulare, Footer)
- Hintergründe & Layering (Gradients, Grid-Overlays, Ambient Glows, Noise)
- Motion/Animationen (Keyframes, Trigger, Timings, Easing, Reduced Motion)
- Abhängigkeiten & technische Hinweise (Fonts, JS Interactions, Observer)

Dateien/Referenzen im Projekt (Quellen der Analyse):
- `index.html`
- `hero_section.html`
- `datenchaos_section.html`
- `effektiv_section.html`
- `features_ki_section.html`
- `unternehmen_lieben_section.html`
- `testimonials_modul.html`
- `pricing_section.html`
- `kontakt_section.html`
- `footer_section.html`
- `Landingpage_Screenshot (1).png`


## 2. Design-Philosophie (Leitlinien)

- **High-Contrast, Dark-First** in den oberen, emotionalen Bereichen (Hero/Proof/Features), ergänzt durch **Light Sections** für Lesbarkeit (Problem/Solution/Kontakt).
- **Akzente sparsam, aber stark** (Cyan und Lime/Green), bevorzugt:
  - Akzent auf dunklem Hintergrund
  - als Border/Glow/Gradient
  - als Micro-Element (Badge, Icon, Underline)
- **Glassmorphism** als Premium-Anmutung für Cards: `rgba(255,255,255,0.02–0.08)` + `backdrop-filter: blur(10–20px)`.
- **Klare Hierarchie** über:
  - Headline Font (BC Civitas)
  - große, ruhige Typo-Blöcke
  - großzügige Section-Paddings
- **Motion als Feedback** (Hover/Focus) und als **Entrance/Scroll Reveal** (Intersection Observer).


## 3. Farb-System

### 3.1 Kernfarben (Brand Tokens)

**Primär (Dark Brand)**
- `--color-primary: #0c2443` (Brand-Dunkelblau; viele Dark Sections)
- `--color-primary-dark: #0E1621` (Very Dark; Navbar, Dark Gradients)
- `--color-secondary: #1a2332` (Dark Secondary; Dark Gradient-Ende, Zwischenflächen)

**Neutrals**
- `--color-white: #ffffff`
- `--color-light: #ecf5fa` (Off-White / Light Background)
- `--color-dark: #1e1e1e` (Text auf hellen Flächen)

**Akzente**
- `--color-cyan: #17c3ce` (Cyan/Türkis; Highlights, Glows, CTAs, Lines)
- `--color-lime: #c8fa64` (Lime/Green; Hero Accent, Dots, Icon-Highlights)

**Status**
- `--color-error: #e53935` (Fehler/Problem-Text)


### 3.2 Semantische Textfarben

**Auf dunklen Hintergründen**
- `--color-text: #ffffff`
- `--color-text-muted: #B0BAC5` (Subtext, Navigation)

**Auf hellen Hintergründen**
- `--color-text-dark: #1e1e1e`
- `--color-text-muted-dark: #5a6a7a`


### 3.3 Gradient-Rezepte (Background Tokens)

**Dark Base Gradient**
- Nutzung: Hero, Footer, Pricing/Testimonials ähnliche Stimmung
- Muster:
  - `linear-gradient(135deg, #0E1621 0%, #1a2332 100%)`
  - `linear-gradient(180deg, #0E1621 0%, #0a1219 100%)` (Footer)

**Hero Diagonal Split**
- Nutzung: `index.html` Hero Diagonal Hintergrund
- Muster:
  - Rechte Seite: `linear-gradient(180deg, #0a1a2e 0%, #050d18 100%)`
  - Clip: `clip-path: polygon(30% 0, 100% 0, 100% 100%, 0% 100%)`

**Light Section Ambient**
- Nutzung: Datenchaos / Solution / Kontakt
- Muster:
  - `background: #ecf5fa`
  - `::before` mit radialen weichen Glows:
    - `rgba(23,195,206,0.03)`
    - `rgba(12,36,67,0.02)`


### 3.4 Kontrast- und Einsatzregeln

- **Lime (`#c8fa64`)** bevorzugt auf dunklen Hintergründen.
- **Cyan (`#17c3ce`)** funktioniert auf dunkel und hell.
- Auf Light Sections:
  - Akzent eher Cyan nutzen (Links/Focus-Rings/Gradients)
  - Lime nur sehr dosiert (z.B. als kleiner Badge, nicht als großer Flächen-Fill)


## 4. Typografie-System

### 4.1 Fonts

- **Headings**: `bc-civitas` (Typekit)
  - Einbindung: `https://use.typekit.net/qji7pll.css`
- **Body**: `Nunito` (Google Fonts)
  - Einbindung: `https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800&display=swap`


### 4.2 Grundregeln

- Headlines: **kräftig** (typisch `600` oder `700` in den finalen Sections)
- Body: `400` als Standard, `600/700` für Hervorhebungen
- Standard Line-Heights:
  - Headline: `1.1–1.2`
  - Body: `1.6–1.9`


### 4.3 Typo-Skala (implementationsnah)

**Hero H1**
- Font: `bc-civitas`
- Size: `clamp(42px, 5vw, 68px)` (oder 62px fix in `index.html` Variante)
- Weight: `600`
- Letter spacing: `-0.5px` bis `-1px`

**Section H2 (Dark / Feature)**
- Size: `clamp(36px, 5vw, 64px)`
- Weight: `600`

**Section H2 (Light / Problem-Solution)**
- Size: `clamp(30px, 4vw, 46px)` bis `clamp(34px, 4.5vw, 52px)`
- Weight: `600` (final) bzw. in einigen Files `400`

**Body / Subheadline**
- Size: `clamp(16px, 1.2vw, 19px)` bzw. `clamp(16px, 1.3vw, 20px)`
- Weight: `400`
- Muted Color: `#B0BAC5` oder `#5a6a7a`

**Micro / Eyebrow / Badge**
- Size: `12–14px`
- Weight: `600–700`
- Letter spacing: `1px` bis `3px`
- Uppercase


### 4.4 Typografische Patterns

- **Accent-Wort** in Headlines:
  - Dark: Lime als Highlight (z.B. `span.accent`, `span.hero-accent`)
  - Light: Cyan als Highlight (z.B. Kontakt: `span.accent`)
- **Hervorhebungen im Fließtext** über `strong`:
  - Light: `color: #1e1e1e; font-weight: 700`
  - Dark: `color: #fff; font-weight: 600`


## 5. Layout, Grid, Container

### 5.1 Container-Breiten

- **Max Layout (Large)**: `1440px` (Hero, Navbar, Footer, Effektiv)
- **Content (Balanced)**: `1200–1320px` (Datenchaos/Solution, Pricing, Kontakt)
- **Bento / Features**: bis `1400px` (Features KI)


### 5.2 Standard-Section-Paddings

**Desktop**
- Horizontal: `80px` (häufig)
- Vertical: `80–140px` abhängig von Section

**Fluid (clamp)**
- Beispiel: `padding: clamp(80px, 12vw, 160px) clamp(24px, 6vw, 100px)`

**Mobile**
- Horizontal: `20–24px`
- Vertical: `40–80px`


### 5.3 Spacing System (Token-Logik)

Empfohlene Abstands-Skala (aus realem Code abgeleitet):
- `8px` (XS)
- `12px` (XS+)
- `16px` (S)
- `20px` (S+)
- `24px` (M)
- `28px` (M+)
- `32px` (L)
- `40px` (XL)
- `48px` (2XL)
- `60px` (3XL)
- `80px` (4XL)
- `100px` (5XL)
- `120px` (6XL)
- `140px` (7XL)
- `160px` (8XL)

Konsequente Anwendung:
- Inner-Spacing in Cards: `24–48px`
- Headline → Paragraph: `16–32px`
- Paragraph → CTA: `28–48px`


### 5.4 Breakpoints (tatsächlich genutzt)

- `<= 1200px` (große Tablets/kleine Laptops)
- `<= 1024px` (Tablets)
- `<= 768px` (Mobile)
- `<= 576px` (klein)
- `<= 480px` (sehr klein)
- `<= 360px` / `<= 400px` (extra klein)


## 6. Layering, Hintergründe, Patterns

### 6.1 Globaler Fixed Grid Background (Dark Only)

Quelle: `index.html`
- Element: `.grid-background`
- Position: `fixed; inset: 0; z-index: -1; pointer-events: none`
- Pattern:
  - `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)`
  - + `linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`
  - `background-size: 60px 60px`

Design-Intention:
- Subtiles Tech-Grid, sichtbar in Dark Sections
- Nicht auf Light Backgrounds dominieren


### 6.2 Ambient Glows (Radial Gradients)

Typische Rezepte:
- **Dark Ambient**: `rgba(200,250,100,0.04–0.08)` und `rgba(23,195,206,0.03–0.08)`
- **Light Ambient**: `rgba(23,195,206,0.03)` und `rgba(12,36,67,0.02)`

Platzierung:
- top-left / bottom-right als Gegengewichte
- oft über `::before` / `::after`, `pointer-events: none`


### 6.3 Noise / Texture (optional)

Quelle: `zeitersparnis_modul.html`
- Ansatz: SVG `feTurbulence` als Data-URL, sehr geringe Opacity (z.B. `0.03`)
- Einsatz:
  - Nur in sehr dunklen, cinematischen Sections
  - Nicht in jeder Section (sonst wirkt es schmutzig)


### 6.4 Vignette

Quelle: `zeitersparnis_modul.html`
- `radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.6) 100%)`
- Einsatz:
  - Fokuszentrierung (KPI/Metric Cards)


## 7. Komponenten-Bibliothek (UI Patterns)

### 7.1 Navbar (Fixed Header)

Quelle: `index.html`

**Layout**
- `position: fixed; top:0; left:0; right:0; z-index: 1000`
- Padding Desktop: `20px 80px` → on scroll `16px 80px`
- Background: `rgba(14,22,33,0.95)` + `backdrop-filter: blur(20px)`
- Border bottom: `1px solid rgba(255,255,255,0.05)`

**States**
- `.navbar.scrolled`:
  - `box-shadow: 0 4px 30px rgba(0,0,0,0.3)`
  - etwas dichterer Hintergrund

**Navigation Links**
- Default: `color: #B0BAC5`, `font-weight: 500`, `font-size: 15px`
- Hover:
  - Text: `#fff`
  - Underline: pseudo element `::after` mit `height:2px` und `background: var(--color-lime)`

**CTA in Navbar**
- Pill: `border-radius: 50px`
- Border: `2px solid var(--color-lime)`
- Hover: Background Lime, Text Dark

**Mobile**
- Breakpoint `<= 768px`:
  - Desktop Nav hidden
  - Burger aktiv
  - Mobile Menu Overlay (Full Screen) mit staggered link transitions


### 7.2 Hero (Dark, Diagonal Split)

Quelle: `index.html`

**Container**
- `.hero-wrapper` Background: `--color-primary`
- `.hero`:
  - `max-width: 1440px; margin: 0 auto`
  - Padding Desktop: `80px 80px 120px`
  - Layout: 2-column (Text links, Decoration rechts; in `index.html` ist die Decoration in Teilen reduziert)

**Headline**
- H1 BC Civitas, groß, `font-weight: 600`
- Accent Wort: Lime

**Primary CTA (Hero)**
- Pill Button, Outline White
- Hover:
  - Background: `rgba(255,255,255,0.1)`
  - leichte X-Translation `translateX(4px)`

**Decoration Layer**
- Dots: kleine Lime-Punkte, `opacity 0.3–1` (twinkle)
- Line + Circle: lineare Gradient Linie + Glow Circle
- Curved Background: `hero::before` radialer großer Kreis für Tiefe


### 7.3 Feature-Intro „RowBooster sorgt für Ordnung“

Quelle: `index.html` / `landing_page_clean.html`

- Background: `#1a2332`
- Centered content:
  - `max-width: 1000px` outer
  - `max-width: 800px` inner
- Headline H2:
  - Inline Icon `›` als Lead
  - Weight: `600`
- Description:
  - Muted
  - `strong` in White


### 7.4 Problem/Solution Visual Section (Datenchaos)

Quelle: `datenchaos_section.html` (+ `index.html` integriert)

**Layout**
- Grid 2 Spalten: `1fr 1.1fr` (Problem + Illustration)
- max width: `1320px`
- Gap: `clamp(48px, 8vw, 120px)`

**Illustration (CSS-built)**
- „System Box“ als Fenster-Card:
  - White Card, Primary border, Top bar, 3 dots
- Floating Documents:
  - kleine Cards, shadows, float keyframes
- Connection Lines:
  - SVG paths, dashed stroke animation (dashMove)
- Data Points:
  - Pulse (scale + fade)

**Interaktion**
- Intersection Observer pausiert Animationen initial und startet bei Sichtbarkeit
- Optional Parallax auf Desktop (Mouse move)


### 7.5 Effektiv Section (Premium, sehr motion-lastig)

Quelle: `effektiv_section.html`

**Layout**
- full viewport feel, center aligned
- Background Gradient: multi-stop dark
- Grid: `1fr 1.2fr`, gap `80px`, padding horizontal `80px`

**Background Systems**
- `::before` und `::after` radial glows mit `floatGradient` (20–25s)
- `particles-container` mit einzelnen particles (8s)
- `grid-overlay` mit Mask (radial) für Fokuszone

**Content Patterns**
- Badge (Pill): cyan border, dot pulse
- Tags: chips mit hover lift
- CTA: Outline → Lime gradient fill via `::before scaleX` reveal

**Screenshot Stack (3D)**
- `perspective: 1500px`
- Cards stacked via translateZ + rotateY
- Floating keyframes (6–8s)
- Hover: Fokus card „pop-out“ + stronger shadow


### 7.6 KI-Features (Bento Grid Cards)

Quelle: `features_ki_section.html`

**Section**
- min-height: 100vh, centered
- Ambient glows + particles

**Cards**
- Base:
  - Glass background
  - Border subtle
  - `backdrop-filter: blur(20px)`
  - `border-radius: 24px`

**Entrance**
- Default: `opacity:0; transform: translateY(60px) scale(0.95)`
- Class `.visible` via Intersection Observer: becomes `opacity:1; transform: translateY(0) scale(1)`
- Staggered transition delay per nth-child

**Hover**
- Card lift + shadow + border color
- Glow folgt Maus:
  - Card `::after` uses CSS vars `--mouse-x`, `--mouse-y`


### 7.7 Social Proof / Unternehmen lieben RowBooster

Quelle: `unternehmen_lieben_section.html`

**Layout**
- Top headline rechts ausgerichtet (Desktop)
- Grid 2 columns: Benefits + Counter Card

**Benefits List**
- Items mit gestaffelter `fadeInLeft`
- Icon: kleines rotierter Square (diamond), Lime glow

**Counter**
- Sehr große Zahl (BC Civitas), Lime
- JS Counter Animation (requestAnimationFrame) startet via Intersection Observer


### 7.8 Testimonials Modul

Quelle: `testimonials_modul.html`

**Cards**
- Centered stack, Glass background
- Quote icons (oben links / unten rechts)

**Mobile Pattern**
- Carousel horizontal scroll mit `scroll-snap-type: x mandatory`
- Pagination Dots
- Sticky bottom CTA (WebApp feel)

**CTA Button**
- Lime filled, dark text, shadow glow
- Optional ripple effect via JS


### 7.9 Pricing

Quelle: `pricing_section.html`

**Section Background**
- Dark gradient + radial glows

**Pricing Cards**
- Grid 1 → 2 → 3 columns mit Breakpoints
- Hover:
  - Gradient border effect via `mask-composite` technique
  - Card lift

**Featured Plan**
- leicht skalierter Card-Scale (Desktop)
- Pulse glow background animation
- Badge am Top

**Billing Toggle**
- Switch mit knob translate
- Price change animiert (scale + opacity)
- Keyboard accessible (Enter/Space)


### 7.10 Kontakt

Quelle: `kontakt_section.html`

**Layout**
- Light background `#ecf5fa`
- Centered form card

**Form Card**
- White surface, large radius (20px)
- Top gradient strip: cyan → primary → cyan

**Inputs**
- Background `#f8fbfc`
- Focus ring: `box-shadow: 0 0 0 4px rgba(23,195,206,0.1)`
- Valid/Invalid states über border colors

**Submit**
- Primary gradient dark → hover cyan gradient overlay
- Hover lift + shadow


### 7.11 Footer

Quelle: `footer_section.html`

**Layout**
- Gradient downwards
- Upper gradient line highlight
- Links with underline reveal
- Social icons in round buttons with hover lift


## 8. Motion System (Animationen & Interaktionen)

### 8.1 Easing Tokens

Tatsächlich genutzt:
- `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)`
- `--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1)`
- `--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1)`

Interpretation:
- Expo: Premium „soft landing“ für Entrance
- Back: „Snappy“ für Micro-pop (Icon rings, arrows)
- Smooth: UI Standard für hover/focus/menus


### 8.2 Timing Guidelines (aus Code extrahiert)

- Hover transitions:
  - `0.3s` (Buttons/Links)
  - `0.4–0.6s` (Glass cards / deeper UI)
- Entrance animations:
  - `0.6–1.2s` (revealUp/revealRight)
- Ambient/background loops:
  - `6–8s` (float cards/particles)
  - `20–30s` (slow ambient glows / dashed flow)


### 8.3 Entrance Patterns

**Reveal Up**
- Start: `opacity:0; transform: translateY(30–60px)`
- End: `opacity:1; transform: translateY(0)`
- Duration: `0.6–1s`
- Easing: Expo

**Reveal Right**
- Start: `opacity:0; transform: translateX(40–60px) scale(0.95)`
- End: `opacity:1; transform: translateX(0) scale(1)`

**Stagger**
- über `nth-child` oder `transition-delay` (0.1s increments)


### 8.4 Hover Patterns

- Link underline reveal (width 0 → 100%)
- Button arrow nudge (`translateX(4–6px)`)
- Card lift (`translateY(-4…-8px)`)
- Card 3D tilt (Pricing: perspective rotateX/rotateY on mousemove)


### 8.5 Scroll Trigger (Intersection Observer)

Häufiger Trigger:
- `threshold: 0.1–0.2`
- `rootMargin: 0px 0px -50px 0px` (oder -80px)

Pattern:
- CSS animation initial `paused`
- bei Intersect: `animationPlayState = 'running'` oder class hinzufügen (`visible`)


### 8.6 Reduced Motion (A11y)

Übergreifendes Pattern in mehreren Dateien:
- `@media (prefers-reduced-motion: reduce)`:
  - `animation-duration: 0.01ms !important`
  - `animation-iteration-count: 1 !important`
  - `transition-duration: 0.01ms !important`

Empfehlung:
- Zusätzlich JS Effekte (parallax/tilt) bei reduced motion komplett deaktivieren.


## 9. Abhängigkeiten & technische Hinweise

### 9.1 Externe Ressourcen

- Fonts:
  - Google Fonts: Nunito
  - Typekit: BC Civitas

### 9.2 JS-Patterns

- Mobile Menu:
  - toggles classes
  - body scroll lock
  - ESC close
- Intersection Observer:
  - start/pause animations
- Hover Enhancement:
  - pricing tilt by mouse move
  - feature glow by mouse tracking
- Counter Animation:
  - requestAnimationFrame count up

### 9.3 Performance Hinweise

- Viele `backdrop-filter` können GPU-intensiv sein:
  - bei Mobile ggf. reduzieren
  - nur in sichtbaren Cards nutzen
- Parallax/mousemove Listener:
  - nur Desktop
  - optional throttling


## 10. Seitenstruktur (Empfohlene Reihenfolge & Abhängigkeiten)

Empfohlene Reihenfolge (entspricht Screenshot/Dateien):
1. Navbar (fixed)
2. Hero + Feature-Intro
3. Zeitersparnis/KPI (90% Modul) oder direkt Problem/Solution
4. Datenchaos (Problem) + Lösung
5. Effektiv (Produkt-Showcase)
6. KI-Features (Bento)
7. Unternehmen lieben RowBooster (Benefits + Counter)
8. Testimonials
9. Pricing
10. Kontakt
11. Footer

Abhängigkeiten:
- Globale CSS Variables sollten zentral definiert sein (statt pro Section).
- Grid Background sollte nur in Dark Bereichen sichtbar sein (z-index / section backgrounds beachten).


## 11. Konkrete Token-Vorschläge (für Konsolidierung)

### 11.1 CSS Variables (empfohlen als Single Source of Truth)

- `--color-primary: #0c2443`
- `--color-primary-dark: #0E1621`
- `--color-secondary: #1a2332`
- `--color-dark: #1e1e1e`
- `--color-light: #ecf5fa`
- `--color-white: #ffffff`
- `--color-cyan: #17c3ce`
- `--color-lime: #c8fa64`
- `--color-text: #ffffff`
- `--color-text-muted: #B0BAC5`
- `--color-text-dark: #1e1e1e`
- `--color-text-muted-dark: #5a6a7a`
- `--font-body: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- `--font-heading: 'bc-civitas', Georgia, serif`
- `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)`
- `--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1)`
- `--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1)`


## 12. Offene Konsistenzpunkte (empfohlene Bereinigung)

- In manchen Modulen wird statt `#c8fa64` auch `#A8DD5B` genutzt.
  - Empfehlung: **einen** finalen Lime Ton festlegen und überall konsequent.
- Font-Weights schwanken (300/400/600/700).
  - Empfehlung: Headings **600/700**, Body **400**, Highlights **600/700**.
- Mehrere Dateien definieren `:root` erneut.
  - Empfehlung: ein globales `:root` + Section-spezifische Custom Properties nur wenn nötig.


## 13. Implementierungs-Checkliste (für die nächste Iteration)

- [ ] Globale `:root` Tokens in eine zentrale Datei/Block ziehen
- [ ] Doppelte Styles (CTA, Card, Headline) zu wiederverwendbaren Klassen konsolidieren
- [ ] Motion: überall Intersection Observer Pattern vereinheitlichen
- [ ] Reduced Motion: JS Parallax/Tilt deaktivieren
- [ ] Kontrasttests (WCAG AA) für alle Akzentkombinationen

