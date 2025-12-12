import { useState, useEffect, ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  LogOut, RefreshCw, BarChart3, Users, Activity,
  AlertCircle, Terminal, Settings, Menu, X, Package, Mail
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
  onRefresh?: () => void;
}

export default function Layout({ children, onLogout, onRefresh }: LayoutProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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

  const navItems = [
    { href: '/', label: 'DASHBOARD', icon: BarChart3 },
    { href: '/users', label: 'BENUTZER', icon: Users },
    { href: '/product-searches', label: 'SUCHEN', icon: Package },
    { href: '/emails', label: 'E-MAILS', icon: Mail },
    { href: '/activity', label: 'AKTIVITÄT', icon: Activity },
    { href: '/errors', label: 'FEHLER', icon: AlertCircle },
    { href: '/console-logs', label: 'KONSOLE', icon: Terminal },
    { href: '/system', label: 'SYSTEM', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/') return location === '/';
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-black cyber-grid scanlines">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-out Menu */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-black border-r-2 border-yellow-500/30 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-yellow-500/30">
          <h2 className="text-lg font-bold neon-yellow">MENÜ</h2>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 text-yellow-400 hover:text-yellow-300"
            aria-label="Menü schließen"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-bold tracking-wide transition ${
                isActive(href)
                  ? 'bg-yellow-500/20 text-yellow-400 border-l-4 border-yellow-400'
                  : 'text-cyan-400/60 hover:text-cyan-400 hover:bg-cyan-500/10'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-yellow-500/30 space-y-3">
          <div className="text-center">
            <div className="digital-clock text-lg">
              {formatTime(currentTime)}
            </div>
            <div className="text-xs text-yellow-500">
              {formatDate(currentTime)}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onRefresh();
                  setMobileMenuOpen(false);
                }}
                className="w-full glow-yellow border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                AKTUALISIEREN
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onLogout();
                setMobileMenuOpen(false);
              }}
              className="w-full glow-red border-red-500 text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              ABMELDEN
            </Button>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="border-b-2 border-yellow-500/30 bg-black/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            {/* Mobile: Hamburger + Title */}
            <div className="flex items-center gap-3">
              {/* Hamburger Menu Button - Mobile Only */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 text-yellow-400 hover:text-yellow-300 touch-target"
                aria-label="Menü öffnen"
                aria-expanded={mobileMenuOpen}
              >
                <Menu className="h-6 w-6" />
              </button>
              
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold neon-yellow tracking-wider">
                  <span className="hidden sm:inline">ROWBOOSTER ÜBERWACHUNG</span>
                  <span className="sm:hidden">RBMON</span>
                </h1>
                <p className="hidden sm:block text-sm text-cyan-400 mt-1">
                  SYSTEM-KONTROLLZENTRUM
                </p>
              </div>
            </div>
            
            {/* Desktop: Clock + Actions */}
            <div className="hidden md:flex items-center gap-6">
              <div className="text-right">
                <div className="digital-clock text-2xl">
                  {formatTime(currentTime)}
                </div>
                <div className="text-xs text-yellow-500">
                  {formatDate(currentTime)}
                </div>
              </div>
              <div className="flex gap-2">
                {onRefresh && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    className="glow-yellow border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    AKTUALISIEREN
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLogout}
                  className="glow-red border-red-500 text-red-400 hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  ABMELDEN
                </Button>
              </div>
            </div>
            
            {/* Mobile: Small clock */}
            <div className="md:hidden text-right">
              <div className="digital-clock text-sm">
                {formatTime(currentTime)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation - Desktop Only */}
      <nav className="hidden md:block border-b border-yellow-500/20 bg-black/80">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 lg:space-x-8 py-3">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 pb-3 px-1 text-sm font-bold tracking-wide transition whitespace-nowrap ${
                  isActive(href)
                    ? 'text-yellow-400 border-b-2 border-yellow-400'
                    : 'text-cyan-400/60 hover:text-cyan-400'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}