import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle2, Sun, Moon } from "lucide-react";
import rowboosterIcon from "@konzept/Logo/RowBooster_Bildmarke.png";
import Footer from "@/components/Footer";
import { useTheme } from "@/contexts/ThemeContext";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError("E-Mail-Adresse ist erforderlich");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Anfrage fehlgeschlagen");
      }

      setSuccess(true);
    } catch (error: any) {
      setError(error.message || "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`relative min-h-screen flex flex-col transition-colors duration-300 ${
        theme === 'dark'
          ? 'bg-[linear-gradient(135deg,#0E1621_0%,#1a2332_100%)]'
          : 'bg-[linear-gradient(135deg,#ecf5fa_0%,#e0f0f5_100%)]'
      }`}>
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={`fixed top-4 right-4 z-50 p-3 rounded-xl transition-all duration-300 ${
            theme === 'dark'
              ? 'bg-white/10 hover:bg-white/20 text-white'
              : 'bg-[#17c3ce]/10 hover:bg-[#17c3ce]/20 text-[#0c2443]'
          }`}
          title={theme === 'dark' ? 'Zum Light Mode wechseln' : 'Zum Dark Mode wechseln'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Fixed Grid Background */}
        <div className="pointer-events-none fixed inset-0 z-0 opacity-70">
          <div className={`absolute inset-0 [background-size:60px_60px] ${
            theme === 'dark'
              ? '[background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]'
              : '[background-image:linear-gradient(rgba(23,195,206,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(23,195,206,0.08)_1px,transparent_1px)]'
          }`} />
          <div className={`absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-2xl ${
            theme === 'dark'
              ? 'bg-[radial-gradient(circle_at_center,rgba(200,250,100,0.10),transparent_60%)]'
              : 'bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.15),transparent_60%)]'
          }`} />
          <div className={`absolute -bottom-56 -right-56 h-[620px] w-[620px] rounded-full blur-2xl ${
            theme === 'dark'
              ? 'bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.12),transparent_60%)]'
              : 'bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.20),transparent_60%)]'
          }`} />
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
          <Card className={`w-full max-w-sm sm:max-w-md border shadow-[0_25px_80px_rgba(0,0,0,0.15)] backdrop-blur-xl ${
            theme === 'dark'
              ? 'border-white/[0.08] bg-white/[0.05]'
              : 'border-[#17c3ce]/20 bg-white/80'
          }`}>
            <CardHeader className="text-center pb-4 sm:pb-6">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                theme === 'dark' ? 'bg-[#c8fa64]/20' : 'bg-[#17c3ce]/20'
              }`}>
                <CheckCircle2 className={`w-8 h-8 ${theme === 'dark' ? 'text-[#c8fa64]' : 'text-[#17c3ce]'}`} />
              </div>
              <CardTitle className={`text-xl sm:text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-[#0c2443]'}`}>E-Mail gesendet!</CardTitle>
              <CardDescription className={theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}>Überprüfen Sie Ihren Posteingang</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <Alert className={`border ${
                theme === 'dark'
                  ? 'border-[#17c3ce]/30 bg-[#17c3ce]/10'
                  : 'border-[#17c3ce]/30 bg-[#17c3ce]/10'
              }`}>
                <Mail className="h-4 w-4 text-[#17c3ce]" />
                <AlertDescription className={`ml-2 ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>
                  Wir haben einen Link zum Zurücksetzen des Passworts an <strong className="text-[#17c3ce]">{email}</strong> gesendet
                </AlertDescription>
              </Alert>
              <div className={`text-sm space-y-2 ${theme === 'dark' ? 'text-white/70' : 'text-[#0c2443]/70'}`}>
                <p>Bitte folgen Sie diesen Schritten:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Überprüfen Sie Ihren E-Mail-Posteingang</li>
                  <li>Klicken Sie auf den Link zum Zurücksetzen</li>
                  <li>Geben Sie Ihr neues Passwort ein</li>
                </ol>
                <p className="text-xs text-amber-500 mt-4 font-semibold">
                  ⚠️ Wichtig: Der Link läuft in 1 Stunde ab.
                </p>
              </div>
              <div className="pt-4">
                <Link href="/login">
                  <Button className={`relative w-full overflow-hidden rounded-xl transition-[filter,box-shadow,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:brightness-[1.02] active:translate-y-px before:absolute before:inset-0 before:content-[''] before:pointer-events-none before:bg-[linear-gradient(180deg,rgba(255,255,255,0.40)_0%,rgba(255,255,255,0.12)_24%,rgba(255,255,255,0)_58%)] ${
                    theme === 'dark'
                      ? '!bg-[#c8fa64] text-[#0c2443] shadow-[0_14px_36px_rgba(200,250,100,0.18)]'
                      : '!bg-[#17c3ce] text-white shadow-[0_14px_36px_rgba(23,195,206,0.25)]'
                  }`}>
                    Zurück zur Anmeldung
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Spacer to push footer down */}
        <div className="h-[500px]" />

        {/* Footer */}
        <div className="relative z-10">
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen flex flex-col transition-colors duration-300 ${
      theme === 'dark'
        ? 'bg-[linear-gradient(135deg,#0E1621_0%,#1a2332_100%)]'
        : 'bg-[linear-gradient(135deg,#ecf5fa_0%,#e0f0f5_100%)]'
    }`}>
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className={`fixed top-4 right-4 z-50 p-3 rounded-xl transition-all duration-300 ${
          theme === 'dark'
            ? 'bg-white/10 hover:bg-white/20 text-white'
            : 'bg-[#17c3ce]/10 hover:bg-[#17c3ce]/20 text-[#0c2443]'
        }`}
        title={theme === 'dark' ? 'Zum Light Mode wechseln' : 'Zum Dark Mode wechseln'}
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      {/* Fixed Grid Background */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-70">
        <div className={`absolute inset-0 [background-size:60px_60px] ${
          theme === 'dark'
            ? '[background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]'
            : '[background-image:linear-gradient(rgba(23,195,206,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(23,195,206,0.08)_1px,transparent_1px)]'
        }`} />
        <div className={`absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-2xl ${
          theme === 'dark'
            ? 'bg-[radial-gradient(circle_at_center,rgba(200,250,100,0.10),transparent_60%)]'
            : 'bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.15),transparent_60%)]'
        }`} />
        <div className={`absolute -bottom-56 -right-56 h-[620px] w-[620px] rounded-full blur-2xl ${
          theme === 'dark'
            ? 'bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.12),transparent_60%)]'
            : 'bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.20),transparent_60%)]'
        }`} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-sm sm:max-w-md">
          <div className="text-center mb-6 sm:mb-8">
            <div className="mx-auto mb-5 flex items-center justify-center">
              <div className="relative">
                <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.22),transparent_60%)] blur-xl" />
                <img src={rowboosterIcon} alt="rowbooster" className="relative h-16 w-16 sm:h-20 sm:w-20 object-contain" />
              </div>
            </div>
            <h1 className={`text-3xl sm:text-4xl font-semibold tracking-[-0.5px] ${theme === 'dark' ? 'text-white' : 'text-[#0c2443]'}`}>
              Passwort <span className="text-[#c8fa64]">vergessen?</span>
            </h1>
            <p className={`mt-2 text-sm sm:text-base ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
              Wir senden Ihnen einen Link zum Zurücksetzen
            </p>
          </div>

          <Card className={`border shadow-[0_25px_80px_rgba(0,0,0,0.15)] backdrop-blur-xl ${
            theme === 'dark'
              ? 'border-white/[0.08] bg-white/[0.05]'
              : 'border-[#17c3ce]/20 bg-white/80'
          }`}>
            <CardHeader className="space-y-1 pb-4 sm:pb-6">
              <CardTitle className={`text-lg sm:text-xl font-semibold text-center ${theme === 'dark' ? 'text-white' : 'text-[#0c2443]'}`}>
                Passwort zurücksetzen
              </CardTitle>
              <CardDescription className={`text-center text-[13px] ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
                Geben Sie Ihre E-Mail-Adresse ein
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className={`text-[13px] font-medium ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>
                    E-Mail-Adresse
                  </label>
                  <div className="relative">
                    <Mail className={`absolute left-3 top-3 h-4 w-4 ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="ihre@email.de"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`pl-10 focus-visible:ring-2 focus-visible:ring-[#17c3ce]/45 focus-visible:ring-offset-0 ${
                        theme === 'dark'
                          ? 'bg-white/[0.04] text-white placeholder:text-white/40 border-white/[0.10]'
                          : 'bg-[#ecf5fa] text-[#0c2443] placeholder:text-[#0c2443]/40 border-[#17c3ce]/20'
                      }`}
                      autoComplete="email"
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="border-red-500/30 bg-red-500/10 text-red-600">
                    <AlertDescription className="text-[13px]">{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className={`relative w-full overflow-hidden rounded-xl transition-[filter,box-shadow,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:brightness-[1.02] active:translate-y-px before:absolute before:inset-0 before:content-[''] before:pointer-events-none before:bg-[linear-gradient(180deg,rgba(255,255,255,0.40)_0%,rgba(255,255,255,0.12)_24%,rgba(255,255,255,0)_58%)] ${
                    theme === 'dark'
                      ? '!bg-[#c8fa64] text-[#0c2443] shadow-[0_14px_36px_rgba(200,250,100,0.18)]'
                      : '!bg-[#17c3ce] text-white shadow-[0_14px_36px_rgba(23,195,206,0.25)]'
                  }`}
                  disabled={isLoading}
                >
                  {isLoading ? "Wird gesendet..." : "Link zum Zurücksetzen senden"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <span className={theme === 'dark' ? 'text-white/70' : 'text-[#0c2443]/70'}>Kennen Sie Ihr Passwort? </span>
                <Link href="/login" className={`font-semibold transition-colors ${
                  theme === 'dark'
                    ? 'text-[#c8fa64] hover:text-white'
                    : 'text-[#17c3ce] hover:text-[#0c2443]'
                }`}>
                  Jetzt anmelden
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Spacer to push footer down */}
      <div className="h-[500px]" />

      {/* Footer */}
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}