import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, CheckCircle2, XCircle, Sun, Moon } from "lucide-react";
import rowboosterIcon from "@konzept/Logo/RowBooster_Bildmarke.png";
import { useTheme } from "@/contexts/ThemeContext";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
    } else {
      setError("Ungültiger oder fehlender Reset-Token");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError("Ungültiger Reset-Token");
      return;
    }

    if (!password || password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }

    // Validate password strength
    const uppercaseRegex = /[A-Z]/;
    const lowercaseRegex = /[a-z]/;
    const numberRegex = /[0-9]/;
    const specialCharRegex = /[^A-Za-z0-9]/;

    if (!uppercaseRegex.test(password)) {
      setError("Passwort muss mindestens einen Großbuchstaben enthalten");
      return;
    }
    if (!lowercaseRegex.test(password)) {
      setError("Passwort muss mindestens einen Kleinbuchstaben enthalten");
      return;
    }
    if (!numberRegex.test(password)) {
      setError("Passwort muss mindestens eine Zahl enthalten");
      return;
    }
    if (!specialCharRegex.test(password)) {
      setError("Passwort muss mindestens ein Sonderzeichen enthalten");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Passwort-Reset fehlgeschlagen");
      }

      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation("/login");
      }, 3000);
    } catch (error: any) {
      setError(error.message || "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${
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

        <Card className={`w-full max-w-md shadow-xl border backdrop-blur-xl ${
          theme === 'dark'
            ? 'border-white/[0.08] bg-white/[0.05]'
            : 'border-[#17c3ce]/20 bg-white/80'
        }`}>
          <CardHeader className="text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              theme === 'dark' ? 'bg-[#c8fa64]/20' : 'bg-[#17c3ce]/20'
            }`}>
              <CheckCircle2 className={`w-8 h-8 ${theme === 'dark' ? 'text-[#c8fa64]' : 'text-[#17c3ce]'}`} />
            </div>
            <CardTitle className={`text-2xl ${theme === 'dark' ? 'text-white' : 'text-[#0c2443]'}`}>Passwort erfolgreich zurückgesetzt!</CardTitle>
            <CardDescription className={theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}>Sie können sich jetzt anmelden</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className={`border ${
              theme === 'dark'
                ? 'border-[#17c3ce]/30 bg-[#17c3ce]/10'
                : 'border-[#17c3ce]/30 bg-[#17c3ce]/10'
            }`}>
              <CheckCircle2 className="h-4 w-4 text-[#17c3ce]" />
              <AlertDescription className={`ml-2 ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>
                Ihr Passwort wurde erfolgreich geändert
              </AlertDescription>
            </Alert>
            <div className={`text-center text-sm ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
              <p className="mb-2">Sie werden in 3 Sekunden zur Anmeldung weitergeleitet...</p>
            </div>
            <Link href="/login">
              <Button className={`w-full rounded-xl transition-all duration-300 ${
                theme === 'dark'
                  ? '!bg-[#c8fa64] text-[#0c2443] hover:brightness-105'
                  : '!bg-[#17c3ce] text-white hover:brightness-105'
              }`}>
                Jetzt anmelden
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${
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

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 flex items-center justify-center">
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.22),transparent_60%)] blur-xl" />
              <img src={rowboosterIcon} alt="rowbooster" className="relative h-16 w-16 object-contain" />
            </div>
          </div>
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#0c2443]'}`}>Neues Passwort festlegen</h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>Geben Sie Ihr neues Passwort ein</p>
        </div>

        <Card className={`shadow-xl border backdrop-blur-xl ${
          theme === 'dark'
            ? 'border-white/[0.08] bg-white/[0.05]'
            : 'border-[#17c3ce]/20 bg-white/80'
        }`}>
          <CardHeader className="space-y-1">
            <CardTitle className={`text-xl font-semibold text-center ${theme === 'dark' ? 'text-white' : 'text-[#0c2443]'}`}>
              Passwort zurücksetzen
            </CardTitle>
            <CardDescription className={`text-center ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
              Erstellen Sie ein sicheres neues Passwort
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
                <XCircle className="h-4 w-4 text-red-500" />
                <AlertDescription className="ml-2 text-red-600">
                  Ungültiger oder fehlender Reset-Token. Bitte fordern Sie einen neuen Link an.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="password" className={`text-sm font-medium ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>
                    Neues Passwort
                  </label>
                  <div className="relative">
                    <Lock className={`absolute left-3 top-3 h-4 w-4 ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`} />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Neues Passwort eingeben"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`pl-10 focus-visible:ring-2 focus-visible:ring-[#17c3ce]/45 focus-visible:ring-offset-0 ${
                        theme === 'dark'
                          ? 'bg-white/[0.04] text-white placeholder:text-white/40 border-white/[0.10]'
                          : 'bg-[#ecf5fa] text-[#0c2443] placeholder:text-[#0c2443]/40 border-[#17c3ce]/20'
                      }`}
                      autoComplete="new-password"
                    />
                  </div>
                  <p className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`}>
                    Mindestens 8 Zeichen mit Groß-/Kleinbuchstaben, Zahl und Sonderzeichen
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className={`text-sm font-medium ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>
                    Passwort bestätigen
                  </label>
                  <div className="relative">
                    <Lock className={`absolute left-3 top-3 h-4 w-4 ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`} />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Passwort wiederholen"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`pl-10 focus-visible:ring-2 focus-visible:ring-[#17c3ce]/45 focus-visible:ring-offset-0 ${
                        theme === 'dark'
                          ? 'bg-white/[0.04] text-white placeholder:text-white/40 border-white/[0.10]'
                          : 'bg-[#ecf5fa] text-[#0c2443] placeholder:text-[#0c2443]/40 border-[#17c3ce]/20'
                      }`}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="border-red-500/30 bg-red-500/10 text-red-600">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className={`w-full rounded-xl transition-all duration-300 ${
                    theme === 'dark'
                      ? '!bg-[#c8fa64] text-[#0c2443] hover:brightness-105'
                      : '!bg-[#17c3ce] text-white hover:brightness-105'
                  }`}
                  disabled={isLoading}
                >
                  {isLoading ? "Wird zurückgesetzt..." : "Passwort zurücksetzen"}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center text-sm">
              <Link href="/login" className={`font-semibold transition-colors ${
                theme === 'dark'
                  ? 'text-[#c8fa64] hover:text-white'
                  : 'text-[#17c3ce] hover:text-[#0c2443]'
              }`}>
                Zurück zur Anmeldung
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}