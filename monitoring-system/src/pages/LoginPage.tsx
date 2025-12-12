import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => Promise<void>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useState(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        // Wait for login handler to complete before setting loading to false
        await onLogin();
      } else {
        const data = await response.json();
        setError(data.message || 'Invalid credentials');
        setLoading(false);
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
      setLoading(false);
    }
    // Note: Don't set loading to false on success - the page will redirect
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-black cyber-grid scanlines flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-16 w-16 text-yellow-400 glow-yellow" />
          </div>
          <h1 className="text-4xl font-bold neon-yellow tracking-wider mb-2">
            ROWBOOSTER
          </h1>
          <h2 className="text-2xl font-bold neon-cyan tracking-wide mb-4">
            ÜBERWACHUNGSSYSTEM
          </h2>
          <div className="digital-clock text-lg mb-1">
            {formatTime(currentTime)}
          </div>
          <div className="text-xs text-yellow-500">
            {formatDate(currentTime)}
          </div>
        </div>

        {/* Login Form */}
        <div className="cyber-panel p-8 rounded-lg">
          <div className="mb-6 text-center">
            <h3 className="text-xl font-bold text-yellow-400 tracking-wide mb-2">
              SYSTEMZUGANG
            </h3>
            <p className="text-sm text-cyan-400/60">
              ANMELDEDATEN EINGEBEN
            </p>
          </div>

          {error && (
            <div className="mb-6 glow-red rounded p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-red-400 font-bold text-sm tracking-wide">ZUGANG VERWEIGERT</div>
                <div className="text-red-400/80 text-sm">{error}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-yellow-400 text-sm font-bold mb-2 tracking-wide">
                BENUTZERNAME
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-yellow-400" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Benutzername eingeben"
                  required
                  className="pl-12 h-12 bg-black/50 border-yellow-500/30 text-cyan-400 placeholder:text-yellow-400/40 focus:border-yellow-500 focus:ring-yellow-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-yellow-400 text-sm font-bold mb-2 tracking-wide">
                PASSWORT
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-yellow-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort eingeben"
                  required
                  className="pl-12 h-12 bg-black/50 border-yellow-500/30 text-cyan-400 placeholder:text-yellow-400/40 focus:border-yellow-500 focus:ring-yellow-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-yellow-500 to-cyan-500 hover:from-yellow-400 hover:to-cyan-400 text-black font-bold tracking-wider text-lg glow-yellow transition-all"
            >
              {loading ? 'AUTHENTIFIZIERUNG...' : 'ANMELDEN'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-yellow-500/20">
            <div className="text-center text-xs text-cyan-400/60">
              <p className="mb-2">ROWBOOSTER ÜBERWACHUNGSSYSTEM</p>
              <p className="text-yellow-400/40">NUR AUTORISIERTER ZUGANG</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded border border-cyan-500/30 bg-black/50">
            <div className="status-online"></div>
            <span className="text-green-400 text-sm font-bold">SYSTEM ONLINE</span>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            © 2024 ROWBOOSTER ÜBERWACHUNG • SICHERE VERBINDUNG
          </p>
        </div>
      </div>
    </div>
  );
}