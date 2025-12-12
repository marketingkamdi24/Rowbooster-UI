import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, CheckCircle2, XCircle } from "lucide-react";
import rowboosterIcon from "@assets/rb-2_1753205370923.png";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Passwort erfolgreich zurückgesetzt!</CardTitle>
            <CardDescription>Sie können sich jetzt anmelden</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900 ml-2">
                Ihr Passwort wurde erfolgreich geändert
              </AlertDescription>
            </Alert>
            <div className="text-center text-sm text-gray-600">
              <p className="mb-2">Sie werden in 3 Sekunden zur Anmeldung weitergeleitet...</p>
            </div>
            <Link href="/login">
              <Button className="w-full">
                Jetzt anmelden
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg border border-gray-200">
            <img 
              src={rowboosterIcon} 
              alt="Rowbooster" 
              className="w-12 h-12 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Neues Passwort festlegen</h1>
          <p className="text-gray-600 mt-2">Geben Sie Ihr neues Passwort ein</p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold text-center text-gray-800">
              Passwort zurücksetzen
            </CardTitle>
            <CardDescription className="text-center">
              Erstellen Sie ein sicheres neues Passwort
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  Ungültiger oder fehlender Reset-Token. Bitte fordern Sie einen neuen Link an.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Neues Passwort
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Neues Passwort eingeben"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      autoComplete="new-password"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Mindestens 8 Zeichen mit Groß-/Kleinbuchstaben, Zahl und Sonderzeichen
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Passwort bestätigen
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Passwort wiederholen"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Wird zurückgesetzt..." : "Passwort zurücksetzen"}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center text-sm">
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                Zurück zur Anmeldung
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}