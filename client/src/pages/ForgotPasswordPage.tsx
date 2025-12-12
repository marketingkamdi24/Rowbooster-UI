import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle2 } from "lucide-react";
import rowboosterIcon from "@assets/rb-2_1753205370923.png";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">E-Mail gesendet!</CardTitle>
            <CardDescription>Überprüfen Sie Ihren Posteingang</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900 ml-2">
                Wir haben einen Link zum Zurücksetzen des Passworts an <strong>{email}</strong> gesendet
              </AlertDescription>
            </Alert>
            <div className="text-sm text-gray-600 space-y-2">
              <p>Bitte folgen Sie diesen Schritten:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Überprüfen Sie Ihren E-Mail-Posteingang</li>
                <li>Klicken Sie auf den Link zum Zurücksetzen</li>
                <li>Geben Sie Ihr neues Passwort ein</li>
              </ol>
              <p className="text-xs text-red-500 mt-4 font-semibold">
                ⚠️ Wichtig: Der Link läuft in 1 Stunde ab.
              </p>
            </div>
            <div className="pt-4">
              <Link href="/login">
                <Button className="w-full">
                  Zurück zur Anmeldung
                </Button>
              </Link>
            </div>
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
          <h1 className="text-3xl font-bold text-gray-900">Passwort vergessen</h1>
          <p className="text-gray-600 mt-2">Wir senden Ihnen einen Link zum Zurücksetzen</p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold text-center text-gray-800">
              Passwort zurücksetzen
            </CardTitle>
            <CardDescription className="text-center">
              Geben Sie Ihre E-Mail-Adresse ein
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  E-Mail-Adresse
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="ihre@email.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    autoComplete="email"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Wird gesendet..." : "Link zum Zurücksetzen senden"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-gray-600">Kennen Sie Ihr Passwort? </span>
              <Link href="/login">
                <a className="text-blue-600 hover:text-blue-700 font-semibold">
                  Jetzt anmelden
                </a>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}