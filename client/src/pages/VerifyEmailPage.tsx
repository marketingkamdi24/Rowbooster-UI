import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, Mail, RefreshCw, Send, Sun, Moon } from "lucide-react";
import rowboosterIcon from "@konzept/Logo/RowBooster_Bildmarke.png";
import { useTheme } from "@/contexts/ThemeContext";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'input' | 'resend'>('verifying');
  const [message, setMessage] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');
  const { theme, toggleTheme } = useTheme();
  
  useEffect(() => {
    const verifyEmail = async () => {
      // Get token from URL
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      // If no token, show code input
      if (!token) {
        setStatus('input');
        setMessage('Bitte geben Sie Ihren 6-stelligen Verifizierungscode ein');
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`, {
          method: 'GET',
        });

        const result = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(result.message || 'E-Mail erfolgreich verifiziert!');
          // Redirect to login after 3 seconds
          setTimeout(() => {
            setLocation('/login');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(result.message || 'Verifizierung fehlgeschlagen. Der Link ist möglicherweise abgelaufen.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('E-Mail-Verifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
      }
    };

    verifyEmail();
  }, [setLocation]);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (verificationCode.length !== 6) {
      setMessage('Bitte geben Sie einen gültigen 6-stelligen Code ein');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/verify-email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(result.message || 'E-Mail erfolgreich verifiziert!');
        setTimeout(() => {
          setLocation('/login');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(result.message || 'Ungültiger oder abgelaufener Verifizierungscode');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Code-Verifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resendEmail || !resendEmail.includes('@')) {
      setResendMessage('Bitte geben Sie eine gültige E-Mail-Adresse ein');
      setResendStatus('error');
      return;
    }

    setResendStatus('sending');
    setResendMessage('');

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });

      const result = await response.json();

      if (response.ok) {
        setResendStatus('sent');
        setResendMessage(result.message || 'Verifizierungs-E-Mail gesendet! Bitte überprüfen Sie Ihren Posteingang.');
      } else {
        setResendStatus('error');
        setResendMessage(result.message || 'Verifizierungs-E-Mail konnte nicht erneut gesendet werden');
      }
    } catch (error) {
      setResendStatus('error');
      setResendMessage('Verifizierungs-E-Mail konnte nicht erneut gesendet werden. Bitte versuchen Sie es erneut.');
    }
  };

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
          <div className="mx-auto mb-4 flex items-center justify-center">
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.22),transparent_60%)] blur-xl" />
              <img src={rowboosterIcon} alt="rowbooster" className="relative h-16 w-16 object-contain" />
            </div>
          </div>
          <CardTitle className={`text-2xl ${theme === 'dark' ? 'text-white' : 'text-[#0c2443]'}`}>
            {status === 'verifying' && 'E-Mail wird verifiziert'}
            {status === 'success' && 'E-Mail verifiziert!'}
            {status === 'error' && 'Verifizierung fehlgeschlagen'}
            {status === 'input' && 'Verifizierungscode eingeben'}
            {status === 'resend' && 'Verifizierungs-E-Mail erneut senden'}
          </CardTitle>
          <CardDescription className={theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}>
            {status === 'verifying' && 'Bitte warten Sie, während wir Ihre E-Mail-Adresse verifizieren...'}
            {status === 'success' && 'Ihr Konto wurde aktiviert'}
            {status === 'error' && 'Bei der Verifizierung Ihrer E-Mail ist ein Problem aufgetreten'}
            {status === 'input' && 'Geben Sie den 6-stelligen Code aus Ihrer E-Mail ein'}
            {status === 'resend' && "E-Mail nicht erhalten? Fordern Sie eine neue an"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'verifying' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-12 w-12 text-[#17c3ce] animate-spin mb-4" />
              <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>Ihre E-Mail-Adresse wird verifiziert...</p>
            </div>
          )}

          {status === 'success' && (
            <>
              <div className="flex flex-col items-center justify-center py-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  theme === 'dark' ? 'bg-[#17c3ce]/20' : 'bg-[#17c3ce]/20'
                }`}>
                  <CheckCircle2 className="w-10 h-10 text-[#17c3ce]" />
                </div>
                <Alert className="border-[#17c3ce]/30 bg-[#17c3ce]/10">
                  <CheckCircle2 className="h-4 w-4 text-[#17c3ce]" />
                  <AlertDescription className={`ml-2 ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>
                    {message}
                  </AlertDescription>
                </Alert>
              </div>
              <div className={`text-center text-sm ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
                <p className="mb-2">Sie können sich jetzt in Ihr Konto einloggen.</p>
                <p className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`}>Weiterleitung zur Anmeldung in 3 Sekunden...</p>
              </div>
              <Link href="/login">
                <Button className={`w-full rounded-xl transition-all duration-300 ${
                  theme === 'dark'
                    ? '!bg-[#c8fa64] text-[#0c2443] hover:brightness-105'
                    : '!bg-[#17c3ce] text-white hover:brightness-105'
                }`}>
                  Jetzt zur Anmeldung
                </Button>
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                  <XCircle className="w-10 h-10 text-red-500" />
                </div>
                <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="ml-2 text-red-600">
                    {message}
                  </AlertDescription>
                </Alert>
              </div>
              <div className={`text-sm space-y-2 ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
                <p className="font-semibold">Was Sie als nächstes tun können:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Prüfen Sie, ob der Link abgelaufen ist (1-Stunden-Limit)</li>
                  <li>Versuchen Sie stattdessen, Ihren Verifizierungscode einzugeben</li>
                  <li>Fordern Sie eine neue Verifizierungs-E-Mail an</li>
                  <li>Kontaktieren Sie den Support, wenn das Problem weiterhin besteht</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Link href="/login">
                  <Button className={`w-full rounded-xl ${
                    theme === 'dark'
                      ? 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                      : 'border-[#17c3ce]/30 bg-white text-[#0c2443] hover:bg-[#17c3ce]/5'
                  }`} variant="outline">
                    Zurück zur Anmeldung
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className={`w-full rounded-xl ${
                    theme === 'dark'
                      ? 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                      : 'border-[#17c3ce]/30 bg-white text-[#0c2443] hover:bg-[#17c3ce]/5'
                  }`} variant="outline">
                    Erneut registrieren
                  </Button>
                </Link>
                <Button
                  className={`w-full rounded-xl ${
                    theme === 'dark'
                      ? 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                      : 'border-[#17c3ce]/30 bg-white text-[#0c2443] hover:bg-[#17c3ce]/5'
                  }`}
                  variant="outline"
                  onClick={() => setStatus('input')}
                >
                  Verifizierungscode eingeben
                </Button>
                <Button
                  className={`w-full rounded-xl ${theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-[#0c2443]/70 hover:text-[#0c2443]'}`}
                  variant="ghost"
                  onClick={() => {
                    setStatus('resend');
                    setResendStatus('idle');
                    setResendMessage('');
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Verifizierungs-E-Mail erneut senden
                </Button>
              </div>
            </>
          )}

          {status === 'input' && (
            <>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-16 h-16 bg-[#17c3ce]/20 rounded-full flex items-center justify-center mb-4">
                  <Mail className="w-10 h-10 text-[#17c3ce]" />
                </div>
                <Alert className="border-[#17c3ce]/30 bg-[#17c3ce]/10">
                  <Mail className="h-4 w-4 text-[#17c3ce]" />
                  <AlertDescription className={`ml-2 ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>
                    {message}
                  </AlertDescription>
                </Alert>
              </div>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="code" className={`text-sm font-medium ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>
                    Verifizierungscode
                  </label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className={`text-center text-2xl tracking-widest font-mono focus-visible:ring-2 focus-visible:ring-[#17c3ce]/45 focus-visible:ring-offset-0 ${
                      theme === 'dark'
                        ? 'bg-white/[0.04] text-white placeholder:text-white/40 border-white/[0.10]'
                        : 'bg-[#ecf5fa] text-[#0c2443] placeholder:text-[#0c2443]/40 border-[#17c3ce]/20'
                    }`}
                    autoComplete="off"
                  />
                  <p className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`}>
                    Geben Sie den 6-stelligen Code aus Ihrer E-Mail ein
                  </p>
                </div>
                <Button
                  type="submit"
                  className={`w-full rounded-xl transition-all duration-300 ${
                    theme === 'dark'
                      ? '!bg-[#c8fa64] text-[#0c2443] hover:brightness-105'
                      : '!bg-[#17c3ce] text-white hover:brightness-105'
                  }`}
                  disabled={isSubmitting || verificationCode.length !== 6}
                >
                  {isSubmitting ? 'Wird verifiziert...' : 'E-Mail verifizieren'}
                </Button>
              </form>
              <div className={`mt-4 text-center text-xs ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`}>
                <p>⚠️ Der Code läuft nach 1 Stunde ab</p>
              </div>
              <div className="mt-4 space-y-2">
                <Button
                  className={`w-full rounded-xl ${theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-[#0c2443]/70 hover:text-[#0c2443]'}`}
                  variant="ghost"
                  onClick={() => {
                    setStatus('resend');
                    setResendStatus('idle');
                    setResendMessage('');
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  E-Mail nicht erhalten? Erneut senden
                </Button>
                <Link href="/login">
                  <Button className={`w-full rounded-xl ${
                    theme === 'dark'
                      ? 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                      : 'border-[#17c3ce]/30 bg-white text-[#0c2443] hover:bg-[#17c3ce]/5'
                  }`} variant="outline">
                    Zurück zur Anmeldung
                  </Button>
                </Link>
              </div>
            </>
          )}

          {status === 'resend' && (
            <>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-16 h-16 bg-[#17c3ce]/20 rounded-full flex items-center justify-center mb-4">
                  <Send className="w-10 h-10 text-[#17c3ce]" />
                </div>
                {resendStatus === 'sent' && (
                  <Alert className="border-[#17c3ce]/30 bg-[#17c3ce]/10">
                    <CheckCircle2 className="h-4 w-4 text-[#17c3ce]" />
                    <AlertDescription className={`ml-2 ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>
                      {resendMessage}
                    </AlertDescription>
                  </Alert>
                )}
                {resendStatus === 'error' && (
                  <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="ml-2 text-red-600">
                      {resendMessage}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              
              {resendStatus !== 'sent' && (
                <form onSubmit={handleResendVerification} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="resend-email" className={`text-sm font-medium ${theme === 'dark' ? 'text-white/90' : 'text-[#0c2443]/90'}`}>
                      Ihre E-Mail-Adresse
                    </label>
                    <Input
                      id="resend-email"
                      type="email"
                      placeholder="ihre@email.de"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      className={`text-center focus-visible:ring-2 focus-visible:ring-[#17c3ce]/45 focus-visible:ring-offset-0 ${
                        theme === 'dark'
                          ? 'bg-white/[0.04] text-white placeholder:text-white/40 border-white/[0.10]'
                          : 'bg-[#ecf5fa] text-[#0c2443] placeholder:text-[#0c2443]/40 border-[#17c3ce]/20'
                      }`}
                      autoComplete="email"
                    />
                    <p className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`}>
                      Geben Sie die E-Mail-Adresse ein, mit der Sie sich registriert haben
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className={`w-full rounded-xl transition-all duration-300 ${
                      theme === 'dark'
                        ? '!bg-[#c8fa64] text-[#0c2443] hover:brightness-105'
                        : '!bg-[#17c3ce] text-white hover:brightness-105'
                    }`}
                    disabled={resendStatus === 'sending' || !resendEmail}
                  >
                    {resendStatus === 'sending' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Wird gesendet...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Verifizierungs-E-Mail erneut senden
                      </>
                    )}
                  </Button>
                </form>
              )}

              {resendStatus === 'sent' && (
                <div className="space-y-2">
                  <p className={`text-sm text-center ${theme === 'dark' ? 'text-white/60' : 'text-[#0c2443]/60'}`}>
                    Überprüfen Sie Ihren Posteingang und Spam-Ordner auf die Verifizierungs-E-Mail.
                  </p>
                  <Button
                    className={`w-full rounded-xl transition-all duration-300 ${
                      theme === 'dark'
                        ? '!bg-[#c8fa64] text-[#0c2443] hover:brightness-105'
                        : '!bg-[#17c3ce] text-white hover:brightness-105'
                    }`}
                    onClick={() => {
                      setStatus('input');
                      setResendStatus('idle');
                    }}
                  >
                    Verifizierungscode eingeben
                  </Button>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <Button
                  className={`w-full rounded-xl ${
                    theme === 'dark'
                      ? 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                      : 'border-[#17c3ce]/30 bg-white text-[#0c2443] hover:bg-[#17c3ce]/5'
                  }`}
                  variant="outline"
                  onClick={() => setStatus('input')}
                >
                  Ich habe einen Code
                </Button>
                <Link href="/login">
                  <Button className={`w-full rounded-xl ${theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-[#0c2443]/70 hover:text-[#0c2443]'}`} variant="ghost">
                    Zurück zur Anmeldung
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}