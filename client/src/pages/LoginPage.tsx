import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginCredentials } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, User } from "lucide-react";
import rowboosterIcon from "@konzept/Logo/RowBooster_Bildmarke.png";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const form = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setError("");
      setIsLoading(true);
      await login(data.username, data.password);
      // Redirect to home page after successful login
      setLocation('/');
    } catch (error: any) {
      setError(error.message || "Anmeldung fehlgeschlagen");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[linear-gradient(135deg,var(--rb-primary-dark)_0%,var(--rb-secondary)_100%)] p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:60px_60px]" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(200,250,100,0.10),transparent_60%)] blur-2xl" />
        <div className="absolute -bottom-56 -right-56 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.12),transparent_60%)] blur-2xl" />
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="mx-auto mb-5 flex items-center justify-center">
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.22),transparent_60%)] blur-xl" />
              <img src={rowboosterIcon} alt="rowbooster" className="relative h-16 w-16 sm:h-20 sm:w-20 object-contain" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.5px] text-white">
            Willkommen <span className="text-[var(--rb-lime)]">zurück</span>
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[color:var(--rb-text-muted)]">
            Ihr Weg zur effizientesten Datenstrukturierung.
          </p>
        </div>

        <Card className="border border-white/[0.08] bg-white/[0.05] shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-4 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl font-semibold text-center text-white">
              Anmelden
            </CardTitle>
            <CardDescription className="text-center text-[13px] text-[color:var(--rb-text-muted)]">
              Zugriff auf Ihre Projekte, Tabellen und KI-Workflows
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
                    <FormLabel className="text-[13px] font-medium text-white/90">Benutzername oder E-Mail</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                        <Input
                          {...field}
                          type="text"
                          placeholder="Benutzername oder E-Mail eingeben"
                          className="pl-10 bg-white/[0.04] text-white placeholder:text-white/40 border-white/[0.10] focus-visible:ring-2 focus-visible:ring-[color:rgba(23,195,206,0.45)] focus-visible:ring-offset-0"
                          autoComplete="username"
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[12px] text-red-300" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-white/90">Passwort</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                        <Input
                          {...field}
                          type="password"
                          placeholder="Passwort eingeben"
                          className="pl-10 bg-white/[0.04] text-white placeholder:text-white/40 border-white/[0.10] focus-visible:ring-2 focus-visible:ring-[color:rgba(23,195,206,0.45)] focus-visible:ring-offset-0"
                          autoComplete="current-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[12px] text-red-300" />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-end">
                <Link href="/forgot-password" className="text-sm font-medium text-white/90 hover:text-white underline underline-offset-4 decoration-white/30 hover:decoration-white/60 transition-colors">
                  Passwort vergessen?
                </Link>
              </div>

              {error && (
                <Alert variant="destructive" className="border-red-500/30 bg-red-500/10 text-red-100">
                  <AlertDescription className="text-[13px]">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="relative w-full overflow-hidden rounded-xl !bg-[var(--rb-lime)] text-[color:var(--rb-primary-dark)] shadow-[0_14px_36px_rgba(200,250,100,0.18),inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-10px_18px_rgba(0,0,0,0.14)] transition-[filter,box-shadow,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:brightness-[1.02] hover:shadow-[0_18px_48px_rgba(200,250,100,0.22),inset_0_1px_0_rgba(255,255,255,0.62),inset_0_-12px_22px_rgba(0,0,0,0.16)] active:translate-y-px before:absolute before:inset-0 before:content-[''] before:pointer-events-none before:bg-[linear-gradient(180deg,rgba(255,255,255,0.40)_0%,rgba(255,255,255,0.12)_24%,rgba(255,255,255,0)_58%)]"
                disabled={isLoading}
              >
                {isLoading ? "Anmeldung läuft..." : "Anmelden"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <span className="text-white/70">Noch kein Konto? </span>
            <Link href="/register" className="font-semibold text-[var(--rb-lime)] hover:text-white transition-colors">
              Jetzt registrieren
            </Link>
          </div>

        </CardContent>
      </Card>
      </div>
    </div>
  );
}