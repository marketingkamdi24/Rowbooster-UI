import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Mail, Lock, CheckCircle2, Check, X, Sun, Moon } from "lucide-react";
import rowboosterIcon from "@konzept/Logo/RowBooster_Bildmarke.png";
import Footer from "@/components/Footer";
import { useTheme } from "@/contexts/ThemeContext";

const registerSchema = z.object({
  username: z.string()
    .min(3, "Benutzername muss mindestens 3 Zeichen lang sein")
    .max(30, "Benutzername darf maximal 30 Zeichen lang sein")
    .regex(/^[a-zA-Z0-9_-]+$/, "Benutzername darf nur Buchstaben, Zahlen, Unterstriche und Bindestriche enthalten"),
  email: z.string()
    .email("Ungültige E-Mail-Adresse")
    .max(255, "E-Mail-Adresse ist zu lang"),
  password: z.string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .max(128, "Passwort ist zu lang")
    .regex(/[A-Z]/, "Passwort muss mindestens einen Großbuchstaben enthalten")
    .regex(/[a-z]/, "Passwort muss mindestens einen Kleinbuchstaben enthalten")
    .regex(/[0-9]/, "Passwort muss mindestens eine Zahl enthalten")
    .regex(/[^A-Za-z0-9]/, "Passwort muss mindestens ein Sonderzeichen enthalten"),
  confirmPassword: z.string().min(1, "Bitte bestätigen Sie Ihr Passwort"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError("");
      setIsLoading(true);

      let response: Response;
      try {
        response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: data.username,
            email: data.email,
            password: data.password,
          }),
        });
      } catch {
        throw new Error("Verbindung fehlgeschlagen. Bitte Internetverbindung prüfen und erneut versuchen.");
      }

      let result: any = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        const message =
          result?.message ||
          result?.error?.message ||
          "Registrierung fehlgeschlagen. Bitte erneut versuchen.";
        throw new Error(message);
      }

      // Show success message
      setEmail(data.email);
      setSuccess(true);
    } catch (error: any) {
      setError(error.message || "Registrierung fehlgeschlagen");
    } finally {
      setIsLoading(false);
    }
  };

  // Check username availability with debounce
  useEffect(() => {
    const username = form.watch("username");
    
    // Reset availability state if empty or too short
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    // Validate format first before checking availability
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username) || username.length > 30) {
      setUsernameAvailable(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const response = await fetch("/api/auth/check-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        const result = await response.json();
        setUsernameAvailable(result.usernameAvailable);
      } catch (error) {
        console.error("Error checking username:", error);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form.watch("username")]);

  // Check email availability with debounce
  useEffect(() => {
    const email = form.watch("email");
    
    // Reset availability state if empty or invalid format
    if (!email || !email.includes("@")) {
      setEmailAvailable(null);
      return;
    }

    // Validate format first before checking availability
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      setEmailAvailable(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const response = await fetch("/api/auth/check-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const result = await response.json();
        setEmailAvailable(result.emailAvailable);
      } catch (error) {
        console.error("Error checking email:", error);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form.watch("email")]);

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
        <Card className={`relative w-full max-w-md border shadow-[0_25px_80px_rgba(0,0,0,0.15)] backdrop-blur-xl ${
          theme === 'dark'
            ? 'border-white/[0.08] bg-white/[0.05]'
            : 'border-[#17c3ce]/20 bg-white/80'
        }`}>
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto mb-2 flex items-center justify-center">
              <div className="relative">
                <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.18),transparent_60%)] blur-xl" />
                <img src={rowboosterIcon} alt="rowbooster" className="relative h-16 w-16 object-contain" />
              </div>
            </div>
            <div className={`mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full ring-1 ${
              theme === 'dark' ? 'bg-white/[0.06] ring-white/[0.10]' : 'bg-[#17c3ce]/10 ring-[#17c3ce]/20'
            }`}>
              <CheckCircle2 className="h-7 w-7 text-[#17c3ce]" />
            </div>
            <CardTitle className={`text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-[#0c2443]'}`}>Registrierung erfolgreich!</CardTitle>
            <CardDescription className={`text-[13px] ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
              Bitte prüfen Sie Ihre E-Mail, um Ihr Konto zu verifizieren.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            <Alert className={`border ${
              theme === 'dark'
                ? 'border-white/[0.10] bg-white/[0.04] text-white'
                : 'border-[#17c3ce]/20 bg-[#17c3ce]/5 text-[#0c2443]'
            }`}>
              <Mail className={`h-4 w-4 ${theme === 'dark' ? 'text-white/70' : 'text-[#17c3ce]'}`} />
              <AlertDescription className={`ml-2 text-[13px] ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>
                Wir haben einen Verifizierungslink an <strong>{email}</strong> gesendet.
              </AlertDescription>
            </Alert>

            <div className={`text-sm space-y-2 ${theme === 'dark' ? 'text-white/80' : 'text-[#0c2443]/80'}`}>
              <p>Bitte folgen Sie diesen Schritten:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Überprüfen Sie Ihren E-Mail-Posteingang (und Spam-Ordner)</li>
                <li>Klicken Sie auf den Verifizierungslink <strong>ODER</strong> geben Sie den 6-stelligen Code ein</li>
                <li>Kehren Sie nach der Verifizierung zur Anmeldung zurück</li>
              </ol>
              <p className="text-xs text-red-500 mt-4 font-semibold">
                ⚠️ Wichtig: Der Verifizierungslink und Code laufen nach 1 Stunde ab.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <Link href="/verify-email">
                <Button
                  className={`relative w-full overflow-hidden rounded-xl transition-[filter,box-shadow,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:brightness-[1.02] active:translate-y-px before:absolute before:inset-0 before:content-[''] before:pointer-events-none before:bg-[linear-gradient(180deg,rgba(255,255,255,0.40)_0%,rgba(255,255,255,0.12)_24%,rgba(255,255,255,0)_58%)] ${
                    theme === 'dark'
                      ? '!bg-[#c8fa64] text-[#0c2443] shadow-[0_14px_36px_rgba(200,250,100,0.18)]'
                      : '!bg-[#17c3ce] text-white shadow-[0_14px_36px_rgba(23,195,206,0.25)]'
                  }`}
                >
                  Verifizierungscode eingeben
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  className={`w-full rounded-xl ${
                    theme === 'dark'
                      ? 'border-white/[0.16] bg-white/[0.02] text-white hover:bg-white/[0.06]'
                      : 'border-[#17c3ce]/30 bg-white text-[#0c2443] hover:bg-[#17c3ce]/5'
                  }`}
                >
                  Bereits verifiziert? Zur Anmeldung
                </Button>
              </Link>
            </div>

            <p className={`text-xs text-center mt-3 ${theme === 'dark' ? 'text-white/55' : 'text-[#0c2443]/55'}`}>
              E-Mail nicht erhalten? Überprüfen Sie Ihren Spam-Ordner oder nutzen Sie die Erneut-Senden-Option auf der Verifizierungsseite.
            </p>
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
      <div className="relative w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="mx-auto mb-5 flex items-center justify-center">
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.22),transparent_60%)] blur-xl" />
              <img src={rowboosterIcon} alt="rowbooster" className="relative h-16 w-16 sm:h-20 sm:w-20 object-contain" />
            </div>
          </div>
          <h1 className={`text-3xl sm:text-4xl font-semibold tracking-[-0.5px] ${theme === 'dark' ? 'text-white' : 'text-[#0c2443]'}`}>Konto <span className="text-[#c8fa64]">erstellen</span></h1>
          <p className={`mt-2 text-sm sm:text-base ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
            Ihr Weg zur effizientesten Datenstrukturierung.
          </p>
        </div>

        <Card className={`border shadow-[0_25px_80px_rgba(0,0,0,0.15)] backdrop-blur-xl ${
          theme === 'dark'
            ? 'border-white/[0.08] bg-white/[0.05]'
            : 'border-[#17c3ce]/20 bg-white/80'
        }`}>
          <CardHeader className="space-y-1 pb-4 sm:pb-6">
            <CardTitle className={`text-lg sm:text-xl font-semibold text-center ${theme === 'dark' ? 'text-white' : 'text-[#0c2443]'}`}>Registrieren</CardTitle>
            <CardDescription className={`text-center text-[13px] ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
              Geben Sie Ihre Daten ein, um Ihr Konto zu erstellen.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={`text-[13px] font-medium ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>Benutzername</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className={`absolute left-3 top-3 h-4 w-4 ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`} />
                          <Input
                            {...field}
                            type="text"
                            placeholder="Benutzernamen wählen"
                            className={`pl-10 focus-visible:ring-2 focus-visible:ring-[#17c3ce]/45 focus-visible:ring-offset-0 ${
                              theme === 'dark'
                                ? 'bg-white/[0.04] text-white placeholder:text-white/40 border-white/[0.10]'
                                : 'bg-[#ecf5fa] text-[#0c2443] placeholder:text-[#0c2443]/40 border-[#17c3ce]/20'
                            }`}
                            autoComplete="username"
                          />
                          {checkingUsername && (
                            <span className={`absolute right-3 top-3 ${theme === 'dark' ? 'text-white/55' : 'text-[#0c2443]/55'}`}>
                              Prüfen...
                            </span>
                          )}
                          {!checkingUsername && usernameAvailable === true && (
                            <Check className="absolute right-3 top-3 h-4 w-4 text-[#17c3ce]" />
                          )}
                          {!checkingUsername && usernameAvailable === false && (
                            <X className="absolute right-3 top-3 h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </FormControl>
                      <FormDescription className={`text-[12px] ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
                        3-30 Zeichen. Nur Buchstaben, Zahlen, Unterstriche und Bindestriche.
                      </FormDescription>
                      <FormMessage className="text-[12px] text-red-500" />
                      {!checkingUsername && usernameAvailable === false && (
                        <p className="text-sm text-red-500">Dieser Benutzername ist bereits vergeben.</p>
                      )}
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={`text-[13px] font-medium ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>E-Mail</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className={`absolute left-3 top-3 h-4 w-4 ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`} />
                          <Input
                            {...field}
                            type="email"
                            placeholder="ihre@email.de"
                            className={`pl-10 focus-visible:ring-2 focus-visible:ring-[#17c3ce]/45 focus-visible:ring-offset-0 ${
                              theme === 'dark'
                                ? 'bg-white/[0.04] text-white placeholder:text-white/40 border-white/[0.10]'
                                : 'bg-[#ecf5fa] text-[#0c2443] placeholder:text-[#0c2443]/40 border-[#17c3ce]/20'
                            }`}
                            autoComplete="email"
                          />
                          {checkingEmail && (
                            <span className={`absolute right-3 top-3 ${theme === 'dark' ? 'text-white/55' : 'text-[#0c2443]/55'}`}>
                              Prüfen...
                            </span>
                          )}
                          {!checkingEmail && emailAvailable === true && (
                            <Check className="absolute right-3 top-3 h-4 w-4 text-[#17c3ce]" />
                          )}
                          {!checkingEmail && emailAvailable === false && (
                            <X className="absolute right-3 top-3 h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage className="text-[12px] text-red-500" />
                      {!checkingEmail && emailAvailable === false && (
                        <p className="text-sm text-red-500">Diese E-Mail ist bereits registriert.</p>
                      )}
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={`text-[13px] font-medium ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>Passwort</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className={`absolute left-3 top-3 h-4 w-4 ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`} />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Passwort erstellen"
                            className={`pl-10 focus-visible:ring-2 focus-visible:ring-[#17c3ce]/45 focus-visible:ring-offset-0 ${
                              theme === 'dark'
                                ? 'bg-white/[0.04] text-white placeholder:text-white/40 border-white/[0.10]'
                                : 'bg-[#ecf5fa] text-[#0c2443] placeholder:text-[#0c2443]/40 border-[#17c3ce]/20'
                            }`}
                            autoComplete="new-password"
                          />
                        </div>
                      </FormControl>
                      <FormDescription className={`text-[12px] ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
                        Mindestens 8 Zeichen mit Groß-, Kleinbuchstaben, Zahl und Sonderzeichen.
                      </FormDescription>
                      <FormMessage className="text-[12px] text-red-500" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={`text-[13px] font-medium ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>Passwort bestätigen</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className={`absolute left-3 top-3 h-4 w-4 ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`} />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Passwort bestätigen"
                            className={`pl-10 focus-visible:ring-2 focus-visible:ring-[#17c3ce]/45 focus-visible:ring-offset-0 ${
                              theme === 'dark'
                                ? 'bg-white/[0.04] text-white placeholder:text-white/40 border-white/[0.10]'
                                : 'bg-[#ecf5fa] text-[#0c2443] placeholder:text-[#0c2443]/40 border-[#17c3ce]/20'
                            }`}
                            autoComplete="new-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[12px] text-red-500" />
                    </FormItem>
                  )}
                />

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
                  disabled={isLoading || usernameAvailable === false || emailAvailable === false}
                >
                  {isLoading ? "Konto wird erstellt..." : "Konto erstellen"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm">
              <span className={theme === 'dark' ? 'text-white/70' : 'text-[#0c2443]/70'}>Bereits ein Konto? </span>
              <Link href="/login" className={`font-semibold underline underline-offset-4 transition-colors ${
                theme === 'dark'
                  ? 'text-white/90 hover:text-white decoration-white/30 hover:decoration-white/60'
                  : 'text-[#0c2443]/90 hover:text-[#0c2443] decoration-[#0c2443]/30 hover:decoration-[#0c2443]/60'
              }`}>
                Anmelden
              </Link>
            </div>

            <div className={`mt-4 text-center text-xs ${theme === 'dark' ? 'text-white/55' : 'text-[#0c2443]/55'}`}>
              Mit der Erstellung eines Kontos stimmen Sie unseren Nutzungsbedingungen und Datenschutzrichtlinien zu
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